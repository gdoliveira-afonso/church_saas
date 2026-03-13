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

    // Saldo atual de cada conta (initialBalance + todas as txns sem deletedAt)
    const saldoPorConta = await Promise.all(allAccounts.map(async acc => {
      const txns = await prisma.financialTransaction.findMany({
        where: { accountId: acc.id, deletedAt: null },
        select: { type: true, amount: true }
      });
      const income  = txns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
      const expense = txns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
      return { id: acc.id, name: acc.name, type: acc.type, balance: acc.initialBalance + income - expense };
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
    const txns = await prisma.financialTransaction.findMany({
      where: { organizationId: orgId, deletedAt: null, date: { gte: from, lte: to } },
      select: {
        type: true, amount: true,
        chartAccount: { select: { id: true, name: true } }
      }
    });

    const incomeCategories  = groupByCategory(txns, 'RECEITA');
    const expenseCategories = groupByCategory(txns, 'DESPESA');
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
  const { from, to, personId } = req.query;

  if (!from || !to) return res.status(400).json({ error: 'from e to são obrigatórios' });

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
      const name = d.person?.name || 'Anônimo';
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

    const result = await Promise.all(funds.map(async fund => {
      const txns = await prisma.financialTransaction.findMany({
        where: {
          organizationId: orgId, fundId: fund.id, deletedAt: null,
          date: { gte: from, lte: to }
        },
        select: { type: true, amount: true }
      });
      const income  = txns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
      const expense = txns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
      return { ...fund, income, expense, balance: income - expense };
    }));

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
    const txns = await prisma.financialTransaction.findMany({
      where: { organizationId: orgId, deletedAt: null, date: { gte: from, lte: to } },
      select: {
        type: true, amount: true, date: true, paymentMethod: true,
        chartAccount: { select: { id: true, name: true } }
      }
    });

    // Agrupar por mês
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

    // Top 5 categorias
    const topIncome  = groupByCategory(txns, 'RECEITA').slice(0, 5);
    const topExpense = groupByCategory(txns, 'DESPESA').slice(0, 5);

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

module.exports = router;
