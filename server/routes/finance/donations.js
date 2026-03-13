const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { hasFinanceAccess } = require('../../lib/financeAccess');

const VALID_TYPES = ['DIZIMO', 'OFERTA', 'OFERTA_ESPECIAL', 'PRIMICIA', 'OUTRO'];

const TYPE_LABEL = {
  DIZIMO: 'Dízimo',
  OFERTA: 'Oferta',
  OFERTA_ESPECIAL: 'Oferta Especial',
  PRIMICIA: 'Primícia',
  OUTRO: 'Contribuição',
};

const DONATION_SELECT = {
  id: true,
  type: true,
  amount: true,
  date: true,
  paymentMethod: true,
  notes: true,
  createdAt: true,
  person: { select: { id: true, name: true } },
  batch:  { select: { id: true, name: true } },
  fund:   { select: { id: true, name: true, color: true } },
  registeredBy: { select: { id: true, name: true } },
};

// ─── GET /batches — lista lotes (deve vir antes de /:id) ───────────────────────
router.get('/batches', async (req, res) => {
  try {
    const batches = await prisma.donationBatch.findMany({
      where: { organizationId: req.orgId },
      select: {
        id: true,
        name: true,
        date: true,
        notes: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
        donations: { where: { deletedAt: null }, select: { amount: true } },
      },
      orderBy: { date: 'desc' },
    });
    // Calcula totalAmount e count dinamicamente a partir das doações reais
    const result = batches.map(b => ({
      id: b.id, name: b.name, date: b.date, notes: b.notes, createdAt: b.createdAt,
      createdBy: b.createdBy,
      totalAmount: b.donations.reduce((s, d) => s + d.amount, 0),
      _count: { donations: b.donations.length },
    }));
    res.json(result);
  } catch (err) {
    console.error('GET /finance/donations/batches', err);
    res.status(500).json({ error: 'Erro ao listar lotes' });
  }
});

// ─── POST /batches — cria lote [hasFinanceAccess] ─────────────────────────────
router.post('/batches', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const { name, date, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  if (!date) return res.status(400).json({ error: 'date é obrigatório' });

  try {
    const batch = await prisma.donationBatch.create({
      data: {
        name,
        date,
        notes: notes || null,
        organizationId: req.orgId,
        createdById: req.user.id,
      },
      select: {
        id: true,
        name: true,
        date: true,
        totalAmount: true,
        notes: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
        _count: { select: { donations: true } },
      },
    });
    res.status(201).json(batch);
  } catch (err) {
    console.error('POST /finance/donations/batches', err);
    res.status(500).json({ error: 'Erro ao criar lote' });
  }
});

// ─── GET /batches/:id — detalhes do lote com doações ─────────────────────────
router.get('/batches/:id', async (req, res) => {
  try {
    const batch = await prisma.donationBatch.findFirst({
      where: { id: req.params.id, organizationId: req.orgId },
      select: {
        id: true,
        name: true,
        date: true,
        totalAmount: true,
        notes: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
        donations: {
          where: { deletedAt: null },
          select: DONATION_SELECT,
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { donations: true } },
      },
    });
    if (!batch) return res.status(404).json({ error: 'Lote não encontrado' });
    res.json(batch);
  } catch (err) {
    console.error('GET /finance/donations/batches/:id', err);
    res.status(500).json({ error: 'Erro ao buscar lote' });
  }
});

// ─── GET /summary/person/:personId — histórico dizimista ─────────────────────
router.get('/summary/person/:personId', async (req, res) => {
  try {
    // Verificar que personId pertence à org
    const person = await prisma.person.findFirst({
      where: { id: req.params.personId, organizationId: req.orgId },
      select: { id: true, name: true },
    });
    if (!person) return res.status(404).json({ error: 'Pessoa não encontrada' });

    const donations = await prisma.donation.findMany({
      where: {
        personId: req.params.personId,
        organizationId: req.orgId,
        deletedAt: null,
      },
      select: { type: true, amount: true, date: true },
      orderBy: { date: 'asc' },
    });

    const totalDonations = donations.length;
    const totalAmount = donations.reduce((s, d) => s + d.amount, 0);

    // Agregar por tipo
    const byType = {};
    for (const t of VALID_TYPES) byType[t] = 0;
    for (const d of donations) {
      byType[d.type] = (byType[d.type] || 0) + d.amount;
    }

    // Agregar por mês — últimos 12 meses
    const hoje = new Date();
    const byMonthMap = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonthMap[key] = 0;
    }
    for (const d of donations) {
      const month = d.date.substring(0, 7); // "YYYY-MM"
      if (byMonthMap.hasOwnProperty(month)) {
        byMonthMap[month] += d.amount;
      }
    }
    const byMonth = Object.entries(byMonthMap).map(([month, amount]) => ({ month, amount }));

    res.json({ person, totalDonations, totalAmount, byType, byMonth });
  } catch (err) {
    console.error('GET /finance/donations/summary/person/:personId', err);
    res.status(500).json({ error: 'Erro ao buscar histórico dizimista' });
  }
});

// ─── GET / — lista doações com filtros e paginação ────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { personId, type, from, to, batchId } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 500);
    const skip  = (page - 1) * limit;

    const where = { organizationId: req.orgId, deletedAt: null };
    if (personId) where.personId = personId;
    if (type && VALID_TYPES.includes(type)) where.type = type;
    if (batchId) where.batchId = batchId;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to)   where.date.lte = to;
    }

    const [data, total] = await Promise.all([
      prisma.donation.findMany({
        where,
        select: DONATION_SELECT,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.donation.count({ where }),
    ]);

    res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('GET /finance/donations', err);
    res.status(500).json({ error: 'Erro ao listar doações' });
  }
});

// ─── POST / — registra doação [hasFinanceAccess] ──────────────────────────────
router.post('/', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const { type, amount, date, personId, batchId, fundId, paymentMethod, notes, accountId } = req.body;

  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type deve ser um de: ${VALID_TYPES.join(', ')}` });
  }
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount deve ser um número positivo (em centavos)' });
  }
  if (!date) return res.status(400).json({ error: 'date é obrigatório (YYYY-MM-DD)' });

  try {
    // Verificar que personId pertence à org
    let personName = 'Anônimo';
    if (personId) {
      const person = await prisma.person.findFirst({
        where: { id: personId, organizationId: req.orgId },
        select: { name: true },
      });
      if (!person) return res.status(400).json({ error: 'Pessoa não encontrada nesta organização' });
      personName = person.name;
    }

    // Resolver accountId: usar o fornecido ou buscar a primeira conta ativa da org
    let resolvedAccountId = accountId || null;
    if (!resolvedAccountId) {
      const firstAccount = await prisma.financialAccount.findFirst({
        where: { organizationId: req.orgId, deletedAt: null, ativo: true },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!firstAccount) {
        return res.status(400).json({ error: 'Nenhuma conta financeira ativa encontrada. Crie uma conta antes de registrar doações.' });
      }
      resolvedAccountId = firstAccount.id;
    }

    // Transação atômica interativa: criar FinancialTransaction → Donation (com transactionId vinculado)
    const result = await prisma.$transaction(async (tx) => {
      const txn = await tx.financialTransaction.create({
        data: {
          organizationId: req.orgId,
          accountId: resolvedAccountId,
          type: 'RECEITA',
          description: `${TYPE_LABEL[type]} - ${personName}`,
          amount,
          date,
          fundId: fundId || null,
          paymentMethod: paymentMethod || null,
          referenceType: 'DONATION',
          registeredById: req.user.id,
        },
        select: { id: true },
      });

      const donation = await tx.donation.create({
        data: {
          organizationId: req.orgId,
          type,
          amount,
          date,
          personId: personId || null,
          batchId: batchId || null,
          fundId: fundId || null,
          paymentMethod: paymentMethod || null,
          notes: notes || null,
          transactionId: txn.id,
          registeredById: req.user.id,
        },
        select: DONATION_SELECT,
      });

      return donation;
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('POST /finance/donations', err);
    res.status(500).json({ error: 'Erro ao registrar doação' });
  }
});

// ─── GET /:id — detalhes de uma doação ───────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const donation = await prisma.donation.findFirst({
      where: { id: req.params.id, organizationId: req.orgId, deletedAt: null },
      select: DONATION_SELECT,
    });
    if (!donation) return res.status(404).json({ error: 'Doação não encontrada' });
    res.json(donation);
  } catch (err) {
    console.error('GET /finance/donations/:id', err);
    res.status(500).json({ error: 'Erro ao buscar doação' });
  }
});

// ─── PUT /:id — edita doação [hasFinanceAccess] ───────────────────────────────
router.put('/:id', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const { notes, paymentMethod, fundId, amount, date, personId } = req.body;

  // Campos imutáveis após registro
  if (amount !== undefined || date !== undefined || personId !== undefined) {
    return res.status(409).json({ error: 'Não é permitido alterar amount, date ou personId após o registro' });
  }

  try {
    const existing = await prisma.donation.findFirst({
      where: { id: req.params.id, organizationId: req.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Doação não encontrada' });

    const data = {};
    if (notes !== undefined)         data.notes         = notes;
    if (paymentMethod !== undefined)  data.paymentMethod = paymentMethod;
    if (fundId !== undefined)         data.fundId        = fundId;

    const donation = await prisma.donation.update({
      where: { id: req.params.id },
      data,
      select: DONATION_SELECT,
    });

    res.json(donation);
  } catch (err) {
    console.error('PUT /finance/donations/:id', err);
    res.status(500).json({ error: 'Erro ao editar doação' });
  }
});

// ─── DELETE /:id — soft-delete [apenas ADMIN] ─────────────────────────────────
router.delete('/:id', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const role = req.user?.role;
  if (!['ADMIN', 'SUPERADMIN'].includes(role)) {
    return res.status(403).json({ error: 'Apenas administradores podem excluir doações' });
  }

  try {
    const donation = await prisma.donation.findFirst({
      where: { id: req.params.id, organizationId: req.orgId, deletedAt: null },
      select: { id: true, transactionId: true },
    });
    if (!donation) return res.status(404).json({ error: 'Doação não encontrada' });

    const now = new Date();
    const ops = [
      prisma.donation.update({
        where: { id: donation.id },
        data: { deletedAt: now },
      }),
    ];

    if (donation.transactionId) {
      ops.push(
        prisma.financialTransaction.update({
          where: { id: donation.transactionId },
          data: { deletedAt: now },
        })
      );
    }

    await prisma.$transaction(ops);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /finance/donations/:id', err);
    res.status(500).json({ error: 'Erro ao excluir doação' });
  }
});

module.exports = router;
