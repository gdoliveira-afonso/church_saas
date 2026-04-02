const express = require('express');
const router = express.Router();
const prisma = require('../../../lib/prisma');
const { requirePermission } = require('../../middleware/apiAuth');
const { dispatchWebhook } = require('../../controllers/webhooksController');

// GET /api/v1/eventos
router.get('/', requirePermission('read_eventos'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const { from, to, page = 1, limit = 50 } = req.query;
        const where = { organizationId: orgId };
        if (from) where.date = { gte: from };
        if (to) where.date = { ...where.date, lte: to };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [events, total] = await Promise.all([
            prisma.event.findMany({ where, skip, take: parseInt(limit), orderBy: { date: 'asc' } }),
            prisma.event.count({ where })
        ]);
        res.json({ success: true, data: events, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar eventos.' });
    }
});

// POST /api/v1/eventos
router.post('/', requirePermission('write_eventos'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const { title, date, startTime, endTime, description, color, type, location, recurrence, icon } = req.body;
        if (!title || !date) return res.status(400).json({ success: false, error: 'Campos "title" e "date" são obrigatórios.' });

        const event = await prisma.event.create({
            data: { title, date, startTime, endTime, description, color: color || 'blue', type: type || 'event', location, recurrence: recurrence || 'none', icon, organizationId: orgId }
        });
        dispatchWebhook('evento.created', event, orgId).catch(() => { });
        res.status(201).json({ success: true, data: event });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao criar evento.' });
    }
});

// PUT /api/v1/eventos/:id
router.put('/:id', requirePermission('write_eventos'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const existing = await prisma.event.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!existing) return res.status(404).json({ success: false, error: 'Evento não encontrado.' });

        const { title, date, startTime, endTime, description, color, type, location, recurrence, icon } = req.body;
        const event = await prisma.event.update({
            where: { id: req.params.id },
            data: { title, date, startTime, endTime, description, color, type, location, recurrence, icon }
        });
        res.json({ success: true, data: event });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao atualizar evento.' });
    }
});

// DELETE /api/v1/eventos/:id
router.delete('/:id', requirePermission('write_eventos'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const existing = await prisma.event.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!existing) return res.status(404).json({ success: false, error: 'Evento não encontrado.' });
        await prisma.event.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao excluir evento.' });
    }
});

module.exports = router;
