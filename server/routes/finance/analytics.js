const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { hasFinanceAccess } = require('../../lib/financeAccess');

// Middleware para garantir que apenas quem tem acesso financeiro possa ver analytics
router.use((req, res, next) => {
    if (!hasFinanceAccess(req)) {
        return res.status(403).json({ error: 'Acesso negado aos analytics financeiros.' });
    }
    next();
});

// GET /retention — Análise de Churn e Retenção
router.get('/retention', async (req, res) => {
    try {
        const orgId = req.orgId;
        const now = new Date();
        const currentMonthStr = now.toISOString().substring(0, 7); // YYYY-MM
        
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthStr = prevMonth.toISOString().substring(0, 7);

        // Busca doações dos últimos 2 meses (apenas contribuintes identificados)
        const currentDonations = await prisma.donation.findMany({
            where: {
                organizationId: orgId,
                date: { startsWith: currentMonthStr },
                personId: { not: null },
                deletedAt: null
            },
            select: { personId: true, amount: true }
        });

        const prevDonations = await prisma.donation.findMany({
            where: {
                organizationId: orgId,
                date: { startsWith: prevMonthStr },
                personId: { not: null },
                deletedAt: null
            },
            select: { personId: true, amount: true }
        });

        const currentGivers = new Set(currentDonations.map(d => d.personId));
        const prevGivers = new Set(prevDonations.map(d => d.personId));

        const loyalGivers = [...currentGivers].filter(id => prevGivers.has(id));
        const atRisk = [...prevGivers].filter(id => !currentGivers.has(id));
        const newGivers = [...currentGivers].filter(id => !prevGivers.has(id));

        // Para 'recovered', precisamos saber quem contribuiu agora mas estava inativo por > 60 dias
        // (Simplificando: não contribuiu nos 2 meses anteriores a este)
        const sixtyDaysAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().substring(0, 10);

        const recoveredCandidates = newGivers; // Só quem é "novo" em relação ao mês anterior pode ser reativado
        const recovered = [];

        for (const personId of recoveredCandidates) {
            const lastContrib = await prisma.donation.findFirst({
                where: {
                    organizationId: orgId,
                    personId: personId,
                    date: { lt: prevMonthStr + '-01' },
                    deletedAt: null
                },
                orderBy: { date: 'desc' }
            });

            if (lastContrib) {
                const lastDate = new Date(lastContrib.date);
                const diffTime = Math.abs(now - lastDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 60) {
                    recovered.push(personId);
                }
            }
        }

        // Filtra newGivers reais (que nunca contribuíram antes OU não são recovered)
        // Na verdade, o prompt pede 'new_givers' como primeira contribuição registrada em M.
        const trulyNew = [];
        for (const personId of newGivers) {
            if (recovered.includes(personId)) continue;
            const previousAny = await prisma.donation.findFirst({
                where: {
                    organizationId: orgId,
                    personId: personId,
                    date: { lt: currentMonthStr + '-01' },
                    deletedAt: null
                }
            });
            if (!previousAny) trulyNew.push(personId);
        }

        res.json({
            summary: {
                loyal_givers: loyalGivers.length,
                at_risk: atRisk.length,
                recovered: recovered.length,
                new_givers: trulyNew.length
            },
            details: {
                loyalGivers,
                atRisk,
                recovered,
                newGivers: trulyNew
            }
        });

    } catch (err) {
        console.error('[Analytics Retention Error]:', err);
        res.status(500).json({ error: 'Erro ao processar retenção' });
    }
});

// GET /seasonality — BI de Sazonalidade
router.get('/seasonality', async (req, res) => {
    try {
        const orgId = req.orgId;

        // Média por dia da semana (extrato de DOW do PostgreSQL)
        const dowStats = await prisma.$queryRaw`
            SELECT 
                EXTRACT(DOW FROM CAST("date" AS DATE)) as dow,
                AVG(amount) as average_amount,
                SUM(amount) as total_amount,
                COUNT(*) as count
            FROM "FinancialTransaction"
            WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL AND "type" = 'RECEITA'
            GROUP BY dow
            ORDER BY dow ASC
        `;

        // Média por período do mês (1-10, 11-20, 21-31)
        const periodStats = await prisma.$queryRaw`
            SELECT 
                CASE 
                    WHEN EXTRACT(DAY FROM CAST("date" AS DATE)) <= 10 THEN '1-10'
                    WHEN EXTRACT(DAY FROM CAST("date" AS DATE)) <= 20 THEN '11-20'
                    ELSE '21-31'
                END as period,
                SUM(amount) as total_amount,
                COUNT(*) as count
            FROM "FinancialTransaction"
            WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL AND "type" = 'RECEITA'
            GROUP BY period
            ORDER BY period ASC
        `;

        // Top Meses (Maiores arrecadações históricas)
        const topMonths = await prisma.$queryRaw`
            SELECT 
                SUBSTRING("date" FROM 1 FOR 7) as month,
                SUM(amount) as total_amount
            FROM "FinancialTransaction"
            WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL AND "type" = 'RECEITA'
            GROUP BY month
            ORDER BY total_amount DESC
            LIMIT 12
        `;

        res.json({
            dayOfWeek: dowStats,
            monthlyPeriod: periodStats,
            topMonths: topMonths
        });

    } catch (err) {
        console.error('[Analytics Seasonality Error]:', err);
        res.status(500).json({ error: 'Erro ao buscar sazonalidade' });
    }
});

// GET /consolidated-member — Consolidado por Membro
router.get('/consolidated-member', async (req, res) => {
    try {
        const { personId, startDate, endDate } = req.query;
        const orgId = req.orgId;

        if (!personId) return res.status(400).json({ error: 'personId é obrigatório' });

        const where = {
            organizationId: orgId,
            personId: personId,
            deletedAt: null
        };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = startDate;
            if (endDate) where.date.lte = endDate;
        }

        const donations = await prisma.donation.findMany({
            where,
            orderBy: { date: 'desc' }
        });

        const totalDizimos = donations.filter(d => d.type === 'DIZIMO').reduce((s, d) => s + d.amount, 0);
        const totalOfertas = donations.filter(d => d.type !== 'DIZIMO').reduce((s, d) => s + d.amount, 0);

        res.json({
            totalDizimos,
            totalOfertas,
            totalGeneral: totalDizimos + totalOfertas,
            history: donations
        });

    } catch (err) {
        console.error('[Analytics Consolidated Member Error]:', err);
        res.status(500).json({ error: 'Erro ao buscar consolidado do membro' });
    }
});

// GET /dashboard-metrics — Métricas para o novo dashboard com Deltas
router.get('/dashboard-metrics', async (req, res) => {
    try {
        const orgId = req.orgId;
        const now = new Date();
        const currentMonthStr = now.toISOString().substring(0, 7);
        
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthStr = prevMonth.toISOString().substring(0, 7);

        // Receitas/Despesas Mês Atual
        const currentTxns = await prisma.financialTransaction.findMany({
            where: { organizationId: orgId, date: { startsWith: currentMonthStr }, deletedAt: null },
            select: { type: true, amount: true }
        });

        // Receitas/Despesas Mês Anterior
        const prevTxns = await prisma.financialTransaction.findMany({
            where: { organizationId: orgId, date: { startsWith: prevMonthStr }, deletedAt: null },
            select: { type: true, amount: true }
        });

        const incomeNow = currentTxns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
        const expenseNow = currentTxns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
        
        const incomePrev = prevTxns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
        const expensePrev = prevTxns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);

        const calcDelta = (now, prev) => {
            if (!prev) return now > 0 ? 100 : 0;
            return Math.round(((now - prev) / prev) * 100);
        };

        const incomeDelta = calcDelta(incomeNow, incomePrev);
        const expenseDelta = calcDelta(expenseNow, expensePrev);

        // Retenção resumida para gráfico
        const retentionData = await prisma.donation.findMany({
            where: { organizationId: orgId, date: { gte: prevMonthStr + '-01' }, personId: { not: null }, deletedAt: null },
            select: { personId: true, date: true }
        });

        const giversPrev = new Set(retentionData.filter(d => d.date.startsWith(prevMonthStr)).map(d => d.personId));
        const giversNow = new Set(retentionData.filter(d => d.date.startsWith(currentMonthStr)).map(d => d.personId));

        const newGivers = [...giversNow].filter(id => !giversPrev.has(id)).length;
        const lostGivers = [...giversPrev].filter(id => !giversNow.has(id)).length;

        res.json({
            income: { value: incomeNow, delta: incomeDelta },
            expense: { value: expenseNow, delta: expenseDelta },
            retention: { new: newGivers, lost: lostGivers },
            monthLabel: currentMonthStr
        });

    } catch (err) {
        console.error('[Analytics Dashboard Metrics Error]:', err);
        res.status(500).json({ error: 'Erro ao buscar métricas do dashboard' });
    }
});

module.exports = router;
