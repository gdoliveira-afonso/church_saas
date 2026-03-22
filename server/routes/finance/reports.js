const express = require('express');
const prisma  = require('../../lib/prisma');
const { hasFinanceAdminAccess } = require('../../lib/financeAccess');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helper: agrupa transações por categoria (chartAccount)
// ---------------------------------------------------------------------------
function groupByCategory(txns, type) {
  const map = {};
  txns.filter(t => t.type === type).forEach(t => {
    const key  = t.chartAccount?.id   || 'sem-categoria';
    const name = t.chartAccount?.name || 'Sem Categoria';
    if (!map[key]) map[key] = { id: key, name, amount: 0 };
    map[key].amount += t.amount;
  });
  return Object.values(map).sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// Helper: lista de meses "YYYY-MM" entre dois "YYYY-MM-DD"
// ---------------------------------------------------------------------------
function monthsBetween(from, to) {
  const months = [];
  const [sy, sm] = from.split('-').map(Number);
  const [ey, em] = to.split('-').map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

// ---------------------------------------------------------------------------
// GET /reports/dashboard
// KPIs do mês corrente + saldos por conta + alertas de contas a pagar
// ---------------------------------------------------------------------------
router.get('/dashboard', async (req, res) => {
  if (!hasFinanceAdminAccess(req)) return res.status(403).json({ error: 'Acesso negado' });

  const orgId = req.orgId;

  try {
    const hoje = new Date();
    const anoMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const from   = `${anoMes}-01`;
    const lastDay = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const to     = `${anoMes}-${String(lastDay).padStart(2, '0')}`;

    const [txnsMes, allAccounts, billsAlerts, donationsMes] = await Promise.all([
      prisma.financialTransaction.findMany({
        where: { organizationId: orgId, deletedAt: null, date: { gte: from, lte: to } },
        select: { type: true, amount: true }
      }),
      prisma.financialAccount.findMany({
        where: { organizationId: orgId, deletedAt: null, ativo: true },
        select: { id: true, name: true, type: true, initialBalance: true }
      }),
      prisma.bill.findMany({
        where: { organizationId: orgId, deletedAt: null, status: 'PENDENTE' },
        select: { dueDate: true, amount: true }
      }),
      prisma.donation.findMany({
        where: { organizationId: orgId, deletedAt: null, type: 'DIZIMO', date: { gte: from, lte: to } },
        select: { personId: true }
      })
    ]);

    const entradaMes   = txnsMes.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
    const saidaMes     = txnsMes.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
    const resultadoMes = entradaMes - saidaMes;

    // Saldo atual de cada conta — busca todas as txns em 1 query (elimina N+1)
    const allAccountIds = allAccounts.map(a => a.id);
    const allAccountTxns = allAccountIds.length > 0
      ? await prisma.financialTransaction.findMany({
          where: { accountId: { in: allAccountIds }, deletedAt: null },
          select: { accountId: true, type: true, amount: true },
        })
      : [];

    const accountBalanceMap = {};
    allAccountTxns.forEach(t => {
      if (!accountBalanceMap[t.accountId]) accountBalanceMap[t.accountId] = 0;
      accountBalanceMap[t.accountId] += t.type === 'RECEITA' ? t.amount : -t.amount;
    });

    const saldoPorConta = allAccounts.map(acc => ({
      id: acc.id, name: acc.name, type: acc.type,
      balance: acc.initialBalance + (accountBalanceMap[acc.id] || 0),
    }));

    const saldoTotal = saldoPorConta.reduce((s, a) => s + a.balance, 0);

    // Alertas de contas a pagar
    const hojeStr   = hoje.toISOString().split('T')[0];
    const em7dias   = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const contasVencidas  = billsAlerts.filter(b => b.dueDate < hojeStr).length;
    const contasVencer7d  = billsAlerts.filter(b => b.dueDate >= hojeStr && b.dueDate <= em7dias).length;

    // Dizimistas únicos no mês
    const totalDizimistas = new Set(donationsMes.map(d => d.personId).filter(Boolean)).size;

    // Dados para gráfico (últimos 6 meses)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const sixFrom = sixMonthsAgo.toISOString().split('T')[0];

    const chartTxns = await prisma.financialTransaction.findMany({
      where: { organizationId: orgId, deletedAt: null, date: { gte: sixFrom } },
      select: { type: true, amount: true, date: true }
    });

    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const byMonth = months.map(m => {
      const mTxns = chartTxns.filter(t => t.date.startsWith(m));
      return {
        month: m,
        income: mTxns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0),
        expense: mTxns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0)
      };
    });

    res.json({
      saldoTotal, entradaMes, saidaMes, resultadoMes,
      contasVencidas, contasVencer7d,
      totalDizimistas, saldoPorConta,
      byMonth
    });
  } catch (err) {
    console.error('[finance/reports] GET /dashboard', err);
    res.status(500).json({ error: 'Erro interno ao gerar dashboard financeiro' });
  }
});

// ---------------------------------------------------------------------------
// GET /reports/cash-flow?year=&month=   (alias: /cashflow)
// Fluxo de caixa mensal com saldo de abertura/fechamento e categorias
// ---------------------------------------------------------------------------
async function handleCashFlow(req, res) {
  if (!hasFinanceAdminAccess(req)) return res.status(403).json({ error: 'Acesso negado' });

  const orgId = req.orgId;
  const { from, to } = req.query;

  if (!from || !to) return res.status(400).json({ error: 'from e to são obrigatórios' });

  try {
    const months = monthsBetween(from, to);

    const txns = await prisma.financialTransaction.findMany({
      where: { organizationId: orgId, deletedAt: null, date: { gte: from, lte: to } },
      select: { type: true, amount: true, date: true }
    });

    const monthsData = months.map(m => {
      const monthTxns = txns.filter(t => t.date.startsWith(m));
      const receitas  = monthTxns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
      const despesas  = monthTxns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
      return { month: m, receitas, despesas };
    });

    res.json({ period: { from, to }, months: monthsData });
  } catch (err) {
    console.error('[finance/reports] GET /cash-flow', err);
    res.status(500).json({ error: 'Erro interno ao gerar fluxo de caixa' });
  }
}
router.get('/cash-flow', handleCashFlow);
router.get('/cashflow',  handleCashFlow);

// ---------------------------------------------------------------------------
// GET /reports/income-statement?from=&to=   (alias: /dre)
// DRE simplificado — receitas e despesas por categoria em intervalo livre
// ---------------------------------------------------------------------------
async function handleIncomeStatement(req, res) {
  if (!hasFinanceAdminAccess(req)) return res.status(403).json({ error: 'Acesso negado' });

  const orgId = req.orgId;
  const { from, to } = req.query;

  if (!from || !to) return res.status(400).json({ error: 'from e to são obrigatórios' });

  try {
    // DB-004: groupBy no banco em vez de carregar todas as transações em memória
    const grouped = await prisma.financialTransaction.groupBy({
      by: ['chartAccountId', 'type'],
      where: { organizationId: orgId, deletedAt: null, date: { gte: from, lte: to } },
      _sum: { amount: true },
    });

    // Busca nomes das categorias em 1 query
    const chartIds = [...new Set(grouped.filter(g => g.chartAccountId).map(g => g.chartAccountId))];
    const chartNames = chartIds.length > 0
      ? await prisma.chartOfAccount.findMany({ where: { id: { in: chartIds } }, select: { id: true, name: true } })
      : [];
    const chartNameMap = Object.fromEntries(chartNames.map(c => [c.id, c.name]));

    const toCategories = (type) => grouped
      .filter(g => g.type === type)
      .map(g => ({
        id:     g.chartAccountId || 'sem-categoria',
        name:   chartNameMap[g.chartAccountId] || 'Sem Categoria',
        amount: g._sum.amount ?? 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const incomeCategories  = toCategories('RECEITA');
    const expenseCategories = toCategories('DESPESA');
    const totalReceitas = incomeCategories.reduce((s, c) => s + c.amount, 0);
    const totalDespesas = expenseCategories.reduce((s, c) => s + c.amount, 0);

    res.json({
      period: { from, to },
      totalReceitas, totalDespesas,
      resultado: totalReceitas - totalDespesas,
      incomeCategories, expenseCategories
    });
  } catch (err) {
    console.error('[finance/reports] GET /income-statement', err);
    res.status(500).json({ error: 'Erro interno ao gerar DRE' });
  }
}
router.get('/income-statement', handleIncomeStatement);
router.get('/dre',              handleIncomeStatement);

// ---------------------------------------------------------------------------
// GET /reports/tithes?from=&to=&personId=   (alias: /dizimistas)
// Relatório de dízimos por membro com pivot mensal e status Regular/Irregular
// ---------------------------------------------------------------------------
async function handleTithes(req, res) {
  if (!hasFinanceAdminAccess(req)) return res.status(403).json({ error: 'Acesso negado' });

  const orgId = req.orgId;
  const { personId } = req.query;

  // Se não passar from/to, usa os últimos 12 meses como padrão
  const hoje = new Date();
  const defaultTo = hoje.toISOString().split('T')[0];
  const defaultFrom = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1).toISOString().split('T')[0];
  const from = req.query.from || defaultFrom;
  const to   = req.query.to   || defaultTo;

  try {
    const months = monthsBetween(from, to);

    const where = {
      organizationId: orgId,
      deletedAt: null,
      type: 'DIZIMO',
      date: { gte: from, lte: to },
      ...(personId ? { personId } : {})
    };

    const donations = await prisma.donation.findMany({
      where,
      select: {
        amount: true, date: true, personId: true,
        person: { select: { id: true, name: true } }
      }
    });

    // Agrupar por pessoa e por mês
    const byPerson = {};
    donations.forEach(d => {
      const pid  = d.personId || 'anonimo';
      const name = d.person?.name || d.visitorName || 'Anônimo';
      const mon  = d.date.substring(0, 7);
      if (!byPerson[pid]) byPerson[pid] = { personId: pid, name, byMonth: {}, total: 0 };
      byPerson[pid].byMonth[mon] = (byPerson[pid].byMonth[mon] || 0) + d.amount;
      byPerson[pid].total += d.amount;
    });

    const donors = Object.values(byPerson)
      .sort((a, b) => b.total - a.total)
      .map(d => ({
        ...d,
        status: months.every(m => d.byMonth[m]) ? 'Regular' : 'Irregular'
      }));

    const totalMembers = await prisma.person.count({ where: { organizationId: orgId } });

    res.json({
      period: { from, to },
      months,
      totalDonors: donors.length,
      totalMembers,
      percentDonors: totalMembers > 0 ? +((donors.length / totalMembers) * 100).toFixed(1) : 0,
      totalAmount: donors.reduce((s, d) => s + d.total, 0),
      donors
    });
  } catch (err) {
    console.error('[finance/reports] GET /tithes', err);
    res.status(500).json({ error: 'Erro interno ao gerar relatório de dízimos' });
  }
}
router.get('/tithes',     handleTithes);
router.get('/dizimistas', handleTithes);

// ---------------------------------------------------------------------------
// GET /reports/by-fund?from=&to=
// Relatório de receitas e despesas agrupadas por fundo
// ---------------------------------------------------------------------------
router.get('/by-fund', async (req, res) => {
  if (!hasFinanceAdminAccess(req)) return res.status(403).json({ error: 'Acesso negado' });

  const orgId = req.orgId;
  const { from, to } = req.query;

  if (!from || !to) return res.status(400).json({ error: 'from e to são obrigatórios' });

  try {
    const funds = await prisma.fund.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, color: true, ativo: true }
    });

    // DB-004: 1 groupBy em vez de N+1 (uma query por fundo)
    const grouped = await prisma.financialTransaction.groupBy({
      by: ['fundId', 'type'],
      where: {
        organizationId: orgId, deletedAt: null,
        date: { gte: from, lte: to },
        fundId: { in: funds.map(f => f.id) }
      },
      _sum: { amount: true },
    });

    const fundTotals = {};
    grouped.forEach(g => {
      if (!g.fundId) return;
      if (!fundTotals[g.fundId]) fundTotals[g.fundId] = { income: 0, expense: 0 };
      if (g.type === 'RECEITA') fundTotals[g.fundId].income  += g._sum.amount ?? 0;
      else                       fundTotals[g.fundId].expense += g._sum.amount ?? 0;
    });

    const result = funds.map(fund => {
      const t = fundTotals[fund.id] || { income: 0, expense: 0 };
      return { ...fund, income: t.income, expense: t.expense, balance: t.income - t.expense };
    });

    const totals = result.reduce(
      (s, f) => ({ income: s.income + f.income, expense: s.expense + f.expense, balance: s.balance + f.balance }),
      { income: 0, expense: 0, balance: 0 }
    );

    res.json({ period: { from, to }, funds: result, totals });
  } catch (err) {
    console.error('[finance/reports] GET /by-fund', err);
    res.status(500).json({ error: 'Erro interno ao gerar relatório por fundo' });
  }
});

// ---------------------------------------------------------------------------
// GET /reports/period?from=&to=   (alias: /period-summary)
// Resumo executivo do período, agrupado por mês + top categorias + bills
// ---------------------------------------------------------------------------
async function handlePeriod(req, res) {
  if (!hasFinanceAdminAccess(req)) return res.status(403).json({ error: 'Acesso negado' });

  const orgId = req.orgId;
  const { from, to } = req.query;

  if (!from || !to) return res.status(400).json({ error: 'from e to são obrigatórios' });

  try {
    // DB-004: txns sem join chartAccount + groupBy separado para top categorias
    const [txns, groupedByCat] = await Promise.all([
      prisma.financialTransaction.findMany({
        where: { organizationId: orgId, deletedAt: null, date: { gte: from, lte: to } },
        select: { type: true, amount: true, date: true, paymentMethod: true }
      }),
      prisma.financialTransaction.groupBy({
        by: ['chartAccountId', 'type'],
        where: { organizationId: orgId, deletedAt: null, date: { gte: from, lte: to } },
        _sum: { amount: true },
      })
    ]);

    // Agrupar por mês (em JS — dados já limitados pelo período do usuário)
    const byMonthMap = {};
    txns.forEach(t => {
      const m = t.date.substring(0, 7);
      if (!byMonthMap[m]) byMonthMap[m] = { month: m, income: 0, expense: 0 };
      if (t.type === 'RECEITA') byMonthMap[m].income  += t.amount;
      else                       byMonthMap[m].expense += t.amount;
    });
    const byMonth = Object.values(byMonthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({ ...m, result: m.income - m.expense }));

    const totalIncome  = txns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
    const totalExpense = txns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);

    // Top 5 categorias via groupBy (sem carregar todas as transações com join)
    const topCatIds = [...new Set(groupedByCat.filter(g => g.chartAccountId).map(g => g.chartAccountId))];
    const topCatNames = topCatIds.length > 0
      ? await prisma.chartOfAccount.findMany({ where: { id: { in: topCatIds } }, select: { id: true, name: true } })
      : [];
    const topCatMap = Object.fromEntries(topCatNames.map(c => [c.id, c.name]));

    const toTopCat = (type) => groupedByCat
      .filter(g => g.type === type)
      .map(g => ({ id: g.chartAccountId || 'sem-categoria', name: topCatMap[g.chartAccountId] || 'Sem Categoria', amount: g._sum.amount ?? 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const topIncome  = toTopCat('RECEITA');
    const topExpense = toTopCat('DESPESA');

    // Agrupamento por forma de pagamento
    const byPayMap = {};
    txns.forEach(t => {
      const key = t.paymentMethod || 'OUTRO';
      if (!byPayMap[key]) byPayMap[key] = { method: key, amount: 0, count: 0 };
      byPayMap[key].amount += t.amount;
      byPayMap[key].count++;
    });
    const byPaymentMethod = Object.values(byPayMap).sort((a, b) => b.amount - a.amount);

    // Contas a pagar pendentes e em atraso
    const hojeStr = new Date().toISOString().split('T')[0];
    const [pendingBills, overdueList] = await Promise.all([
      prisma.bill.count({
        where: { organizationId: orgId, deletedAt: null, status: 'PENDENTE' }
      }),
      prisma.bill.findMany({
        where: { organizationId: orgId, deletedAt: null, status: 'PENDENTE', dueDate: { lt: hojeStr } },
        select: { amount: true }
      })
    ]);

    res.json({
      period: { from, to },
      totalReceitas: totalIncome, totalDespesas: totalExpense,
      resultado: totalIncome - totalExpense,
      transactionCount: txns.length,
      byMonth,
      byPaymentMethod,
      topIncomeCategories: topIncome,
      topExpenseCategories: topExpense,
      pendingBills,
      overdueAmount: overdueList.reduce((s, b) => s + b.amount, 0)
    });
  } catch (err) {
    console.error('[finance/reports] GET /period', err);
    res.status(500).json({ error: 'Erro interno ao gerar resumo executivo' });
  }
}
router.get('/period',         handlePeriod);
router.get('/period-summary', handlePeriod);

// ---------------------------------------------------------------------------
// GET /reports/person-timeline?personId=&period=&type=
// Histórico de contribuições de uma pessoa específica para gráfico
// ---------------------------------------------------------------------------
router.get('/person-timeline', async (req, res) => {
  if (!hasFinanceAdminAccess(req)) return res.status(403).json({ error: 'Acesso negado' });

  const orgId = req.orgId;
  const { personId, period = '1y', type = 'TODOS' } = req.query;

  if (!personId) return res.status(400).json({ error: 'personId é obrigatório' });

  try {
    const hoje = new Date();
    let monthsToFetch = 12;
    if (period === '3m') monthsToFetch = 3;
    else if (period === '6m') monthsToFetch = 6;
    else if (period === '9m') monthsToFetch = 9;
    else if (period === '2y') monthsToFetch = 24;
    else if (period === '3y') monthsToFetch = 36;

    const startDate = new Date(hoje.getFullYear(), hoje.getMonth() - (monthsToFetch - 1), 1);
    const startStr  = startDate.toISOString().split('T')[0];

    const where = {
      organizationId: orgId,
      personId: personId,
      deletedAt: null,
      date: { gte: startStr }
    };

    if (type !== 'TODOS') {
      where.type = type;
    }

    const donations = await prisma.donation.findMany({
      where,
      orderBy: { date: 'asc' },
      select: { amount: true, date: true, type: true }
    });

    // Gerar lista de meses para o gráfico
    const labels = [];
    const timelineMap = {};

    for (let i = 0; i < monthsToFetch; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      labels.push(mKey);
      timelineMap[mKey] = 0;
    }

    donations.forEach(d => {
      const m = d.date.substring(0, 7);
      if (timelineMap[m] !== undefined) {
        timelineMap[m] += d.amount;
      }
    });

    const data = labels.map(l => timelineMap[l]);

    res.json({
      personId,
      period,
      type,
      labels,
      data,
      total: data.reduce((s, v) => s + v, 0),
      count: donations.length,
      history: donations
    });
  } catch (err) {
    console.error('[finance/reports] GET /person-timeline', err);
    res.status(500).json({ error: 'Erro ao gerar linha do tempo individual' });
  }
});

const reportsService = require('../../lib/reports');

// ---------------------------------------------------------------------------
// GET /reports/pdf — Gera exportação PDF Timbrado (executivo, analitico, individual)
// ---------------------------------------------------------------------------
router.get('/pdf', async (req, res) => {
  if (!hasFinanceAdminAccess(req)) return res.status(403).json({ error: 'Acesso negado' });

  const orgId = req.orgId;
  const { mode, from, to, personId } = req.query;

  if (!mode || !['executive', 'analitico', 'individual'].includes(mode)) {
    return res.status(400).json({ error: 'Modo inválido. Use executive, analitico ou individual.' });
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, pastorName: true, congregationAddress: true, logoUrl: true }
    });

    let reportData = {
      organizationName: org.name,
      pastor: org.pastorName,
      address: org.congregationAddress,
      logoUrl: org.logoUrl,
      period: from && to ? `${from} até ${to}` : 'Período Geral'
    };

    if (mode === 'executive' || mode === 'analitico') {
      const start = from || '0000-00-00';
      const end = to || '9999-99-99';

      const txns = await prisma.financialTransaction.findMany({
        where: { organizationId: orgId, deletedAt: null, date: { gte: start, lte: end } },
        include: { chartAccount: { select: { id: true, name: true } } },
        orderBy: { date: 'asc' }
      });

      const income = txns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
      const expense = txns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);

      // Calculo de Delta (Mês anterior ao 'from')
      let incomeDelta = 0;
      let expenseDelta = 0;
      if (from) {
        const fromDate = new Date(from);
        const prevMonthFrom = new Date(fromDate.getFullYear(), fromDate.getMonth() - 1, 1).toISOString().substring(0, 10);
        const prevMonthTo = new Date(fromDate.getFullYear(), fromDate.getMonth(), 0).toISOString().substring(0, 10);
        
        const prevTxns = await prisma.financialTransaction.findMany({
          where: { organizationId: orgId, deletedAt: null, date: { gte: prevMonthFrom, lte: prevMonthTo } },
          select: { type: true, amount: true }
        });

        const prevIncome = prevTxns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
        const prevExpense = prevTxns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);

        const calcDelta = (now, prev) => prev > 0 ? Math.round(((now - prev) / prev) * 100) : (now > 0 ? 100 : 0);
        incomeDelta = calcDelta(income, prevIncome);
        expenseDelta = calcDelta(expense, prevExpense);
      }

      // Histórico para mini-chart (últimos 6 meses até 'to')
      const histTo = to || new Date().toISOString().substring(0, 10);
      const histEndDate = new Date(histTo);
      const histStartDate = new Date(histEndDate.getFullYear(), histEndDate.getMonth() - 5, 1);
      const histStartStr = histStartDate.toISOString().substring(0, 10);

      const historyTxns = await prisma.financialTransaction.findMany({
        where: { organizationId: orgId, deletedAt: null, date: { gte: histStartStr, lte: histTo } },
        select: { type: true, amount: true, date: true }
      });

      const months = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(histStartDate);
        d.setMonth(d.getMonth() + i);
        months.push(d.toISOString().substring(0, 7));
      }

      const history = months.map(m => {
        const mt = historyTxns.filter(t => t.date.startsWith(m));
        return {
          month: m,
          income: mt.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0),
          expense: mt.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0)
        };
      });

      reportData = {
        ...reportData,
        totalIncome: income,
        totalExpense: expense,
        netBalance: income - expense,
        incomeDelta,
        expenseDelta,
        incomeCategories: groupByCategory(txns, 'RECEITA'),
        expenseCategories: groupByCategory(txns, 'DESPESA'),
        history: history,
        transactions: txns.map(t => ({
          date: t.date,
          description: t.description,
          category: t.chartAccount?.name || 'Sem Categoria',
          amount: t.amount,
          type: t.type
        }))
      };
    } else if (mode === 'individual') {
      if (!personId) return res.status(400).json({ error: 'personId é necessário para modo individual' });
      
      const [person, donations] = await Promise.all([
        prisma.person.findUnique({ where: { id: personId }, select: { name: true } }),
        prisma.donation.findMany({
          where: { personId, organizationId: orgId, deletedAt: null, date: { gte: from || '0000', lte: to || '9999' } },
          orderBy: { date: 'desc' }
        })
      ]);

      if (!person) return res.status(404).json({ error: 'Pessoa não encontrada' });

      reportData = {
        ...reportData,
        memberName: person.name,
        donations: donations.map(d => ({ date: d.date, type: d.type, amount: d.amount })),
        totalAmount: donations.reduce((s, d) => s + d.amount, 0)
      };

      // Se houver período, gerar linha do tempo para o PDF
      const { period = '1y', type = 'TODOS' } = req.query;
      if (req.query.period) {
        const hoje = new Date();
        let monthsToFetch = 12;
        if (period === '3m') monthsToFetch = 3;
        else if (period === '6m') monthsToFetch = 6;
        else if (period === '9m') monthsToFetch = 9;
        else if (period === '2y') monthsToFetch = 24;
        else if (period === '3y') monthsToFetch = 36;

        const startDate = new Date(hoje.getFullYear(), hoje.getMonth() - (monthsToFetch - 1), 1);
        const labels = [];
        const timelineMap = {};
        for (let i = 0; i < monthsToFetch; i++) {
          const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          labels.push(mKey);
          timelineMap[mKey] = 0;
        }
        donations.forEach(d => {
          const m = d.date.substring(0, 7);
          if (timelineMap[m] !== undefined) timelineMap[m] += d.amount;
        });

        reportData.labels = labels;
        reportData.data = labels.map(l => timelineMap[l]);
        reportData.period = period;
      }
    }

    const pdfBuffer = await reportsService.generateFinancialReport(mode, reportData);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio_${mode}.pdf"`);
    res.send(pdfBuffer);

  } catch (err) {
    console.error('[finance/reports] GET /pdf', err);
    res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
});

module.exports = router;
