const express = require('express');
const router = express.Router();
const prisma = require('../../../lib/prisma');
const { requirePermission } = require('../../middleware/apiAuth');

// GET /api/v1/turmas
router.get('/', requirePermission('read_turmas'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = { organizationId: orgId };
        const [cells, total] = await Promise.all([
            prisma.cell.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: { generation: { select: { id: true, name: true } } },
                orderBy: { name: 'asc' }
            }),
            prisma.cell.count({ where })
        ]);
        res.json({ success: true, data: cells, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar turmas.' });
    }
});

module.exports = router;
