const express = require('express');
const router = express.Router();
const prisma = require('../../../lib/prisma');
const { requirePermission } = require('../../middleware/apiAuth');
const { dispatchWebhook } = require('../../controllers/webhooksController');

// GET /api/v1/membros
router.get('/', requirePermission('read_membros'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const { status, cellId, page = 1, limit = 50 } = req.query;
        const where = { organizationId: orgId };
        if (status) where.status = status;
        if (cellId) where.cellId = cellId;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [people, total] = await Promise.all([
            prisma.person.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: { cell: { select: { id: true, name: true } } },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.person.count({ where })
        ]);

        res.json({ success: true, data: people, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar membros.' });
    }
});

// GET /api/v1/membros/:id
router.get('/:id', requirePermission('read_membros'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const person = await prisma.person.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            include: { cell: { select: { id: true, name: true } }, personTracks: { include: { track: true } } }
        });
        if (!person) return res.status(404).json({ success: false, error: 'Membro não encontrado.' });
        res.json({ success: true, data: person });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar membro.' });
    }
});

// POST /api/v1/membros
router.post('/', requirePermission('write_membros'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const { name, phone, email, birthdate, address, status, cellId } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Campo "name" é obrigatório.' });

        const person = await prisma.person.create({
            data: { name, phone, email, birthdate, address, status: status || 'Visitante', cellId: cellId || null, organizationId: orgId }
        });

        dispatchWebhook('membro.created', person).catch(() => { });
        res.status(201).json({ success: true, data: person });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao criar membro.' });
    }
});

// PUT /api/v1/membros/:id
router.put('/:id', requirePermission('write_membros'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const existing = await prisma.person.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!existing) return res.status(404).json({ success: false, error: 'Membro não encontrado.' });

        const { name, phone, email, birthdate, address, status, cellId } = req.body;
        const person = await prisma.person.update({
            where: { id: req.params.id },
            data: { name, phone, email, birthdate, address, status, cellId: cellId || null }
        });
        dispatchWebhook('membro.updated', person).catch(() => { });
        res.json({ success: true, data: person });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao atualizar membro.' });
    }
});

// DELETE /api/v1/membros/:id
router.delete('/:id', requirePermission('write_membros'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const person = await prisma.person.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!person) return res.status(404).json({ success: false, error: 'Membro não encontrado.' });
        await prisma.person.delete({ where: { id: req.params.id } });
        dispatchWebhook('membro.deleted', { id: req.params.id }).catch(() => { });
        res.json({ success: true, message: 'Membro removido com sucesso.' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao remover membro.' });
    }
});

module.exports = router;
