const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

// GET /api/logs — lista logs com filtros
router.get('/', async (req, res) => {
    try {
        const orgId = req.orgId;
        const { action, resource, userId, from, to, limit = 200 } = req.query;

        const where = { organizationId: orgId };
        if (action && action !== 'all') where.action = action;
        if (resource && resource !== 'all') where.resource = resource;
        if (userId) where.userId = userId;
        if (from || to) {
            where.createdAt = {};
            if (from && from.trim() !== '') where.createdAt.gte = new Date(from);
            if (to && to.trim() !== '') {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = toDate;
            }
        }

        const logs = await prisma.activityLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Math.min(parseInt(limit), 500),
        });

        res.json(logs);
    } catch (e) {
        console.error('ERRO /api/logs:', e);
        res.status(500).json({ error: 'Erro ao buscar logs', details: e.message });
    }
});

// DELETE /api/logs — limpa todos os logs (somente ADMIN/SUPERVISOR/SUPERADMIN)
router.delete('/', async (req, res) => {
    try {
        const allowedRoles = ['ADMIN', 'SUPERVISOR', 'SUPERADMIN'];
        if (!allowedRoles.includes(req.user?.role)) {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem limpar logs.' });
        }
        const orgId = req.orgId;
        await prisma.activityLog.deleteMany({ where: { organizationId: orgId } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao limpar logs' });
    }
});

module.exports = router;
