const express = require('express');
const prisma = require('../../lib/prisma');
const { hasEbdAdminAccess } = require('../../lib/permissions');

const router = express.Router();

// GET /api/ebd/classes/:id/offerings — lista ofertas da classe
router.get('/classes/:id/offerings', async (req, res) => {
    try {
        const orgId = req.orgId;
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const offerings = await prisma.ebdOffering.findMany({
            where: { ebdClassId: req.params.id, organizationId: orgId },
            select: {
                id: true, ebdClassId: true, organizationId: true, data: true,
                valor: true, observacao: true, registradoPorId: true, createdAt: true,
                registradoPor: { select: { id: true, name: true } }
            },
            orderBy: { data: 'desc' }
        });
        res.json(offerings);
    } catch (error) {
        console.error('[EBD] Erro ao listar ofertas:', error.message);
        res.status(500).json({ error: 'Erro ao listar ofertas da classe' });
    }
});

// POST /api/ebd/classes/:id/offerings — registra oferta
// body: { data, valor, observacao }
router.post('/classes/:id/offerings', async (req, res) => {
    const { data, valor, observacao } = req.body;
    const orgId = req.orgId;

    if (!data || valor === undefined || valor === null) {
        return res.status(400).json({ error: 'Data e valor são obrigatórios' });
    }

    try {
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true, professorId: true, segundoProfessorId: true, terceiroProfessorId: true }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const isTeacher = classe.professorId === req.user.id ||
                          classe.segundoProfessorId === req.user.id ||
                          classe.terceiroProfessorId === req.user.id;

        if (!hasEbdAdminAccess(req) && !isTeacher) {
            return res.status(403).json({ error: 'Acesso negado. Apenas professores da classe ou administradores podem registrar oferta.' });
        }

        const offering = await prisma.ebdOffering.create({
            data: {
                ebdClassId: req.params.id,
                organizationId: orgId,
                data,
                valor: parseFloat(valor),
                observacao: observacao || null,
                registradoPorId: req.user.id
            }
        });
        res.status(201).json(offering);
        if (req.log) req.log('CREATE', 'ebd_offerings', offering.id, `Oferta R$${valor}`);
    } catch (error) {
        console.error('[EBD] Erro ao registrar oferta:', error.message);
        res.status(500).json({ error: 'Erro ao registrar oferta' });
    }
});

// GET /api/ebd/offerings/all — todas as ofertas da org (consolidado)
router.get('/offerings/all', async (req, res) => {
    try {
        const orgId = req.orgId;
        const offerings = await prisma.ebdOffering.findMany({
            where: { organizationId: orgId },
            select: {
                id: true, ebdClassId: true, organizationId: true, data: true,
                valor: true, observacao: true, registradoPorId: true, createdAt: true,
                ebdClass: { select: { id: true, name: true } },
                registradoPor: { select: { id: true, name: true } }
            },
            orderBy: { data: 'desc' }
        });
        res.json(offerings);
    } catch (error) {
        console.error('[EBD] Erro ao buscar todas as ofertas:', error.message);
        res.status(500).json({ error: 'Erro ao buscar ofertas da EBD' });
    }
});

module.exports = router;
