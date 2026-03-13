const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { hasFinanceAccess } = require('../../lib/financeAccess');

const VALID_TYPES = ['CAIXA', 'CONTA_CORRENTE', 'POUPANCA', 'PIX', 'OUTRO'];

const ACCOUNT_SELECT = {
  id: true,
  name: true,
  type: true,
  bank: true,
  agency: true,
  accountNumber: true,
  initialBalance: true,
  ativo: true,
  createdAt: true,
  organizationId: true,
};

/**
 * Calcula o saldo atual de uma conta somando RECEITA e subtraindo DESPESA
 * sobre as transações não deletadas. Retorna initialBalance + income - expense.
 */
async function calcAccountBalance(accountId, initialBalance) {
  const txns = await prisma.financialTransaction.findMany({
    where: { accountId, deletedAt: null },
    select: { type: true, amount: true },
  });
  const income = txns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
  return initialBalance + income - expense;
}

// GET / — lista contas ativas da org com saldo calculado
router.get('/', async (req, res) => {
  try {
    const accounts = await prisma.financialAccount.findMany({
      where: { organizationId: req.orgId, deletedAt: null, ativo: true },
      select: ACCOUNT_SELECT,
      orderBy: { name: 'asc' },
    });

    const result = await Promise.all(
      accounts.map(async acc => ({
        ...acc,
        balance: await calcAccountBalance(acc.id, acc.initialBalance),
      }))
    );

    res.json(result);
  } catch (err) {
    console.error('GET /finance/accounts', err);
    res.status(500).json({ error: 'Erro ao listar contas' });
  }
});

// POST / — cria conta [hasFinanceAccess]
router.post('/', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const { name, type, bank, agency, accountNumber, initialBalance } = req.body;

  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type deve ser um de: ${VALID_TYPES.join(', ')}` });
  }

  try {
    const account = await prisma.financialAccount.create({
      data: {
        name,
        type,
        bank: bank || null,
        agency: agency || null,
        accountNumber: accountNumber || null,
        initialBalance: initialBalance ?? 0,
        organizationId: req.orgId,
      },
      select: ACCOUNT_SELECT,
    });
    res.status(201).json({ ...account, balance: account.initialBalance });
  } catch (err) {
    console.error('POST /finance/accounts', err);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

// GET /:id — detalhes + saldo calculado
router.get('/:id', async (req, res) => {
  try {
    const account = await prisma.financialAccount.findFirst({
      where: { id: req.params.id, organizationId: req.orgId, deletedAt: null },
      select: ACCOUNT_SELECT,
    });
    if (!account) return res.status(404).json({ error: 'Conta não encontrada' });

    const balance = await calcAccountBalance(account.id, account.initialBalance);
    res.json({ ...account, balance });
  } catch (err) {
    console.error('GET /finance/accounts/:id', err);
    res.status(500).json({ error: 'Erro ao buscar conta' });
  }
});

// PUT /:id — edita nome, type, bank, agency, accountNumber [hasFinanceAccess]
router.put('/:id', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const { name, type, bank, agency, accountNumber } = req.body;

  if (type && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type deve ser um de: ${VALID_TYPES.join(', ')}` });
  }

  try {
    const existing = await prisma.financialAccount.findFirst({
      where: { id: req.params.id, organizationId: req.orgId, deletedAt: null },
      select: { id: true, initialBalance: true },
    });
    if (!existing) return res.status(404).json({ error: 'Conta não encontrada' });

    const data = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (bank !== undefined) data.bank = bank;
    if (agency !== undefined) data.agency = agency;
    if (accountNumber !== undefined) data.accountNumber = accountNumber;

    const account = await prisma.financialAccount.update({
      where: { id: req.params.id },
      data,
      select: ACCOUNT_SELECT,
    });

    const balance = await calcAccountBalance(account.id, account.initialBalance);
    res.json({ ...account, balance });
  } catch (err) {
    console.error('PUT /finance/accounts/:id', err);
    res.status(500).json({ error: 'Erro ao editar conta' });
  }
});

// DELETE /:id — soft-delete; bloqueia se tiver transactions [hasFinanceAccess]
router.delete('/:id', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  try {
    const account = await prisma.financialAccount.findFirst({
      where: { id: req.params.id, organizationId: req.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!account) return res.status(404).json({ error: 'Conta não encontrada' });

    const txCount = await prisma.financialTransaction.count({
      where: { accountId: req.params.id },
    });
    if (txCount > 0) {
      return res.status(409).json({ error: 'Não é possível excluir conta com transações vinculadas' });
    }

    await prisma.financialAccount.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /finance/accounts/:id', err);
    res.status(500).json({ error: 'Erro ao excluir conta' });
  }
});

// GET /:id/statement — extrato com filtros ?from=&to=&limit=50
router.get('/:id/statement', async (req, res) => {
  try {
    const account = await prisma.financialAccount.findFirst({
      where: { id: req.params.id, organizationId: req.orgId, deletedAt: null },
      select: { id: true, name: true, initialBalance: true },
    });
    if (!account) return res.status(404).json({ error: 'Conta não encontrada' });

    const { from, to } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);

    const where = {
      accountId: req.params.id,
      organizationId: req.orgId,
      deletedAt: null,
    };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const transactions = await prisma.financialTransaction.findMany({
      where,
      select: {
        id: true,
        date: true,
        type: true,
        amount: true,
        description: true,
        paymentMethod: true,
        referenceType: true,
        fundId: true,
        createdAt: true,
        chartAccount: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });

    // Calcular saldo de abertura: tudo antes de `from`
    let openingBalance = account.initialBalance;
    if (from) {
      const preTxns = await prisma.financialTransaction.findMany({
        where: {
          accountId: req.params.id,
          organizationId: req.orgId,
          deletedAt: null,
          date: { lt: from },
        },
        select: { type: true, amount: true },
      });
      const preIncome = preTxns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
      const preExpense = preTxns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
      openingBalance = account.initialBalance + preIncome - preExpense;
    }

    // Running balance acumulado linha a linha
    let running = openingBalance;
    let totalIncome = 0;
    let totalExpense = 0;

    const rows = transactions.map(t => {
      if (t.type === 'RECEITA') {
        running += t.amount;
        totalIncome += t.amount;
      } else {
        running -= t.amount;
        totalExpense += t.amount;
      }
      return { ...t, runningBalance: running };
    });

    const closingBalance = running;

    res.json({
      account: { id: account.id, name: account.name },
      openingBalance,
      closingBalance,
      totalIncome,
      totalExpense,
      transactions: rows,
    });
  } catch (err) {
    console.error('GET /finance/accounts/:id/statement', err);
    res.status(500).json({ error: 'Erro ao gerar extrato' });
  }
});

module.exports = router;
