const express = require('express');
const prisma = require('../lib/prisma');
const router = express.Router();

// Lista as gerações (para selects e gerenciamento)
router.get('/', async (req, res) => {
    try {
        const orgId = req.orgId;
        const generations = await prisma.generation.findMany({
            where: { organizationId: orgId },
            include: {
                _count: {
                    select: { cells: true, users: true }
                }
            }
        });
        res.json(generations);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar gerações' });
    }
});

// Busca uma geração por ID
router.get('/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const generation = await prisma.generation.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            include: { cells: true, users: true }
        });
        if (!generation) return res.status(404).json({ error: 'Geração não encontrada' });
        res.json(generation);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar geração' });
    }
});

// Cadastra uma nova geração (Apenas ADMIN ou SUPERVISOR)
router.post('/', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        const { name, description, leaderId } = req.body;
        const orgId = req.orgId;
        if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

        const generation = await prisma.generation.create({
            data: { name, description, organizationId: orgId }
        });

        if (leaderId) {
            await prisma.user.update({
                where: { id: leaderId },
                data: { generationId: generation.id, role: 'LIDER_GERACAO' }
            });
        }
        res.status(201).json(generation);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Já existe uma geração com este nome.' });
        }
        res.status(500).json({ error: 'Erro ao criar geração' });
    }
});

// Atualiza uma geração
router.put('/:id', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        const { name, description, leaderId } = req.body;
        const orgId = req.orgId;

        const generation = await prisma.generation.update({
            where: { id: req.params.id, organizationId: orgId },
            data: { name, description }
        });

        if (leaderId) {
            // Se o usuário quer fixar esse como líder, a gente atualiza.
            await prisma.user.update({
                where: { id: leaderId },
                data: { generationId: generation.id, role: 'LIDER_GERACAO' }
            });
        }
        res.json(generation);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Já existe uma geração com este nome.' });
        }
        res.status(500).json({ error: 'Erro ao atualizar geração' });
    }
});

// Deleta uma geração
router.delete('/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        await prisma.generation.delete({ where: { id: req.params.id, organizationId: orgId } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir geração. Pode estar associada a usuários ou células.' });
    }
});

module.exports = router;
