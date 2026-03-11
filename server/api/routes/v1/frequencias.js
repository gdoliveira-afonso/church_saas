const express = require('express');
const router = express.Router();
const prisma = require('../../../lib/prisma');
const { requirePermission } = require('../../middleware/apiAuth');

// GET /api/v1/frequencias
router.get('/', requirePermission('read_frequencia'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const { cellId, from, to, page = 1, limit = 50 } = req.query;
        const where = { organizationId: orgId };
        if (cellId) where.cellId = cellId;
        if (from) where.date = { gte: from };
        if (to) where.date = { ...where.date, lte: to };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [attendances, total] = await Promise.all([
            prisma.attendance.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    cell: { select: { id: true, name: true } },
                    records: { select: { personId: true, status: true } }
                },
                orderBy: { date: 'desc' }
            }),
            prisma.attendance.count({ where })
        ]);
        res.json({ success: true, data: attendances, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar frequências.' });
    }
});

module.exports = router;
