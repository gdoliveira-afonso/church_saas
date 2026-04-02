const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const prisma = new PrismaClient();

// Intervalos de retry (ms): 1min, 5min, 30min, 2h, 5h
const RETRY_INTERVALS = [60_000, 300_000, 1_800_000, 7_200_000, 18_000_000];

// ─── CRUD DE WEBHOOKS (multi-tenant) ──────────────────────────────────────────

async function listWebhooks(req, res) {
    try {
        if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Apenas administradores.' });
        const orgId = req.user.organizationId;
        const webhooks = await prisma.webhook.findMany({
            where: { organizationId: orgId },
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
        if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Apenas administradores.' });
        const orgId = req.user.organizationId;
        const { name, url, secret, events } = req.body;
        if (!name || !url) return res.status(400).json({ error: 'Nome e URL são obrigatórios.' });

        const generatedSecret = secret || crypto.randomBytes(24).toString('hex');
        const wh = await prisma.webhook.create({
            data: {
                name,
                url,
                secret: generatedSecret,
                events: JSON.stringify(events || []),
                status: 'active',
                organizationId: orgId
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
        if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Apenas administradores.' });
        const orgId = req.user.organizationId;
        const { id } = req.params;

        const existing = await prisma.webhook.findFirst({ where: { id, organizationId: orgId } });
        if (!existing) return res.status(404).json({ error: 'Webhook não encontrado.' });

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
        if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Apenas administradores.' });
        const orgId = req.user.organizationId;

        const existing = await prisma.webhook.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!existing) return res.status(404).json({ error: 'Webhook não encontrado.' });

        await prisma.webhook.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Webhook removido.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover webhook.' });
    }
}

async function getWebhookLogs(req, res) {
    try {
        if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Apenas administradores.' });
        const orgId = req.user.organizationId;

        const wh = await prisma.webhook.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!wh) return res.status(404).json({ error: 'Webhook não encontrado.' });

        const { event, success, from, to, page = 1, limit = 30 } = req.query;
        const where = { webhookId: req.params.id };
        if (event) where.event = event;
        if (success !== undefined) where.success = success === 'true';
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) where.createdAt.lte = new Date(to);
        }

        const take = Math.min(Math.max(1, parseInt(limit) || 30), 100);
        const skip = (Math.max(1, parseInt(page) || 1) - 1) * take;

        const [logs, total] = await Promise.all([
            prisma.webhookLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
            prisma.webhookLog.count({ where })
        ]);

        res.json({ success: true, data: logs, total, page: parseInt(page) || 1, totalPages: Math.ceil(total / take) });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar logs.' });
    }
}

async function redeliverWebhook(req, res) {
    try {
        if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Apenas administradores.' });
        const orgId = req.user.organizationId;

        const delivery = await prisma.webhookDelivery.findFirst({
            where: { id: req.params.deliveryId, organizationId: orgId },
            include: { webhook: true }
        });
        if (!delivery) return res.status(404).json({ error: 'Entrega não encontrada.' });

        // Reagenda para imediato
        await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: { status: 'pending', attempts: 0, nextRetryAt: new Date(), lastError: null }
        });

        res.json({ success: true, message: 'Reenvio agendado.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao reagendar entrega.' });
    }
}

// ─── ENVIO DE WEBHOOK ──────────────────────────────────────────────────────

/**
 * Envia um payload assinado para uma URL de webhook.
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

            const req = lib.request(options, (r) => {
                const responseTime = Date.now() - start;
                resolve({ statusCode: r.statusCode, responseTime, success: r.statusCode >= 200 && r.statusCode < 300 });
                r.resume();
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
 * Em caso de falha, cria uma WebhookDelivery para retry automático.
 */
async function dispatchWebhook(eventName, data, organizationId) {
    try {
        const where = { status: 'active' };
        if (organizationId) where.organizationId = organizationId;

        const webhooks = await prisma.webhook.findMany({ where });

        const dispatches = webhooks
            .filter(wh => {
                const events = JSON.parse(wh.events || '[]');
                return events.includes(eventName);
            })
            .map(async (wh) => {
                const payload = {
                    id: crypto.randomUUID(),
                    event: eventName,
                    apiVersion: '2026-04-02',
                    organizationId: organizationId || null,
                    timestamp: Math.floor(Date.now() / 1000),
                    data
                };

                const result = await sendWebhookRequest(wh.url, wh.secret, payload);

                // Log imediato
                await prisma.webhookLog.create({
                    data: {
                        webhookId: wh.id,
                        event: eventName,
                        statusCode: result.statusCode,
                        responseTime: result.responseTime,
                        success: result.success
                    }
                }).catch(() => {});

                // Se falhou, enfileira para retry
                if (!result.success) {
                    await prisma.webhookDelivery.create({
                        data: {
                            webhookId: wh.id,
                            organizationId: organizationId || wh.organizationId,
                            event: eventName,
                            payload: JSON.stringify(payload),
                            attempts: 1,
                            nextRetryAt: new Date(Date.now() + RETRY_INTERVALS[0]),
                            lastStatusCode: result.statusCode,
                            lastError: `HTTP ${result.statusCode}`
                        }
                    }).catch(() => {});
                }
            });

        await Promise.allSettled(dispatches);
    } catch (err) {
        console.error('[dispatchWebhook] Erro:', err.message);
    }
}

// ─── LISTAGEM DE DELIVERIES ───────────────────────────────────────────────────

async function listWebhookDeliveries(req, res) {
    try {
        if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Apenas administradores.' });
        const orgId = req.user.organizationId;

        const wh = await prisma.webhook.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!wh) return res.status(404).json({ error: 'Webhook não encontrado.' });

        const { status, page = 1, limit = 30 } = req.query;
        const where = { webhookId: req.params.id };
        if (status) where.status = status;

        const take = Math.min(Math.max(1, parseInt(limit) || 30), 100);
        const skip = (Math.max(1, parseInt(page) || 1) - 1) * take;

        const [deliveries, total] = await Promise.all([
            prisma.webhookDelivery.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
            prisma.webhookDelivery.count({ where })
        ]);

        res.json({ success: true, data: deliveries, total, page: parseInt(page) || 1, totalPages: Math.ceil(total / take) });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar deliveries.' });
    }
}

// ─── TESTE MANUAL ─────────────────────────────────────────────────────────────

async function testWebhook(req, res) {
    try {
        if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Apenas administradores.' });
        const orgId = req.user.organizationId;

        const wh = await prisma.webhook.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!wh) return res.status(404).json({ error: 'Webhook não encontrado.' });

        const payload = {
            id: crypto.randomUUID(),
            event: 'webhook.test',
            apiVersion: '2026-04-02',
            organizationId: orgId,
            timestamp: Math.floor(Date.now() / 1000),
            data: { message: 'Evento de teste do CRM Celular.' }
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
        }).catch(() => {});

        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao testar webhook.' });
    }
}

module.exports = {
    listWebhooks, createWebhook, updateWebhook, deleteWebhook,
    getWebhookLogs, listWebhookDeliveries, redeliverWebhook, testWebhook,
    dispatchWebhook, sendWebhookRequest
};
