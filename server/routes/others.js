const express = require('express');
const prisma = require('../lib/prisma');
const { getNotificationConfig } = require('./config');

const router = express.Router();

// ------------------------------------------------------------------
// VISITAS
// ------------------------------------------------------------------
router.get('/visits', async (req, res) => {
    try {
        const orgId = req.orgId;
        const visits = await prisma.visit.findMany({ 
            where: { organizationId: orgId },
            include: { person: { select: { name: true } } }, 
            orderBy: { date: 'desc' } 
        });
        res.json(visits);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar visitas' }); }
});

router.post('/visits', async (req, res) => {
    const { personId, date, type, notes, authorId } = req.body;
    const orgId = req.orgId;
    try {
        const visit = await prisma.visit.create({
            data: { personId, date, type, notes, authorId, organizationId: orgId }
        });

        // Gatilho Automático: Consolidação se for Visita de Consolidação (replicando a lógica do store.js)
        if (type === 'Visita de Consolidação') {
            const person = await prisma.person.findFirst({ where: { id: personId, organizationId: orgId }, include: { consolidation: true } });
            if (person && person.status === 'Novo Convertido') {
                if (!person.consolidation) {
                    await prisma.consolidation.create({ data: { personId, status: 'IN_PROGRESS' } });
                } else if (person.consolidation.status !== 'COMPLETED') {
                    await prisma.consolidation.update({ where: { personId }, data: { status: 'IN_PROGRESS' } });
                }
            }
        }

        res.status(201).json(visit);
    } catch (err) { res.status(500).json({ error: 'Erro ao criar visita' }); }
});

// ------------------------------------------------------------------
// NOTAS PASTORAIS
// ------------------------------------------------------------------
router.get('/notes', async (req, res) => {
    try {
        const orgId = req.orgId;
        const notes = await prisma.pastoralNote.findMany({ 
            where: { organizationId: orgId },
            include: { person: { select: { name: true } } }, 
            orderBy: { date: 'desc' } 
        });
        res.json(notes);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar notas' }); }
});

router.post('/notes', async (req, res) => {
    const { personId, date, type, text, authorId } = req.body;
    const orgId = req.orgId;
    try {
        const note = await prisma.pastoralNote.create({
            data: { personId, date, type, text, authorId, organizationId: orgId }
        });
        res.status(201).json(note);
    } catch (err) { res.status(500).json({ error: 'Erro ao criar nota' }); }
});

router.delete('/notes/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        await prisma.pastoralNote.deleteMany({ where: { id: req.params.id, organizationId: orgId } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao deletar nota' }); }
});

// ------------------------------------------------------------------
// TRILHAS (BATISMO, ESCOLA, ENCONTRO)
// ------------------------------------------------------------------
router.get('/tracks', async (req, res) => {
    try {
        const orgId = req.orgId;
        const tracks = await prisma.track.findMany({ where: { organizationId: orgId } });
        res.json(tracks);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar trilhas' }); }
});

router.post('/tracks/person', async (req, res) => {
    const { personId, trackId } = req.body;
    const orgId = req.orgId;
    try {
        const person = await prisma.person.findFirst({ where: { id: personId, organizationId: orgId } });
        if (!person) return res.status(403).json({ error: 'Pessoa não pertence a esta organização' });
        const pt = await prisma.personTrack.create({
            data: { personId, trackId, completed: true }
        });
        res.status(201).json(pt);
    } catch (err) { res.status(500).json({ error: 'Erro ao vincular pessoa à trilha (já existe?)' }); }
});

router.delete('/tracks/person/:personId/:trackId', async (req, res) => {
    const orgId = req.orgId;
    try {
        const person = await prisma.person.findFirst({ where: { id: req.params.personId, organizationId: orgId } });
        if (!person) return res.status(403).json({ error: 'Pessoa não pertence a esta organização' });
        await prisma.personTrack.deleteMany({
            where: { personId: req.params.personId, trackId: req.params.trackId }
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao remover vínculo' }); }
});

// ------------------------------------------------------------------
// CONFIGURAÇÕES DO SISTEMA (ADMIN)
// ------------------------------------------------------------------
const DEFAULT_DASHBOARD_CONFIG = {
    noVisit: { enabled: true, days: 60 },
    baptism: { enabled: true },
    consolidation: { enabled: true, days: 15 },
    reconciliation: { enabled: true }
};

async function getDashboardConfig(orgId) {
    try {
        const config = await prisma.systemConfig.findUnique({
            where: { key_organizationId: { key: 'dashboardActions', organizationId: orgId } }
        });
        if (config) return JSON.parse(config.value);
    } catch (e) { /* fallback case */ }
    return DEFAULT_DASHBOARD_CONFIG;
}

router.get('/config', async (req, res) => {
    try {
        const orgId = req.orgId;
        const dashboardActions = await getDashboardConfig(orgId);
        const notificationConfig = await getNotificationConfig(orgId);
        res.json({ dashboardActions, notificationConfig });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

router.put('/config', async (req, res) => {
    try {
        const { dashboardActions, notificationConfig } = req.body;
        const orgId = req.orgId;
        const role = req.user.role;

        if (role !== 'ADMIN' && role !== 'SUPERADMIN') return res.status(403).json({ error: 'Apenas administradores podem alterar configurações' });

        if (dashboardActions) {
            const value = JSON.stringify(dashboardActions);
            await prisma.systemConfig.upsert({
                where: { key_organizationId: { key: 'dashboardActions', organizationId: orgId } },
                update: { value, updatedAt: new Date() },
                create: { key: 'dashboardActions', value, organizationId: orgId }
            });
        }

        if (notificationConfig) {
            const value = JSON.stringify(notificationConfig);
            await prisma.systemConfig.upsert({
                where: { key_organizationId: { key: 'notificationConfig', organizationId: orgId } },
                update: { value, updatedAt: new Date() },
                create: { key: 'notificationConfig', value, organizationId: orgId }
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

// ------------------------------------------------------------------
// DASHBOARD METRICS / RELATÓRIOS GERAIS
// ------------------------------------------------------------------
router.get('/metrics', async (req, res) => {
    try {
        const orgId = req.orgId;
        const userId = req.user.id; // Uso do usuário logado por padrão
        const reqUser = req.user;

        let peopleFilter = { organizationId: orgId };
        let cellsFilter = { organizationId: orgId };

        if (reqUser && (reqUser.role === 'LEADER' || reqUser.role === 'VICE_LEADER')) {
            // Find cells where this user is leader or vice-leader
            const myCells = await prisma.cell.findMany({
                where: { organizationId: orgId, OR: [{ leaderId: userId }, { viceLeaderId: userId }] },
                select: { id: true }
            });

            const myCellIds = myCells.map(c => c.id);
            peopleFilter.cellId = { in: myCellIds };
            cellsFilter.id = { in: myCellIds };
        } else if (reqUser && reqUser.role === 'LIDER_GERACAO') {
            if (reqUser.generationId) {
                const myCells = await prisma.cell.findMany({
                    where: { organizationId: orgId, generationId: reqUser.generationId },
                    select: { id: true }
                });
                const myCellIds = myCells.map(c => c.id);
                peopleFilter.cellId = { in: myCellIds };
                cellsFilter.generationId = reqUser.generationId;
            } else {
                // Sem geração atribuída, vê zero pessoas
                peopleFilter.id = 'none';
                cellsFilter.id = 'none';
            }
        }

        const people = await prisma.person.findMany({
            where: peopleFilter,
            include: { visits: true, personTracks: { include: { track: true } }, consolidation: true }
        });
        const totalPeople = people.length;
        const newConverts = people.filter(p => p.status === 'Novo Convertido').length;
        const totalCells = await prisma.cell.count({ where: cellsFilter });

        let wbCnt = 0;
        let encCnt = 0;
        const noVisit = [];
        const pendingBaptism = [];
        const delayedConsolidation = [];
        const reconciliations = [];

        const now = new Date();
        const cfg = await getDashboardConfig(orgId);
        const noVisitDays = cfg.noVisit?.days ?? 60;
        const consolidateDays = cfg.consolidation?.days ?? 15;

        people.forEach(p => {
            const hasBatismo = p.personTracks.some(pt => pt.track.name.includes('Batismo'));
            const hasEncontro = p.personTracks.some(pt => pt.track.name.includes('Encontro'));

            if (hasBatismo) wbCnt++;
            else pendingBaptism.push(p);

            if (hasEncontro) encCnt++;

            const createdDaysAgo = Math.floor((now - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));

            if (p.status !== 'Líder') {
                if (p.visits && p.visits.length > 0) {
                    const lastVis = new Date(p.visits.sort((a, b) => b.date.localeCompare(a.date))[0].date);
                    const daysDiff = Math.floor((now - lastVis) / (1000 * 60 * 60 * 24));
                    if (daysDiff > noVisitDays && createdDaysAgo > noVisitDays) noVisit.push(p);
                } else {
                    // Membro nunca foi visitado, vamos olhar se ele já é membro há mais de X dias pra poder alertar
                    if (createdDaysAgo > noVisitDays) noVisit.push(p);
                }
            }

            if (p.status === 'Novo Convertido') {
                const consVisits = (p.visits || []).filter(v => v.type === 'Visita de Consolidação');
                if (consVisits.length > 0) {
                    const lastVis = new Date(consVisits.sort((a, b) => b.date.localeCompare(a.date))[0].date);
                    const daysDiff = Math.floor((now - lastVis) / (1000 * 60 * 60 * 24));
                    if (daysDiff > consolidateDays && createdDaysAgo > consolidateDays) delayedConsolidation.push(p);
                } else {
                    if (createdDaysAgo > consolidateDays) delayedConsolidation.push(p);
                }
            }

            if (p.status === 'Reconciliação') {
                reconciliations.push(p);
            }
        });

        res.json({
            total: totalPeople,
            newConverts,
            cells: totalCells,
            waterBaptism: totalPeople ? Math.round((wbCnt / totalPeople) * 100) : 0,
            encounter: totalPeople ? Math.round((encCnt / totalPeople) * 100) : 0,
            noVisit: noVisit.length,
            delayedConsolidations: delayedConsolidation.length,
            reconciliations: reconciliations.length,
            config: cfg,
            actionLists: {
                noVisit,
                pendingBaptism,
                delayedConsolidation,
                reconciliations
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao carregar métricas' });
    }
});

// ------------------------------------------------------------------
// ADMIN: TRILHAS CRUD
// ------------------------------------------------------------------
router.post('/tracks', async (req, res) => {
    try {
        const orgId = req.orgId;
        const { name, category, icon, color, targetMetadata } = req.body;
        const track = await prisma.track.create({
            data: { name, category, icon, color, targetMetadata, organizationId: orgId }
        });
        res.status(201).json(track);
    } catch (err) { res.status(500).json({ error: 'Erro ao criar trilha' }); }
});

router.put('/tracks/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const { name, category, icon, color, targetMetadata } = req.body;
        const track = await prisma.track.update({
            where: { id: req.params.id, organizationId: orgId },
            data: { name, category, icon, color, targetMetadata }
        });
        res.json(track);
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar' }); }
});

router.delete('/tracks/:id', async (req, res) => {
    try {
        await prisma.track.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao deletar' }); }
});

// ------------------------------------------------------------------
// NOTIFICATIONS
// ------------------------------------------------------------------
router.get('/notifications', async (req, res) => {
    try {
        const orgId = req.orgId;
        const userId = req.user.id;

        const notifs = await prisma.notification.findMany({
            where: { userId, organizationId: orgId, read: false },
            orderBy: { createdAt: 'desc' }
        });
        res.json(notifs);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar notificações' }); }
});

router.put('/notifications/read', async (req, res) => {
    try {
        const userId = req.body.userId;
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        await prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true }
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao marcar notificações como lidas' }); }
});

router.delete('/notifications/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const userId = req.user.id;
        await prisma.notification.deleteMany({
            where: { id: req.params.id, userId, organizationId: orgId }
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao remover notificação' }); }
});

module.exports = router;
