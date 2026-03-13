const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { hasFinanceAccess } = require('../../lib/financeAccess');

const FUND_SELECT = {
  id: true,
  name: true,
  description: true,
  color: true,
  ativo: true,
  createdAt: true,
  organizationId: true,
};

/**
 * Calcula o saldo de um fundo: soma RECEITA - DESPESA em FinancialTransaction
 * onde fundId = id e deletedAt IS NULL.
 */
async function calcFundBalance(fundId) {
  const txns = await prisma.financialTransaction.findMany({
    where: { fundId, deletedAt: null },
    select: { type: true, amount: true },
  });
  const income = txns.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
  return income - expense;
}

// GET / — lista fundos ativos da org com saldo calculado
router.get('/', async (req, res) => {
  try {
    const funds = await prisma.fund.findMany({
      where: { organizationId: req.orgId, ativo: true },
      select: FUND_SELECT,
      orderBy: { name: 'asc' },
    });
    const result = await Promise.all(
      funds.map(async f => ({
        ...f,
        balance: await calcFundBalance(f.id),
      }))
    );
    res.json(result);
  } catch (err) {
    console.error('GET /finance/funds', err);
    res.status(500).json({ error: 'Erro ao listar fundos' });
  }
});

// POST / — cria fundo [hasFinanceAccess]
router.post('/', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });

  try {
    const fund = await prisma.fund.create({
      data: {
        name,
        description: description || null,
        color: color || null,
        organizationId: req.orgId,
      },
      select: FUND_SELECT,
    });
    res.status(201).json(fund);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Já existe um fundo com esse nome nesta organização' });
    }
    console.error('POST /finance/funds', err);
    res.status(500).json({ error: 'Erro ao criar fundo' });
  }
});

// GET /:id — detalhes + saldo do fundo
router.get('/:id', async (req, res) => {
  try {
    const fund = await prisma.fund.findFirst({
      where: { id: req.params.id, organizationId: req.orgId },
      select: FUND_SELECT,
    });
    if (!fund) return res.status(404).json({ error: 'Fundo não encontrado' });

    const balance = await calcFundBalance(fund.id);
    res.json({ ...fund, balance });
  } catch (err) {
    console.error('GET /finance/funds/:id', err);
    res.status(500).json({ error: 'Erro ao buscar fundo' });
  }
});

// PUT /:id — edita name, description, color [hasFinanceAccess]
router.put('/:id', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const { name, description, color } = req.body;

  try {
    const existing = await prisma.fund.findFirst({
      where: { id: req.params.id, organizationId: req.orgId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Fundo não encontrado' });

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (color !== undefined) data.color = color;

    const fund = await prisma.fund.update({
      where: { id: req.params.id },
      data,
      select: FUND_SELECT,
    });

    const balance = await calcFundBalance(fund.id);
    res.json({ ...fund, balance });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Já existe um fundo com esse nome nesta organização' });
    }
    console.error('PUT /finance/funds/:id', err);
    res.status(500).json({ error: 'Erro ao editar fundo' });
  }
});

// PATCH /:id/toggle — inverte campo `ativo` [hasFinanceAccess]
router.patch('/:id/toggle', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  try {
    const existing = await prisma.fund.findFirst({
      where: { id: req.params.id, organizationId: req.orgId },
      select: { id: true, ativo: true },
    });
    if (!existing) return res.status(404).json({ error: 'Fundo não encontrado' });

    const fund = await prisma.fund.update({
      where: { id: req.params.id },
      data: { ativo: !existing.ativo },
      select: FUND_SELECT,
    });
    res.json(fund);
  } catch (err) {
    console.error('PATCH /finance/funds/:id/toggle', err);
    res.status(500).json({ error: 'Erro ao alternar status do fundo' });
  }
});

// DELETE /:id — deleta se não tiver transactions ou donations [hasFinanceAccess]
router.delete('/:id', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  try {
    const fund = await prisma.fund.findFirst({
      where: { id: req.params.id, organizationId: req.orgId },
      select: { id: true },
    });
    if (!fund) return res.status(404).json({ error: 'Fundo não encontrado' });

    const txCount = await prisma.financialTransaction.count({
      where: { fundId: req.params.id },
    });
    if (txCount > 0) {
      return res.status(409).json({ error: 'Não é possível excluir fundo com transações vinculadas' });
    }

    const donationCount = await prisma.donation.count({
      where: { fundId: req.params.id },
    });
    if (donationCount > 0) {
      return res.status(409).json({ error: 'Não é possível excluir fundo com doações vinculadas' });
    }

    await prisma.fund.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /finance/funds/:id', err);
    res.status(500).json({ error: 'Erro ao excluir fundo' });
  }
});

module.exports = router;
