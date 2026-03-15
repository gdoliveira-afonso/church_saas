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
                    id: true, name: true, username: true, role: true,
                    secondaryRoles: true, organizationId: true, generationId: true,
                    createdAt: true, updatedAt: true, tokenVersion: true
                }
            }),
            generations: await prisma.generation.findMany({ where: whereOrg }),
            cells: await prisma.cell.findMany({ where: whereOrg }),
            people: await prisma.person.findMany({ where: whereOrg }),
            consolidations: await prisma.consolidation.findMany({ where: { person: { organizationId: orgId } } }),
            milestones: await prisma.personMilestone.findMany({ where: whereOrg }),
            attendance: await prisma.attendance.findMany({ where: whereOrg }),
            attendanceRecords: await prisma.attendanceRecord.findMany({ where: { attendance: { organizationId: orgId } } }),
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
            activityLogs: await prisma.activityLog.findMany({ where: whereOrg }),
            
            // EBD
            ebdClasses: await prisma.ebdClass.findMany({ where: whereOrg }),
            ebdStudents: await prisma.ebdStudent.findMany({ where: { ebdClass: { organizationId: orgId } } }),
            ebdAttendances: await prisma.ebdAttendance.findMany({ where: { ebdClass: { organizationId: orgId } } }),
            ebdAttendanceRecords: await prisma.ebdAttendanceRecord.findMany({ where: { ebdAttendance: { ebdClass: { organizationId: orgId } } } }),
            ebdOfferings: await prisma.ebdOffering.findMany({ where: whereOrg }),

            // Financeiro
            financialAccounts: await prisma.financialAccount.findMany({ where: whereOrg }),
            funds: await prisma.fund.findMany({ where: whereOrg }),
            chartOfAccounts: await prisma.chartOfAccount.findMany({ where: whereOrg }),
            financialTransactions: await prisma.financialTransaction.findMany({ where: whereOrg }),
            donations: await prisma.donation.findMany({ where: whereOrg }),
            donationBatches: await prisma.donationBatch.findMany({ where: whereOrg }),
            bills: await prisma.bill.findMany({ where: whereOrg }),
            billPayments: await prisma.billPayment.findMany({ where: { bill: { organizationId: orgId } } })
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
            await tx.attendanceRecord.deleteMany({ where: { attendance: { organizationId: orgId } } });
            await tx.attendance.deleteMany({ where: whereOrg });
            await tx.personMilestone.deleteMany({ where: whereOrg });
            await tx.consolidation.deleteMany({ where: { person: { organizationId: orgId } } });

            // Deletar Financeiro (Ordem importante: filhos primeiro)
            await tx.billPayment.deleteMany({ where: { bill: { organizationId: orgId } } });
            await tx.bill.deleteMany({ where: whereOrg });
            await tx.donation.deleteMany({ where: whereOrg });
            await tx.donationBatch.deleteMany({ where: whereOrg });
            await tx.financialTransaction.deleteMany({ where: whereOrg });
            await tx.chartOfAccount.deleteMany({ where: whereOrg });
            await tx.fund.deleteMany({ where: whereOrg });
            await tx.financialAccount.deleteMany({ where: whereOrg });

            // Deletar EBD (Ordem importante: filhos primeiro)
            await tx.ebdAttendanceRecord.deleteMany({ where: { ebdAttendance: { ebdClass: { organizationId: orgId } } } });
            await tx.ebdAttendance.deleteMany({ where: { ebdClass: { organizationId: orgId } } });
            await tx.ebdStudent.deleteMany({ where: { ebdClass: { organizationId: orgId } } });
            await tx.ebdOffering.deleteMany({ where: whereOrg });
            await tx.ebdClass.deleteMany({ where: whereOrg });

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

            // Inserir Financeiro
            if (data.financialAccounts) await tx.financialAccount.createMany({ data: mapOrg(data.financialAccounts) });
            if (data.funds) await tx.fund.createMany({ data: mapOrg(data.funds) });
            if (data.chartOfAccounts) await tx.chartOfAccount.createMany({ data: mapOrg(data.chartOfAccounts) });
            if (data.financialTransactions) await tx.financialTransaction.createMany({ data: mapOrg(data.financialTransactions) });
            if (data.donationBatches) await tx.donationBatch.createMany({ data: mapOrg(data.donationBatches) });
            if (data.donations) await tx.donation.createMany({ data: mapOrg(data.donations) });
            if (data.bills) await tx.bill.createMany({ data: mapOrg(data.bills) });
            if (data.billPayments) await tx.billPayment.createMany({ data: data.billPayments }); // Sem orgId

            // Inserir EBD
            if (data.ebdClasses) await tx.ebdClass.createMany({ data: mapOrg(data.ebdClasses) });
            if (data.ebdStudents) await tx.ebdStudent.createMany({ data: data.ebdStudents }); // Sem orgId (são relacionamentos em cascade)
            if (data.ebdAttendances) await tx.ebdAttendance.createMany({ data: data.ebdAttendances }); // Sem orgId
            if (data.ebdAttendanceRecords) await tx.ebdAttendanceRecord.createMany({ data: data.ebdAttendanceRecords }); // Sem orgId
            if (data.ebdOfferings) await tx.ebdOffering.createMany({ data: mapOrg(data.ebdOfferings) });
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
