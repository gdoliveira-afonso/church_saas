const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const prisma = new PrismaClient();

// ─── CRUD DE WEBHOOKS ──────────────────────────────────────────────────────

async function listWebhooks(req, res) {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        const webhooks = await prisma.webhook.findMany({
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, url: true, events: true, status: true, createdAt: true }
        });
        const result = webhooks.map(w => ({ ...w, events: JSON.parse(w.events || '[]') }));
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar webhooks.' });
    }
}

async function createWebhook(req, res) {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        const { name, url, secret, events } = req.body;
        if (!name || !url) return res.status(400).json({ error: 'Nome e URL são obrigatórios.' });

        const generatedSecret = secret || crypto.randomBytes(24).toString('hex');
        const wh = await prisma.webhook.create({
            data: {
                name,
                url,
                secret: generatedSecret,
                events: JSON.stringify(events || []),
                status: 'active'
            }
        });
        res.status(201).json({
            success: true,
            data: { ...wh, events: JSON.parse(wh.events), secret: generatedSecret }
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar webhook.' });
    }
}

async function updateWebhook(req, res) {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        const { id } = req.params;
        const { name, url, secret, events, status } = req.body;
        const wh = await prisma.webhook.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(url !== undefined && { url }),
                ...(secret !== undefined && { secret }),
                ...(events !== undefined && { events: JSON.stringify(events) }),
                ...(status !== undefined && { status }),
            }
        });
        res.json({ success: true, data: { ...wh, events: JSON.parse(wh.events) } });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar webhook.' });
    }
}

async function deleteWebhook(req, res) {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        await prisma.webhook.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Webhook removido.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover webhook.' });
    }
}

async function getWebhookLogs(req, res) {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        const logs = await prisma.webhookLog.findMany({
            where: { webhookId: req.params.id },
            orderBy: { createdAt: 'desc' },
            take: 30
        });
        res.json({ success: true, data: logs });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar logs.' });
    }
}

// ─── ENVIO DE WEBHOOK ──────────────────────────────────────────────────────

/**
 * Envia um payload assinado para uma URL de webhook.
 * @param {string} webhookUrl
 * @param {string} secret
 * @param {object} payload
 * @returns {{ statusCode: number, responseTime: number, success: boolean }}
 */
async function sendWebhookRequest(webhookUrl, secret, payload) {
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const start = Date.now();

    return new Promise((resolve) => {
        try {
            const urlObj = new URL(webhookUrl);
            const lib = urlObj.protocol === 'https:' ? https : http;
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    'X-Webhook-Signature': `sha256=${signature}`,
                    'User-Agent': 'CRM-Celular-Webhook/1.0'
                },
                timeout: 8000
            };

            const req = lib.request(options, (res) => {
                const responseTime = Date.now() - start;
                resolve({ statusCode: res.statusCode, responseTime, success: res.statusCode >= 200 && res.statusCode < 300 });
                res.resume(); // descarta resposta
            });

            req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, responseTime: Date.now() - start, success: false }); });
            req.on('error', () => resolve({ statusCode: 0, responseTime: Date.now() - start, success: false }));
            req.write(body);
            req.end();
        } catch {
            resolve({ statusCode: 0, responseTime: Date.now() - start, success: false });
        }
    });
}

/**
 * Dispara um evento para todos os webhooks ativos que escutam esse evento.
 * Chamado pelos controllers de membros, eventos, etc.
 */
async function dispatchWebhook(eventName, data) {
    try {
        const webhooks = await prisma.webhook.findMany({ where: { status: 'active' } });
        for (const wh of webhooks) {
            const events = JSON.parse(wh.events || '[]');
            if (!events.includes(eventName)) continue;

            const payload = {
                event: eventName,
                timestamp: Math.floor(Date.now() / 1000),
                data
            };

            const result = await sendWebhookRequest(wh.url, wh.secret, payload);

            // Salva log
            await prisma.webhookLog.create({
                data: {
                    webhookId: wh.id,
                    event: eventName,
                    statusCode: result.statusCode,
                    responseTime: result.responseTime,
                    success: result.success
                }
            }).catch(() => { });
        }
    } catch (err) {
        console.error('[dispatchWebhook] Erro:', err.message);
    }
}

// Testa webhook manualmente
async function testWebhook(req, res) {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        const wh = await prisma.webhook.findUnique({ where: { id: req.params.id } });
        if (!wh) return res.status(404).json({ error: 'Webhook não encontrado.' });

        const payload = {
            event: 'webhook.test',
            timestamp: Math.floor(Date.now() / 1000),
            data: { message: 'Evento de teste do SGI v1.0.' }
        };

        const result = await sendWebhookRequest(wh.url, wh.secret, payload);

        await prisma.webhookLog.create({
            data: {
                webhookId: wh.id,
                event: 'webhook.test',
                statusCode: result.statusCode,
                responseTime: result.responseTime,
                success: result.success
            }
        }).catch(() => { });

        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao testar webhook.' });
    }
}

module.exports = { listWebhooks, createWebhook, updateWebhook, deleteWebhook, getWebhookLogs, testWebhook, dispatchWebhook };
