const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const { hasFinanceAccess } = require('../../lib/financeAccess');

const VALID_TYPES = ['RECEITA', 'DESPESA'];

const CATEGORY_SELECT = {
  id: true,
  code: true,
  name: true,
  type: true,
  parentId: true,
  ativo: true,
  organizationId: true,
};

// GET / — retorna plano de contas em árvore (pais + filhos aninhados)
router.get('/', async (req, res) => {
  try {
    const all = await prisma.chartOfAccount.findMany({
      where: { organizationId: req.orgId, ativo: true },
      select: CATEGORY_SELECT,
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });

    function buildTree(parentId = null) {
      return all
        .filter(c => c.parentId === parentId)
        .map(c => ({
          ...c,
          children: buildTree(c.id)
        }));
    }

    res.json(buildTree(null));
  } catch (err) {
    console.error('GET /finance/chart', err);
    res.status(500).json({ error: 'Erro ao listar plano de contas' });
  }
});

// POST / — cria categoria [hasFinanceAccess]
router.post('/', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const { name, type, code, parentId } = req.body;

  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  if (!type) return res.status(400).json({ error: 'type é obrigatório' });
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type deve ser RECEITA ou DESPESA` });
  }

  // Se parentId fornecido, verificar que pertence à mesma org
  if (parentId) {
    const parent = await prisma.chartOfAccount.findFirst({
      where: { id: parentId, organizationId: req.orgId },
      select: { id: true },
    });
    if (!parent) return res.status(404).json({ error: 'Categoria pai não encontrada' });
  }

  try {
    const category = await prisma.chartOfAccount.create({
      data: {
        name,
        type,
        code: code || null,
        parentId: parentId || null,
        organizationId: req.orgId,
      },
      select: CATEGORY_SELECT,
    });
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Já existe uma categoria com esse código nesta organização' });
    }
    console.error('POST /finance/chart', err);
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// PUT /:id — edita name, code, parentId [hasFinanceAccess]
router.put('/:id', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  const { name, code, parentId } = req.body;

  try {
    const existing = await prisma.chartOfAccount.findFirst({
      where: { id: req.params.id, organizationId: req.orgId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Categoria não encontrada' });

    // Verificar que o parentId pertence à mesma org, se fornecido
    if (parentId !== undefined && parentId !== null) {
      const parent = await prisma.chartOfAccount.findFirst({
        where: { id: parentId, organizationId: req.orgId },
        select: { id: true },
      });
      if (!parent) return res.status(404).json({ error: 'Categoria pai não encontrada' });

      // Impedir que uma categoria seja seu próprio pai
      if (parentId === req.params.id) {
        return res.status(400).json({ error: 'Uma categoria não pode ser pai de si mesma' });
      }
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code;
    if (parentId !== undefined) data.parentId = parentId;

    const category = await prisma.chartOfAccount.update({
      where: { id: req.params.id },
      data,
      select: CATEGORY_SELECT,
    });

    res.json(category);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Já existe uma categoria com esse código nesta organização' });
    }
    console.error('PUT /finance/chart/:id', err);
    res.status(500).json({ error: 'Erro ao editar categoria' });
  }
});

// PATCH /:id/toggle — inverte `ativo` [hasFinanceAccess]
router.patch('/:id/toggle', async (req, res) => {
  if (!hasFinanceAccess(req)) return res.status(403).json({ error: 'Sem permissão' });

  try {
    const existing = await prisma.chartOfAccount.findFirst({
      where: { id: req.params.id, organizationId: req.orgId },
      select: { id: true, ativo: true },
    });
    if (!existing) return res.status(404).json({ error: 'Categoria não encontrada' });

    const category = await prisma.chartOfAccount.update({
      where: { id: req.params.id },
      data: { ativo: !existing.ativo },
      select: CATEGORY_SELECT,
    });
    res.json(category);
  } catch (err) {
    console.error('PATCH /finance/chart/:id/toggle', err);
    res.status(500).json({ error: 'Erro ao alternar status da categoria' });
  }
});

module.exports = router;
