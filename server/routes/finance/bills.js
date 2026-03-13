const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { hasFinanceAccess } = require('../../lib/financeAccess');

const VALID_STATUSES = ['PENDENTE', 'PAGO', 'CANCELADO'];

const BILL_SELECT = {
  id: true,
  description: true,
  supplier: true,
  amount: true,
  dueDate: true,
  status: true,
  recurrence: true,
  notes: true,
  createdAt: true,
  chartAccount: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  payments: { select: { id: true, amount: true, paymentDate: true, paymentMethod: true } },
};

/**
 * Recalcula status como VENCIDO em JS sem alterar o banco.
 * Uma conta é VENCIDO se status === 'PENDENTE' e dueDate < hoje.
 */
function applyVencidoStatus(bill) {
  if (bill.status === 'PENDENTE') {
    const hoje = new Date().toISOString().split('T')[0];
    if (bill.dueDate < hoje) {
      return { ...bill, status: 'VENCIDO' };
    }
  }
  return bill;
}

// ─── GET /alerts — contas vencidas e a vencer em 7 dias ──────────────────────
// Deve vir antes de /:id para não ser capturado como parâmetro
router.get('/alerts', async (req, res) => {
  try {
    const hoje   = new Date().toISOString().split('T')[0];
    const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const [vencidasRaw, aVencerRaw] = await Promise.all([
      // Vencidas: dueDate < hoje AND status PENDENTE
      prisma.bill.findMany({
        where: {
          organizationId: req.orgId,
          deletedAt: null,
          status: 'PENDENTE',
          dueDate: { lt: hoje },
        },
        select: BILL_SELECT,
        orderBy: { dueDate: 'asc' },
      }),
      // A vencer: dueDate >= hoje AND dueDate <= em7dias AND status PENDENTE
      prisma.bill.findMany({
        where: {
          organizationId: req.orgId,
          deletedAt: null,
          status: 'PENDENTE',
          dueDate: { gte: hoje, lte: em7dias },
        },
        select: BILL_SELECT,
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    const vencidas = vencidasRaw.map(b => ({ ...b, status: 'VENCIDO' }));
    const aVencer  = aVencerRaw;

    const totalVencidoAmount = vencidas.reduce((s, b) => s + b.amount, 0);
    const totalAVencerAmount = aVencer.reduce((s, b) => s + b.amount, 0);

    res.json({ vencidas, aVencer, totalVencidoAmount, totalAVencerAmount });
  } catch (err) {
    console.error('GET /finance/bills/alerts', err);
    res.status(500).json({ error: 'Erro ao buscar alertas de contas' });
  }
});

// ─── GET / — lista contas a pagar com filtros e paginação ────────────────────
router.get('/', async (req, res) => {
  try {
    const { from, to, search } = req.query;
    const statusQuery = req.query.status;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 500);
    const skip  = (page - 1) * limit;

    const hoje = new Date().toISOString().split('T')[0];

    // status VENCIDO é calculado em JS — buscar como PENDENTE com filtro dueDate < hoje
    const isVencidoQuery = statusQuery === 'VENCIDO';

    const where = { organizationId: req.orgId, deletedAt: null };

    if (isVencidoQuery) {
      where.status = 'PENDENTE';
      where.dueDate = { lt: hoje };
    } else if (statusQuery && VALID_STATUSES.includes(statusQuery)) {
      where.status = statusQuery;
    }

    if (from || to) {
      where.dueDate = where.dueDate || {};
      if (from) where.dueDate.gte = from;
      if (to)   where.dueDate.lte = to;
    }

    if (search) {
      where.OR = [
        { description: { contains: search } },
        { supplier:    { contains: search } },
      ];
    }

    const [rawData, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        select: BILL_SELECT,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.bill.count({ where }),
    ]);

    // Recalcular status VENCIDO em JS
    const data = rawData.map(applyVencidoStatus);

    // Totais auxiliares: PENDENTE e VENCIDO no conjunto retornado
    const totalPendente = data
      .filter(b => b.status === 'PENDENTE')
      .reduce((s, b) => s + b.amount, 0);
    const totalVencido = data
      .filter(b => b.status === 'VENCIDO')
      .reduce((s, b) => s + b.amount, 0);

    res.json({ data, total, page, totalPages: Math.ceil(total / limit), totalPendente, totalVencido });
  } catch (err) {
    console.error('GET /finance/bills', err);
    res.status(500).json({ error: 'Erro ao listar contas a pagar' });
  }
});

// ─── POST / — cria conta a pagar [hasFinanceAccess] ──────────────────────────
router.post('/', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const { description, amount, dueDate, supplier, chartAccountId, notes, competenceDate, recurrence } = req.body;

  if (!description) return res.status(400).json({ error: 'description é obrigatório' });
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount deve ser um número positivo (em centavos)' });
  }
  if (!dueDate) return res.status(400).json({ error: 'dueDate é obrigatório (YYYY-MM-DD)' });

  try {
    const bill = await prisma.bill.create({
      data: {
        organizationId: req.orgId,
        description,
        amount,
        dueDate,
        supplier: supplier || null,
        chartAccountId: chartAccountId || null,
        notes: notes || null,
        competenceDate: competenceDate || null,
        recurrence: recurrence || null,
        status: 'PENDENTE',
        createdById: req.user.id,
      },
      select: BILL_SELECT,
    });
    res.status(201).json(bill);
  } catch (err) {
    console.error('POST /finance/bills', err);
    res.status(500).json({ error: 'Erro ao criar conta a pagar' });
  }
});

// ─── GET /:id — detalhes + payments ──────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const bill = await prisma.bill.findFirst({
      where: { id: req.params.id, organizationId: req.orgId, deletedAt: null },
      select: BILL_SELECT,
    });
    if (!bill) return res.status(404).json({ error: 'Conta não encontrada' });
    res.json(applyVencidoStatus(bill));
  } catch (err) {
    console.error('GET /finance/bills/:id', err);
    res.status(500).json({ error: 'Erro ao buscar conta' });
  }
});

// ─── PUT /:id — edita conta [hasFinanceAccess] ────────────────────────────────
router.put('/:id', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  try {
    const existing = await prisma.bill.findFirst({
      where: { id: req.params.id, organizationId: req.orgId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existing) return res.status(404).json({ error: 'Conta não encontrada' });

    if (existing.status !== 'PENDENTE') {
      return res.status(409).json({ error: 'Apenas contas com status PENDENTE podem ser editadas' });
    }

    const { description, supplier, amount, dueDate, chartAccountId, notes, recurrence } = req.body;

    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return res.status(400).json({ error: 'amount deve ser um número positivo (em centavos)' });
    }

    const data = {};
    if (description    !== undefined) data.description    = description;
    if (supplier       !== undefined) data.supplier       = supplier;
    if (amount         !== undefined) data.amount         = amount;
    if (dueDate        !== undefined) data.dueDate        = dueDate;
    if (chartAccountId !== undefined) data.chartAccountId = chartAccountId;
    if (notes          !== undefined) data.notes          = notes;
    if (recurrence     !== undefined) data.recurrence     = recurrence;

    const bill = await prisma.bill.update({
      where: { id: req.params.id },
      data,
      select: BILL_SELECT,
    });

    res.json(applyVencidoStatus(bill));
  } catch (err) {
    console.error('PUT /finance/bills/:id', err);
    res.status(500).json({ error: 'Erro ao editar conta' });
  }
});

// ─── DELETE /:id — soft-delete [apenas ADMIN] ────────────────────────────────
router.delete('/:id', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const role = req.user?.role;
  if (!['ADMIN', 'SUPERADMIN'].includes(role)) {
    return res.status(403).json({ error: 'Apenas administradores podem excluir contas a pagar' });
  }

  try {
    const bill = await prisma.bill.findFirst({
      where: { id: req.params.id, organizationId: req.orgId, deletedAt: null },
      select: { id: true, _count: { select: { payments: true } } },
    });
    if (!bill) return res.status(404).json({ error: 'Conta não encontrada' });

    if (bill._count.payments > 0) {
      return res.status(409).json({ error: 'Não é possível excluir conta com pagamentos registrados' });
    }

    await prisma.bill.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /finance/bills/:id', err);
    res.status(500).json({ error: 'Erro ao excluir conta' });
  }
});

// ─── POST /:id/pay — registra pagamento [hasFinanceAccess] ───────────────────
router.post('/:id/pay', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const { amount, paymentDate, accountId, paymentMethod, notes } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount deve ser um número positivo (em centavos)' });
  }
  if (!paymentDate) return res.status(400).json({ error: 'paymentDate é obrigatório (YYYY-MM-DD)' });
  if (!accountId)   return res.status(400).json({ error: 'accountId é obrigatório' });

  try {
    // 1. Buscar Bill (verificar orgId e deletedAt)
    const bill = await prisma.bill.findFirst({
      where: { id: req.params.id, organizationId: req.orgId, deletedAt: null },
      select: {
        id: true,
        description: true,
        amount: true,
        status: true,
        payments: { select: { amount: true } },
      },
    });
    if (!bill) return res.status(404).json({ error: 'Conta não encontrada' });

    // 2. Validar status
    if (bill.status === 'PAGO') {
      return res.status(409).json({ error: 'Esta conta já está totalmente paga' });
    }
    if (bill.status === 'CANCELADO') {
      return res.status(409).json({ error: 'Não é possível pagar uma conta cancelada' });
    }

    // 3. Calcular total já pago e validar amount
    const totalJaPago = bill.payments.reduce((s, p) => s + p.amount, 0);
    const saldoRestante = bill.amount - totalJaPago;

    if (amount > saldoRestante) {
      return res.status(400).json({
        error: `Valor do pagamento (${amount}) excede o saldo restante (${saldoRestante})`,
      });
    }

    // 4. Verificar que a conta financeira pertence à org
    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, organizationId: req.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!account) return res.status(400).json({ error: 'Conta financeira não encontrada nesta organização' });

    // 5. Transação atômica interativa
    const novoPago = totalJaPago + amount;
    const quitado  = novoPago >= bill.amount;

    const { payment, transaction, updatedBill } = await prisma.$transaction(async (tx) => {
      // a. Criar BillPayment
      const payment = await tx.billPayment.create({
        data: {
          billId: bill.id,
          amount,
          paymentDate,
          paymentMethod: paymentMethod || null,
          accountId,
          notes: notes || null,
          registeredById: req.user.id,
        },
        select: { id: true, amount: true, paymentDate: true, paymentMethod: true },
      });

      // b. Criar FinancialTransaction
      const transaction = await tx.financialTransaction.create({
        data: {
          organizationId: req.orgId,
          accountId,
          type: 'DESPESA',
          description: `Pagamento: ${bill.description}`,
          amount,
          date: paymentDate,
          paymentMethod: paymentMethod || null,
          referenceType: 'BILL',
          registeredById: req.user.id,
        },
        select: { id: true, amount: true, date: true, description: true },
      });

      // c. Atualizar BillPayment com transactionId
      await tx.billPayment.update({
        where: { id: payment.id },
        data: { transactionId: transaction.id },
      });

      // d. Se quitado, atualizar status da Bill
      let updatedBill = null;
      if (quitado) {
        updatedBill = await tx.bill.update({
          where: { id: bill.id },
          data: { status: 'PAGO' },
          select: { id: true, status: true, description: true, amount: true, dueDate: true },
        });
      } else {
        updatedBill = await tx.bill.findUnique({
          where: { id: bill.id },
          select: { id: true, status: true, description: true, amount: true, dueDate: true },
        });
      }

      return { payment: { ...payment, transactionId: transaction.id }, transaction, updatedBill };
    });

    res.status(201).json({ payment, transaction, bill: updatedBill });
  } catch (err) {
    console.error('POST /finance/bills/:id/pay', err);
    res.status(500).json({ error: 'Erro ao registrar pagamento' });
  }
});

module.exports = router;
