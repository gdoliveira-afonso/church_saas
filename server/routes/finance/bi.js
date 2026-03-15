const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { hasFinanceAccess } = require('../../lib/financeAccess');

// Middleware para garantir que apenas quem tem acesso financeiro possa ver BI
router.use((req, res, next) => {
    if (!hasFinanceAccess(req)) {
        return res.status(403).json({ error: 'Acesso negado aos dados de BI.' });
    }
    next();
});

// Solução definitiva para serialização de BigInt no JSON (necessário para queries raw do Prisma/SQLite)
if (!BigInt.prototype.toJSON) {
    BigInt.prototype.toJSON = function() { return Number(this); };
}

// GET /finance/bi/compare — Comparativo entre dois períodos
router.get('/compare', async (req, res) => {
    try {
        const { startA, endA, startB, endB } = req.query;
        const orgId = req.orgId;

        if (!startA || !endA || !startB || !endB) {
            return res.status(400).json({ error: 'Os dois períodos (A e B) são obrigatórios.' });
        }

        const fetchStats = async (start, end) => {
            const txns = await prisma.financialTransaction.findMany({
                where: { organizationId: orgId, deletedAt: null, date: { gte: start, lte: end } },
                select: { type: true, amount: true }
            });

            const donations = await prisma.donation.findMany({
                where: { organizationId: orgId, deletedAt: null, date: { gte: start, lte: end }, personId: { not: null } },
                select: { personId: true, amount: true }
            });

            const income = txns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
            const expense = txns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
            const giversCount = new Set(donations.map(d => d.personId)).size;

            return {
                income,
                expense,
                balance: income - expense,
                giversCount,
                avgContribution: giversCount > 0 ? Math.round(income / giversCount) : 0
            };
        };

        const statsA = await fetchStats(startA, endA);
        const statsB = await fetchStats(startB, endB);

        const calcVariation = (a, b) => a > 0 ? Math.round(((b - a) / a) * 100) : (b > 0 ? 100 : 0);

        res.json({
            periodA: statsA,
            periodB: statsB,
            variation: {
                income: calcVariation(statsA.income, statsB.income),
                expense: calcVariation(statsA.expense, statsB.expense),
                balance: statsB.balance - statsA.balance,
                giversCount: calcVariation(statsA.giversCount, statsB.giversCount)
            }
        });

    } catch (err) {
        console.error('[BI Compare Error]:', err);
        res.status(500).json({ error: 'Erro ao comparar períodos' });
    }
});

// GET /finance/bi/retention-details — Detalhes de quem ficou, parou ou começou
router.get('/retention-details', async (req, res) => {
    try {
        const { startA, endA, startB, endB } = req.query;
        const orgId = req.orgId;

        const getGivers = async (start, end) => {
            return await prisma.donation.findMany({
                where: { organizationId: orgId, deletedAt: null, date: { gte: start, lte: end }, personId: { not: null } },
                select: { personId: true, amount: true, person: { select: { name: true, phone: true } } }
            });
        };

        const donationsA = await getGivers(startA, endA);
        const donationsB = await getGivers(startB, endB);

        const mapA = new Map();
        donationsA.forEach(d => {
            const current = mapA.get(d.personId) || { id: d.personId, name: d.person.name, phone: d.person.phone, amount: 0 };
            current.amount += d.amount;
            mapA.set(d.personId, current);
        });

        const mapB = new Map();
        donationsB.forEach(d => {
            const current = mapB.get(d.personId) || { id: d.personId, name: d.person.name, phone: d.person.phone, amount: 0 };
            current.amount += d.amount;
            mapB.set(d.personId, current);
        });

        const idsA = new Set(mapA.keys());
        const idsB = new Set(mapB.keys());

        const fieis = [...idsB].filter(id => idsA.has(id)).map(id => ({ ...mapB.get(id), prevAmount: mapA.get(id).amount }));
        const adormecidos = [...idsA].filter(id => !idsB.has(id)).map(id => mapA.get(id));
        const novos = [...idsB].filter(id => !idsA.has(id)).map(id => mapB.get(id));

        res.json({ fieis, adormecidos, novos });

    } catch (err) {
        console.error('[BI Retention Details Error]:', err);
        res.status(500).json({ error: 'Erro ao carregar detalhes de retenção' });
    }
});

// GET /finance/bi/highs — Recordes históricos
router.get('/highs', async (req, res) => {
    try {
        const orgId = req.orgId;

        // Mês mais rentável (Agrupado por YYYY-MM)
        const topMonths = await prisma.$queryRaw`
            SELECT 
                SUBSTR("date", 1, 7) as month,
                SUM(amount) as total
            FROM "FinancialTransaction"
            WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL AND "type" = 'RECEITA'
            GROUP BY month
            ORDER BY total DESC
            LIMIT 1
        `;

        // Mês menos rentável (Agrupado por YYYY-MM)
        const bottomMonths = await prisma.$queryRaw`
            SELECT 
                SUBSTR("date", 1, 7) as month,
                SUM(amount) as total
            FROM "FinancialTransaction"
            WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL AND "type" = 'RECEITA'
            GROUP BY month
            ORDER BY total ASC
            LIMIT 1
        `;

        res.json({
            topMonth: topMonths[0],
            bottomMonth: bottomMonths[0]
        });

    } catch (err) {
        console.error('[BI Highs Error]:', err);
        res.status(500).json({ error: 'Erro ao carregar recordes' });
    }
});

module.exports = router;
