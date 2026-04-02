const express = require('express');
const router = express.Router();
const prisma = require('../../../lib/prisma');
const { requirePermission } = require('../../middleware/apiAuth');

// GET /api/v1/stats
router.get('/', requirePermission('read_membros'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;

        const [
            totalMembros,
            totalCelulas,
            celulasAtivas,
            totalEventos,
            membrosGrouped
        ] = await Promise.all([
            prisma.person.count({ where: { organizationId: orgId } }),
            prisma.cell.count({ where: { organizationId: orgId } }),
            prisma.cell.count({ where: { organizationId: orgId, status: 'ativa' } }),
            prisma.event.count({ where: { organizationId: orgId } }),
            prisma.person.groupBy({
                by: ['status'],
                where: { organizationId: orgId },
                _count: { status: true }
            })
        ]);

        const membrosPorStatus = {};
        membrosGrouped.forEach(g => { membrosPorStatus[g.status] = g._count.status; });

        res.json({
            success: true,
            data: {
                totalMembros,
                totalCelulas,
                celulasAtivas,
                totalEventos,
                membrosPorStatus
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas.' });
    }
});

module.exports = router;
