const express = require('express');
const prisma = require('../lib/prisma');
const { getNotificationConfig } = require('./config');
const { sendPushToUsers } = require('../lib/pushNotification');
const { dispatchWebhook } = require('../api/controllers/webhooksController');

const router = express.Router();

// ------------------------------------------------------------------
// HELPER: Notifica todos os líderes e vice-líderes (da mesma organização)
// ------------------------------------------------------------------
async function notifyAllLeaders(title, message, orgId, action) {
    try {
        const leaders = await prisma.user.findMany({
            where: { organizationId: orgId, role: { in: ['ADMIN', 'LEADER', 'VICE_LEADER', 'LIDER_GERACAO', 'SUPERVISOR'] } },
            select: { id: true }
        });
        if (!leaders.length) return;

        const leaderIds = leaders.map(u => u.id);

        // Notificações no banco (in-app) — falha não bloqueia o push
        try {
            await prisma.notification.createMany({
                data: leaderIds.map(id => ({ userId: id, title, message, action: action || null, organizationId: orgId }))
            });
        } catch (e) {
            console.error('[notifyAllLeaders] Falha ao criar notificações no BD:', e.message);
        }

        // Push notifications (independente — sempre dispara)
        console.log('[notifyAllLeaders] Enviando push para', leaderIds.length, 'líderes, action=', action);
        sendPushToUsers(leaderIds, { title, body: message, data: { action: action || '#/events' } }).catch(() => {});
    } catch (e) {
        console.error('[notifyAllLeaders] Falha ao notificar líderes:', e.message);
    }
}

// ------------------------------------------------------------------
// EVENTOS
// ------------------------------------------------------------------

// Listar todos os eventos da organização
router.get('/', async (req, res) => {
    try {
        const orgId = req.orgId;
        const events = await prisma.event.findMany({ where: { organizationId: orgId } });
        const cellCancellations = await prisma.cellCancellation.findMany({ where: { organizationId: orgId } });
        const cellJustifications = await prisma.cellJustification.findMany({ where: { organizationId: orgId } });
        res.json({ events, cellCancellations, cellJustifications });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar eventos' });
    }
});

router.get('/exceptions/all', async (req, res) => {
    try {
        const orgId = req.orgId;
        const rows = await prisma.eventException.findMany({
            where: { event: { organizationId: orgId } }
        });
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar todas as exceptions' });
    }
});

router.get('/:id/exceptions', async (req, res) => {
    try {
        const orgId = req.orgId;
        const rows = await prisma.eventException.findMany({
            where: { eventId: req.params.id, event: { organizationId: orgId } }
        });
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar exceptions' });
    }
});

router.post('/:id/exceptions', async (req, res) => {
    const { date, canceled, newTitle } = req.body;
    const orgId = req.orgId;
    if (!date) return res.status(400).json({ error: 'date obrigatorio' });
    try {
        const event = await prisma.event.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

        await prisma.eventException.upsert({
            where: {
                eventId_date: {
                    eventId: req.params.id,
                    date: date
                }
            },
            update: {
                canceled: canceled || false,
                newTitle: newTitle || null
                // Mantém organizationId
            },
            create: {
                eventId: req.params.id,
                date: date,
                canceled: canceled || false,
                newTitle: newTitle || null,
                organizationId: orgId
            }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao salvar exception', details: e.message });
    }
});


// Busca um evento por ID (dentro da organização)
router.get('/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const event = await prisma.event.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!event) return res.status(404).json({ error: 'Evento não encontrado nesta organização' });
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar evento' });
    }
});

// Cadastra evento (vinculado à organização)
router.post('/', async (req, res) => {
    const data = req.body;
    const orgId = req.orgId;
    if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });

    try {
        const event = await prisma.event.create({
            data: {
                title: data.title,
                date: data.date,
                startTime: data.startTime,
                endTime: data.endTime,
                description: data.description,
                color: data.color || 'blue',
                type: data.type || 'event',
                category: data.category,
                location: data.location,
                recurrence: data.recurrence || 'none',
                reminder: data.reminder,
                icon: data.icon,
                notify: data.notify !== false,
                organizationId: orgId
            }
        });

        const notifCfg = await getNotificationConfig(orgId);
        if (event.notify && notifCfg.newEvent?.enabled !== false) {
            const dateFormatted = new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
            const timeStr = data.startTime ? ` às ${data.startTime}` : '';
            const locationStr = data.location ? ` — ${data.location}` : '';
            const scopeLabel = data.category === 'geral' ? '🌐 [Evento Geral do Núcleo]' : '🏘️ [Evento Local]';
            await notifyAllLeaders(
                `📅 Nova Programação: ${event.title}`,
                `${scopeLabel} "${event.title}" em ${dateFormatted}${timeStr}${locationStr}.`,
                orgId,
                `#/calendar`
            );
        }

        res.status(201).json(event);

        if (event.notify) {
            dispatchWebhook('evento.created', {
                evento: {
                    id: event.id,
                    title: event.title,
                    date: event.date,
                    startTime: event.startTime || null,
                    endTime: event.endTime || null,
                    location: event.location || null,
                    category: event.category || 'local',
                    type: event.type || 'event'
                }
            }, orgId).catch(() => {});
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar evento' });
    }
});

// Atualiza evento (dentro da organização)
router.put('/:id', async (req, res) => {
    const data = req.body;
    const orgId = req.orgId;
    try {
        const existing = await prisma.event.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!existing) return res.status(404).json({ error: 'Evento não encontrado nesta organização' });

        const event = await prisma.event.update({
            where: { id: req.params.id },
            data: {
                title: data.title,
                date: data.date,
                startTime: data.startTime,
                endTime: data.endTime,
                description: data.description,
                color: data.color,
                type: data.type,
                category: data.category,
                location: data.location,
                recurrence: data.recurrence,
                reminder: data.reminder,
                icon: data.icon,
                notify: data.notify !== false
            }
        });

        if (existing.date !== data.date || existing.title !== data.title) {
            const notifCfg = await getNotificationConfig(orgId);
            if (event.notify && notifCfg.updatedEvent?.enabled !== false) {
                const dateFormatted = new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                const timeStr = data.startTime ? ` às ${data.startTime}` : '';
                const scopeLabel = data.category === 'geral' ? '🌐 [Geral]' : '🏘️ [Local]';
                await notifyAllLeaders(
                    `✏️ Programação Atualizada: ${event.title}`,
                    `${scopeLabel} "${event.title}" foi atualizado. Nova data: ${dateFormatted}${timeStr}.`,
                    orgId,
                    `#/calendar`
                );
            }
        }

        res.json(event);
        dispatchWebhook('evento.updated', { id: event.id, title: event.title, date: event.date }, orgId).catch(() => {});
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar evento' });
    }
});

// Deleta evento (dentro da organização)
router.delete('/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const existing = await prisma.event.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!existing) return res.status(404).json({ error: 'Evento não encontrado nesta organização' });

        await prisma.event.delete({ where: { id: req.params.id } });
        res.json({ success: true });
        dispatchWebhook('evento.deleted', { id: req.params.id, title: existing.title, date: existing.date }, orgId).catch(() => {});
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar evento' });
    }
});

module.exports = { router, notifyAllLeaders };


