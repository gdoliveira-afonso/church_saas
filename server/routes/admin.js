const express = require('express');
const prisma = require('../lib/prisma');
const router = express.Router();

// GET /api/admin/backup - Exporta todos os dados do sistema em JSON
router.get('/backup', async (req, res) => {
    try {
        const orgId = req.orgId;
        if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });
        
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const whereOrg = { organizationId: orgId };

        const data = {
            users: await prisma.user.findMany({
                where: whereOrg,
                select: {
                    id: true, name: true, username: true, email: true, role: true,
                    secondaryRoles: true, organizationId: true, generationId: true,
                    createdAt: true, updatedAt: true, active: true, tokenVersion: true
                }
            }),
            generations: await prisma.generation.findMany({ where: whereOrg }),
            cells: await prisma.cell.findMany({ where: whereOrg }),
            people: await prisma.person.findMany({ where: whereOrg }),
            consolidations: await prisma.consolidation.findMany({ where: { person: { organizationId: orgId } } }),
            milestones: await prisma.personMilestone.findMany({ where: whereOrg }),
            attendance: await prisma.attendance.findMany({ where: whereOrg }),
            attendanceRecords: await prisma.attendanceRecord.findMany({ where: { organizationId: orgId } }),
            pastoralNotes: await prisma.pastoralNote.findMany({ where: whereOrg }),
            visits: await prisma.visit.findMany({ where: whereOrg }),
            events: await prisma.event.findMany({ where: whereOrg }),
            eventExceptions: await prisma.eventException.findMany({ where: whereOrg }),
            cellCancellations: await prisma.cellCancellation.findMany({ where: whereOrg }),
            cellJustifications: await prisma.cellJustification.findMany({ where: whereOrg }),
            tracks: await prisma.track.findMany({ where: whereOrg }),
            personTracks: await prisma.personTrack.findMany({ where: { person: { organizationId: orgId } } }),
            notifications: await prisma.notification.findMany({ where: whereOrg }),
            forms: await prisma.form.findMany({ where: whereOrg }),
            triageQueue: await prisma.triageQueue.findMany({ where: whereOrg }),
            systemConfig: await prisma.systemConfig.findMany({ where: whereOrg }),
            apiKeys: await prisma.apiKey.findMany({ where: whereOrg }),
            webhooks: await prisma.webhook.findMany({ where: whereOrg }),
            webhookLogs: await prisma.webhookLog.findMany({ where: { webhook: { organizationId: orgId } } }),
            activityLogs: await prisma.activityLog.findMany({ where: whereOrg })
        };

        const filename = `backup-igreja-${new Date().toISOString().split('T')[0]}.json`;
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Erro no backup:', err);
        res.status(500).json({ error: 'Falha ao gerar backup' });
    }
});

// POST /api/admin/restore - Restaura dados a partir de um JSON
router.post('/restore', async (req, res) => {
    try {
        const orgId = req.orgId;
        if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });

        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const data = req.body;
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Dados de backup inválidos' });
        }

        const whereOrg = { organizationId: orgId };

        await prisma.$transaction(async (tx) => {
            // Ordem de deleção (filhos primeiro) - RESTRITO À ORGANIZAÇÃO
            await tx.webhookLog.deleteMany({ where: { webhook: { organizationId: orgId } } });
            await tx.webhook.deleteMany({ where: whereOrg });
            await tx.apiKey.deleteMany({ where: whereOrg });
            await tx.systemConfig.deleteMany({ where: whereOrg });
            await tx.triageQueue.deleteMany({ where: whereOrg });
            await tx.form.deleteMany({ where: whereOrg });
            await tx.notification.deleteMany({ where: whereOrg });
            await tx.personTrack.deleteMany({ where: { person: { organizationId: orgId } } });
            await tx.track.deleteMany({ where: whereOrg });
            await tx.cellJustification.deleteMany({ where: whereOrg });
            await tx.cellCancellation.deleteMany({ where: whereOrg });
            await tx.eventException.deleteMany({ where: whereOrg });
            await tx.event.deleteMany({ where: whereOrg });
            await tx.visit.deleteMany({ where: whereOrg });
            await tx.pastoralNote.deleteMany({ where: whereOrg });
            await tx.attendanceRecord.deleteMany({ where: { organizationId: orgId } });
            await tx.attendance.deleteMany({ where: whereOrg });
            await tx.personMilestone.deleteMany({ where: whereOrg });
            await tx.consolidation.deleteMany({ where: { person: { organizationId: orgId } } });
            await tx.person.deleteMany({ where: whereOrg });
            await tx.cell.deleteMany({ where: whereOrg });
            await tx.user.deleteMany({ where: { ...whereOrg, id: { not: req.user.id } } }); // Evita deletar a si mesmo para não quebrar a transação de auth
            await tx.generation.deleteMany({ where: whereOrg });
            await tx.activityLog.deleteMany({ where: whereOrg });

            // 2. Inserir dados do backup (Garantindo organizationId correto)
            const mapOrg = (list) => (list || []).map(item => ({ ...item, organizationId: orgId }));

            if (data.generations) await tx.generation.createMany({ data: mapOrg(data.generations) });
            if (data.users) await tx.user.createMany({ data: mapOrg(data.users) });
            if (data.cells) await tx.cell.createMany({ data: mapOrg(data.cells) });
            if (data.people) await tx.person.createMany({ data: mapOrg(data.people) });
            if (data.consolidations) await tx.consolidation.createMany({ data: data.consolidations }); // consolidation não tem orgId direto
            if (data.milestones) await tx.personMilestone.createMany({ data: mapOrg(data.milestones) });
            if (data.attendance) await tx.attendance.createMany({ data: mapOrg(data.attendance) });
            if (data.attendanceRecords) await tx.attendanceRecord.createMany({ data: mapOrg(data.attendanceRecords) });
            if (data.pastoralNotes) await tx.pastoralNote.createMany({ data: mapOrg(data.pastoralNotes) });
            if (data.visits) await tx.visit.createMany({ data: mapOrg(data.visits) });
            if (data.events) await tx.event.createMany({ data: mapOrg(data.events) });
            if (data.eventExceptions) await tx.eventException.createMany({ data: mapOrg(data.eventExceptions) });
            if (data.cellCancellations) await tx.cellCancellation.createMany({ data: mapOrg(data.cellCancellations) });
            if (data.cellJustifications) await tx.cellJustification.createMany({ data: mapOrg(data.cellJustifications) });
            if (data.tracks) await tx.track.createMany({ data: mapOrg(data.tracks) });
            if (data.personTracks) await tx.personTrack.createMany({ data: data.personTracks }); // personTrack não tem orgId direto
            if (data.notifications) await tx.notification.createMany({ data: mapOrg(data.notifications) });
            if (data.forms) await tx.form.createMany({ data: mapOrg(data.forms) });
            if (data.triageQueue) await tx.triageQueue.createMany({ data: mapOrg(data.triageQueue) });
            if (data.systemConfig) await tx.systemConfig.createMany({ data: mapOrg(data.systemConfig) });
            if (data.apiKeys) await tx.apiKey.createMany({ data: mapOrg(data.apiKeys) });
            if (data.webhooks) await tx.webhook.createMany({ data: mapOrg(data.webhooks) });
            if (data.webhookLogs) await tx.webhookLog.createMany({ data: data.webhookLogs });
            if (data.activityLogs) await tx.activityLog.createMany({ data: mapOrg(data.activityLogs) });
        });
      

        res.json({ success: true, message: 'Dados restaurados com sucesso. O sistema deve reiniciar.' });

        // Trigger exit to allow Docker/PM2 to restart the process
        setTimeout(() => process.exit(0), 1000);
    } catch (err) {
        console.error('Erro na restauração:', err);
        res.status(500).json({ error: 'Falha ao restaurar backup: ' + err.message });
    }
});

module.exports = router;
