const express = require('express');
const router = express.Router();
const prisma = require('../../../lib/prisma');
const { requirePermission } = require('../../middleware/apiAuth');

// GET /api/v1/lideranca/contatos — todos os líderes da org com telefone
router.get('/contatos', requirePermission('read_membros'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const users = await prisma.user.findMany({
            where: {
                organizationId: orgId,
                role: { in: ['LEADER', 'VICE_LEADER', 'LIDER_GERACAO', 'SUPERVISOR'] }
            },
            select: { id: true, name: true, role: true, person: { select: { phone: true } } },
            orderBy: { name: 'asc' }
        });
        res.json({
            success: true,
            data: users.map(u => ({ id: u.id, name: u.name, role: u.role, phone: u.person?.phone || null }))
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar contatos de liderança.' });
    }
});

module.exports = router;
