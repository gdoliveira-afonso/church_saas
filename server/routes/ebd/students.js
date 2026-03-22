const express = require('express');
const prisma = require('../../lib/prisma');
const { hasEbdAdminAccess } = require('../../lib/permissions');

const router = express.Router();

// GET /api/ebd/students/all — todos os alunos matriculados na org (para relatórios)
router.get('/students/all', async (req, res) => {
    try {
        const orgId = req.orgId;
        const students = await prisma.ebdStudent.findMany({
            where: { ebdClass: { organizationId: orgId } },
            select: {
                id: true, personId: true, ebdClassId: true, ativo: true,
                person: { select: { id: true, name: true, phone: true, status: true } },
                ebdClass: { select: { id: true, name: true } }
            },
            orderBy: { person: { name: 'asc' } }
        });
        res.json(students);
    } catch (error) {
        console.error('[EBD] Erro ao listar todos os alunos:', error.message);
        res.status(500).json({ error: 'Erro ao listar alunos' });
    }
});

// GET /api/ebd/classes/:id/students — lista alunos da classe
router.get('/classes/:id/students', async (req, res) => {
    try {
        const orgId = req.orgId;
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const students = await prisma.ebdStudent.findMany({
            where: { ebdClassId: req.params.id },
            select: {
                id: true, personId: true, ebdClassId: true, dataMatricula: true, ativo: true,
                person: { select: { id: true, name: true, phone: true, status: true } }
            },
            orderBy: { dataMatricula: 'asc' }
        });
        res.json(students);
    } catch (error) {
        console.error('[EBD] Erro ao listar alunos:', error.message);
        res.status(500).json({ error: 'Erro ao listar alunos da classe' });
    }
});

// POST /api/ebd/classes/:id/students — matricula aluno (body: {personId})
router.post('/classes/:id/students', async (req, res) => {
    const { personId } = req.body;
    const orgId = req.orgId;

    if (!personId) return res.status(400).json({ error: 'personId é obrigatório' });

    if (!hasEbdAdminAccess(req)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores e supervisores.' });
    }

    try {
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const person = await prisma.person.findFirst({
            where: { id: personId, organizationId: orgId }
        });
        if (!person) return res.status(404).json({ error: 'Pessoa não encontrada nesta organização' });

        const existing = await prisma.ebdStudent.findFirst({
            where: { ebdClassId: req.params.id, personId }
        });
        if (existing) return res.status(400).json({ error: 'Aluno já matriculado nesta classe' });

        const student = await prisma.ebdStudent.create({
            data: { ebdClassId: req.params.id, personId },
            select: {
                id: true, personId: true, ebdClassId: true, dataMatricula: true, ativo: true,
                person: { select: { id: true, name: true, phone: true, status: true } }
            }
        });
        res.status(201).json(student);
        if (req.log) req.log('CREATE', 'ebd_students', student.id, person.name);
    } catch (error) {
        console.error('[EBD] Erro ao matricular aluno:', error.message);
        res.status(500).json({ error: 'Erro ao matricular aluno na classe' });
    }
});

// DELETE /api/ebd/classes/:id/students/:studentId — remove matrícula
router.delete('/classes/:id/students/:studentId', async (req, res) => {
    const orgId = req.orgId;

    if (!hasEbdAdminAccess(req)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores e supervisores.' });
    }

    try {
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const student = await prisma.ebdStudent.findFirst({
            where: { id: req.params.studentId, ebdClassId: req.params.id }
        });
        if (!student) return res.status(404).json({ error: 'Matrícula não encontrada' });

        await prisma.ebdStudent.delete({ where: { id: req.params.studentId } });
        res.json({ success: true });
        if (req.log) req.log('DELETE', 'ebd_students', req.params.studentId, null);
    } catch (error) {
        console.error('[EBD] Erro ao remover matrícula:', error.message);
        res.status(500).json({ error: 'Erro ao remover matrícula' });
    }
});

module.exports = router;
