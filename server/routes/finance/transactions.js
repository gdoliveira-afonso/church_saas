const express = require('express');
const prisma = require('../../lib/prisma');
const { hasFinanceAccess } = require('../../lib/financeAccess');

const router = express.Router();

// ---------------------------------------------------------------------------
// Select padrão para lançamentos
// ---------------------------------------------------------------------------
const TXN_SELECT = {
  id: true, type: true, description: true, amount: true, date: true,
  paymentMethod: true, referenceType: true, notes: true,
  createdAt: true, deletedAt: true,
  account:      { select: { id: true, name: true } },
  chartAccount: { select: { id: true, name: true, code: true } },
  fund:         { select: { id: true, name: true, color: true } },
  registeredBy: { select: { id: true, name: true } }
};

// ---------------------------------------------------------------------------
// GET / — lista lançamentos com filtros e paginação
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const {
      type, accountId, fundId, chartAccountId,
      from, to, search,
      page = '1', limit = '50'
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const where = {
      organizationId: orgId,
      deletedAt: null
    };

    if (type)           where.type           = type;
    if (accountId)      where.accountId      = accountId;
    if (fundId)         where.fundId         = fundId;
    if (chartAccountId) where.chartAccountId = chartAccountId;

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to)   where.date.lte = to;
    }

    if (search) {
      where.description = { contains: search };
    }

    const [data, total] = await Promise.all([
      prisma.financialTransaction.findMany({
        where,
        select: TXN_SELECT,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limitNum
      }),
      prisma.financialTransaction.count({ where })
    ]);

    res.json({
      data,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (err) {
    console.error('[Transactions GET /]', err);
    res.status(500).json({ error: 'Erro ao listar lançamentos' });
  }
});

// ---------------------------------------------------------------------------
// POST / — cria lançamento manual
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem acesso ao módulo financeiro' });

  try {
    const orgId = req.orgId;
    const {
      accountId, type, description, amount, date,
      chartAccountId, fundId, paymentMethod, notes, competenceDate, referenceType
    } = req.body;

    // Validações obrigatórias
    if (!accountId)   return res.status(400).json({ error: 'accountId é obrigatório' });
    if (!type)        return res.status(400).json({ error: 'type é obrigatório' });
    if (!description) return res.status(400).json({ error: 'description é obrigatório' });
    if (!amount)      return res.status(400).json({ error: 'amount é obrigatório' });
    if (!date)        return res.status(400).json({ error: 'date é obrigatório' });

    if (!['RECEITA', 'DESPESA'].includes(type)) {
      return res.status(400).json({ error: 'type deve ser RECEITA ou DESPESA' });
    }

    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount deve ser um inteiro positivo em centavos' });
    }

    // Verifica que accountId pertence à org
    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, organizationId: orgId, deletedAt: null }
    });
    if (!account) return res.status(400).json({ error: 'Conta não encontrada nesta organização' });

    // Verifica chartAccountId se fornecido
    if (chartAccountId) {
      const chartAccount = await prisma.chartOfAccount.findFirst({
        where: { id: chartAccountId, organizationId: orgId }
      });
      if (!chartAccount) return res.status(400).json({ error: 'Plano de contas não encontrado nesta organização' });
    }

    // Verifica fundId se fornecido
    if (fundId) {
      const fund = await prisma.fund.findFirst({
        where: { id: fundId, organizationId: orgId }
      });
      if (!fund) return res.status(400).json({ error: 'Fundo não encontrado nesta organização' });
    }

    const txn = await prisma.financialTransaction.create({
      data: {
        organizationId:  orgId,
        accountId,
        type,
        description,
        amount,
        date,
        chartAccountId:  chartAccountId  || null,
        fundId:          fundId          || null,
        paymentMethod:   paymentMethod   || null,
        notes:           notes           || null,
        competenceDate:  competenceDate  || null,
        referenceType:   referenceType   || 'MANUAL',
        registeredById:  req.user.id
      },
      select: TXN_SELECT
    });

    res.status(201).json(txn);
  } catch (err) {
    console.error('[Transactions POST /]', err);
    res.status(500).json({ error: 'Erro ao criar lançamento' });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — detalhes de um lançamento
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const txn = await prisma.financialTransaction.findFirst({
      where: { id: req.params.id, organizationId: orgId, deletedAt: null },
      select: TXN_SELECT
    });
    if (!txn) return res.status(404).json({ error: 'Lançamento não encontrado' });
    res.json(txn);
  } catch (err) {
    console.error('[Transactions GET /:id]', err);
    res.status(500).json({ error: 'Erro ao buscar lançamento' });
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — edita lançamento
// ---------------------------------------------------------------------------
router.put('/:id', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem acesso ao módulo financeiro' });

  try {
    const orgId = req.orgId;

    const existing = await prisma.financialTransaction.findFirst({
      where: { id: req.params.id, organizationId: orgId, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ error: 'Lançamento não encontrado' });

    // Lançamentos vinculados (BILL ou DONATION) são imutáveis
    if (existing.referenceType === 'BILL' || existing.referenceType === 'DONATION') {
      return res.status(409).json({
        error: `Lançamentos do tipo "${existing.referenceType}" são gerados automaticamente e não podem ser editados manualmente`
      });
    }

    const {
      description, amount, date,
      chartAccountId, fundId, paymentMethod, notes, competenceDate
    } = req.body;

    const data = {};

    if (description  !== undefined) data.description  = description;
    if (date         !== undefined) data.date         = date;
    if (paymentMethod!== undefined) data.paymentMethod= paymentMethod;
    if (notes        !== undefined) data.notes        = notes;
    if (competenceDate!== undefined) data.competenceDate = competenceDate;

    if (amount !== undefined) {
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ error: 'amount deve ser um inteiro positivo em centavos' });
      }
      data.amount = amount;
    }

    if (chartAccountId !== undefined) {
      if (chartAccountId !== null) {
        const chartAccount = await prisma.chartOfAccount.findFirst({
          where: { id: chartAccountId, organizationId: orgId }
        });
        if (!chartAccount) return res.status(400).json({ error: 'Plano de contas não encontrado nesta organização' });
      }
      data.chartAccountId = chartAccountId;
    }

    if (fundId !== undefined) {
      if (fundId !== null) {
        const fund = await prisma.fund.findFirst({
          where: { id: fundId, organizationId: orgId }
        });
        if (!fund) return res.status(400).json({ error: 'Fundo não encontrado nesta organização' });
      }
      data.fundId = fundId;
    }

    const updated = await prisma.financialTransaction.update({
      where: { id: req.params.id },
      data,
      select: TXN_SELECT
    });

    res.json(updated);
  } catch (err) {
    console.error('[Transactions PUT /:id]', err);
    res.status(500).json({ error: 'Erro ao atualizar lançamento' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — soft-delete (apenas ADMIN/SUPERADMIN, apenas lançamentos MANUAL)
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem acesso ao módulo financeiro' });

  try {
    const orgId = req.orgId;
    const role  = req.user.role;

    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem deletar lançamentos' });
    }

    const existing = await prisma.financialTransaction.findFirst({
      where: { id: req.params.id, organizationId: orgId, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ error: 'Lançamento não encontrado' });

    if (existing.referenceType !== 'MANUAL') {
      return res.status(409).json({
        error: `Lançamentos do tipo "${existing.referenceType}" são automáticos e não podem ser deletados`
      });
    }

    await prisma.financialTransaction.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Transactions DELETE /:id]', err);
    res.status(500).json({ error: 'Erro ao deletar lançamento' });
  }
});

module.exports = router;
