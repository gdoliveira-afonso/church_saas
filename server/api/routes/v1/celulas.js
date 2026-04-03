const express = require('express');
const router = express.Router();
const prisma = require('../../../lib/prisma');
const { requirePermission } = require('../../middleware/apiAuth');

/**
 * Monta o objeto de líder/vice com nome + telefone via User → Person.
 */
async function buildLeaderInfo(userId) {
    if (!userId) return null;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, person: { select: { phone: true } } }
    });
    if (!user) return null;
    return { id: user.id, name: user.name, phone: user.person?.phone || null };
}

// GET /api/v1/celulas
router.get('/', requirePermission('read_celulas'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const { page = 1, limit = 50, status } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = { organizationId: orgId };
        if (status) where.status = status;

        const [cells, total] = await Promise.all([
            prisma.cell.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    generation: { select: { id: true, name: true } },
                    _count: { select: { people: true } }
                },
                orderBy: { name: 'asc' }
            }),
            prisma.cell.count({ where })
        ]);

        res.json({ success: true, data: cells, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar células.' });
    }
});

// GET /api/v1/celulas/:id
router.get('/:id', requirePermission('read_celulas'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const cell = await prisma.cell.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            include: {
                generation: { select: { id: true, name: true } },
                _count: { select: { people: true } }
            }
        });
        if (!cell) return res.status(404).json({ success: false, error: 'Célula não encontrada.' });

        const [lider, vice] = await Promise.all([
            buildLeaderInfo(cell.leaderId),
            buildLeaderInfo(cell.viceLeaderId)
        ]);

        res.json({ success: true, data: { ...cell, lider, vice } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar célula.' });
    }
});

// GET /api/v1/celulas/:id/membros
router.get('/:id/membros', requirePermission('read_celulas'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const cell = await prisma.cell.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true, name: true }
        });
        if (!cell) return res.status(404).json({ success: false, error: 'Célula não encontrada.' });

        const { page = 1, limit = 100 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [people, total] = await Promise.all([
            prisma.person.findMany({
                where: { cellId: req.params.id, organizationId: orgId },
                skip,
                take: parseInt(limit),
                select: {
                    id: true, name: true, phone: true, email: true,
                    birthdate: true, status: true, address: true, createdAt: true
                },
                orderBy: { name: 'asc' }
            }),
            prisma.person.count({ where: { cellId: req.params.id, organizationId: orgId } })
        ]);

        res.json({
            success: true,
            data: people,
            meta: { total, page: parseInt(page), limit: parseInt(limit), celula: cell }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar membros da célula.' });
    }
});

// GET /api/v1/celulas/:id/contatos-notificacao
router.get('/:id/contatos-notificacao', requirePermission('read_celulas'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const cell = await prisma.cell.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            include: { generation: { select: { id: true, name: true } } }
        });
        if (!cell) return res.status(404).json({ success: false, error: 'Célula não encontrada.' });

        const [lider, vice, lidoresGeracao, supervisores] = await Promise.all([
            buildLeaderInfo(cell.leaderId),
            buildLeaderInfo(cell.viceLeaderId),
            cell.generationId ? prisma.user.findMany({
                where: { organizationId: orgId, role: 'LIDER_GERACAO', generationId: cell.generationId },
                select: { id: true, name: true, person: { select: { phone: true } } }
            }) : Promise.resolve([]),
            prisma.user.findMany({
                where: { organizationId: orgId, role: 'SUPERVISOR' },
                select: { id: true, name: true, person: { select: { phone: true } } }
            })
        ]);

        res.json({
            success: true,
            data: {
                celula: { id: cell.id, name: cell.name, generation: cell.generation },
                lider,
                vice,
                liderGeracao: lidoresGeracao.map(u => ({ id: u.id, name: u.name, phone: u.person?.phone || null })),
                supervisores: supervisores.map(u => ({ id: u.id, name: u.name, phone: u.person?.phone || null }))
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar contatos de notificação.' });
    }
});

module.exports = router;
