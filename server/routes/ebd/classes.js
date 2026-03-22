const express = require('express');
const prisma = require('../../lib/prisma');
const { hasEbdAdminAccess, hasEbdStrictAdminAccess } = require('../../lib/permissions');

const router = express.Router();

const EBD_CLASS_SELECT = {
    id: true, name: true, faixaEtaria: true, sala: true,
    professorId: true, segundoProfessorId: true, terceiroProfessorId: true, ativo: true,
    organizationId: true, createdAt: true, updatedAt: true
};

// GET /api/ebd/classes — lista classes da organização
router.get('/classes', async (req, res) => {
    try {
        const orgId = req.orgId;
        const isProfessorOnly = !hasEbdAdminAccess(req);
        const professorFilter = isProfessorOnly
            ? { OR: [{ professorId: req.user.id }, { segundoProfessorId: req.user.id }, { terceiroProfessorId: req.user.id }] }
            : {};
        const classes = await prisma.ebdClass.findMany({
            where: { organizationId: orgId, ativo: true, ...professorFilter },
            select: {
                ...EBD_CLASS_SELECT,
                professor: { select: { id: true, name: true } },
                segundoProfessor: { select: { id: true, name: true } },
                terceiroProfessor: { select: { id: true, name: true } },
                _count: { select: { students: true } }
            },
            orderBy: { name: 'asc' }
        });
        res.json(classes);
    } catch (error) {
        console.error('[EBD] Erro ao listar classes:', error.message);
        res.status(500).json({ error: 'Erro ao listar classes da EBD' });
    }
});

// POST /api/ebd/classes — cria nova classe (ADMIN, SUPERVISOR)
router.post('/classes', async (req, res) => {
    const { name, faixaEtaria, professorId, segundoProfessorId, terceiroProfessorId, sala } = req.body;
    const orgId = req.orgId;

    if (!hasEbdAdminAccess(req)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores e supervisores.' });
    }
    if (!name) return res.status(400).json({ error: 'Nome da classe é obrigatório' });

    try {
        const classe = await prisma.ebdClass.create({
            data: {
                name,
                faixaEtaria: faixaEtaria || null,
                professorId: professorId || null,
                segundoProfessorId: segundoProfessorId || null,
                terceiroProfessorId: terceiroProfessorId || null,
                sala: sala || null,
                organizationId: orgId,
                ativo: true
            },
            select: EBD_CLASS_SELECT
        });
        res.status(201).json(classe);
        if (req.log) req.log('CREATE', 'ebd_classes', classe.id, classe.name);
    } catch (error) {
        console.error('[EBD] Erro ao criar classe:', error.message);
        res.status(500).json({ error: 'Erro ao criar classe da EBD' });
    }
});

// GET /api/ebd/classes/:id — detalhe da classe
router.get('/classes/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: {
                id: true, name: true, faixaEtaria: true, sala: true,
                professorId: true, segundoProfessorId: true, terceiroProfessorId: true, ativo: true,
                organizationId: true, createdAt: true, updatedAt: true,
                professor: { select: { id: true, name: true, username: true, role: true } },
                segundoProfessor: { select: { id: true, name: true, username: true, role: true } },
                terceiroProfessor: { select: { id: true, name: true, username: true, role: true } },
                students: { select: { id: true, personId: true, dataMatricula: true, ativo: true, person: true } },
                attendances: { orderBy: { data: 'desc' } }
            }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });
        res.json(classe);
    } catch (error) {
        console.error('[EBD] Erro ao buscar classe:', error.message);
        res.status(500).json({ error: 'Erro ao buscar classe da EBD' });
    }
});

// PUT /api/ebd/classes/:id — atualiza classe (ADMIN, SUPERVISOR)
router.put('/classes/:id', async (req, res) => {
    const { name, faixaEtaria, professorId, segundoProfessorId, terceiroProfessorId, sala, ativo } = req.body;
    const orgId = req.orgId;

    if (!hasEbdAdminAccess(req)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores e supervisores.' });
    }

    try {
        const existing = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true }
        });
        if (!existing) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const classe = await prisma.ebdClass.update({
            where: { id: req.params.id },
            data: {
                ...(name !== undefined && { name }),
                ...(faixaEtaria !== undefined && { faixaEtaria }),
                ...(professorId !== undefined && { professorId: professorId || null }),
                ...(segundoProfessorId !== undefined && { segundoProfessorId: segundoProfessorId || null }),
                ...(terceiroProfessorId !== undefined && { terceiroProfessorId: terceiroProfessorId || null }),
                ...(sala !== undefined && { sala }),
                ...(ativo !== undefined && { ativo })
            },
            select: EBD_CLASS_SELECT
        });
        res.json(classe);
        if (req.log) req.log('UPDATE', 'ebd_classes', classe.id, classe.name);
    } catch (error) {
        console.error('[EBD] Erro ao atualizar classe:', error.message);
        res.status(500).json({ error: 'Erro ao atualizar classe da EBD' });
    }
});

// DELETE /api/ebd/classes/:id — desativa classe (soft delete) (ADMIN)
router.delete('/classes/:id', async (req, res) => {
    const orgId = req.orgId;

    if (!hasEbdStrictAdminAccess(req)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }

    try {
        const existing = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { name: true }
        });
        if (!existing) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        await prisma.ebdClass.update({
            where: { id: req.params.id },
            data: { ativo: false },
            select: { id: true }
        });
        res.json({ success: true });
        if (req.log) req.log('DELETE', 'ebd_classes', req.params.id, existing.name);
    } catch (error) {
        console.error('[EBD] Erro ao desativar classe:', error.message);
        res.status(500).json({ error: 'Erro ao desativar classe da EBD' });
    }
});

module.exports = router;
