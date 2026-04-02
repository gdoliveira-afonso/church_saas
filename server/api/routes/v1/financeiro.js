const express = require('express');
const router = express.Router();
const prisma = require('../../../lib/prisma');
const { requirePermission } = require('../../middleware/apiAuth');

function formatCurrency(centavos) {
    const value = (centavos / 100).toFixed(2);
    const [intPart, decPart] = value.split('.');
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `R$ ${formatted},${decPart}`;
}

async function checkFinancialEnabled(orgId, res) {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { financialEnabled: true }
    });
    if (!org?.financialEnabled) {
        res.status(403).json({ success: false, error: 'Módulo financeiro não habilitado para esta organização.' });
        return false;
    }
    return true;
}

// GET /api/v1/financeiro/doacoes
router.get('/doacoes', requirePermission('read_financeiro'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        if (!await checkFinancialEnabled(orgId, res)) return;

        const { from, to, type, page = 1, limit = 50 } = req.query;
        const where = { organizationId: orgId, deletedAt: null };
        if (from || to) {
            where.date = {};
            if (from) where.date.gte = from;
            if (to) where.date.lte = to;
        }
        if (type) where.type = type;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [donations, total] = await Promise.all([
            prisma.donation.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    person: { select: { id: true, name: true } },
                    fund: { select: { id: true, name: true } }
                },
                orderBy: { date: 'desc' }
            }),
            prisma.donation.count({ where })
        ]);

        const data = donations.map(d => ({
            id: d.id,
            type: d.type,
            amount: d.amount,
            amountFormatted: formatCurrency(d.amount),
            date: d.date,
            paymentMethod: d.paymentMethod || null,
            notes: d.notes || null,
            visitorName: d.visitorName || null,
            pessoa: d.person ? { id: d.person.id, name: d.person.name } : null,
            fundo: d.fund ? { id: d.fund.id, name: d.fund.name } : null,
            createdAt: d.createdAt
        }));

        res.json({ success: true, data, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar doações.' });
    }
});

module.exports = router;
