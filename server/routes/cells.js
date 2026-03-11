const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

// Lista todas as células da organização
router.get('/', async (req, res) => {
    try {
        const orgId = req.orgId;
        const whereClause = { organizationId: orgId };
        
        if (req.user.role === 'LIDER_GERACAO') {
            if (!req.user.generationId) return res.json([]);
            whereClause.generationId = req.user.generationId;
        }

        const cells = await prisma.cell.findMany({
            where: whereClause,
            include: {
                _count: { select: { people: true } }
            }
        });
        res.json(cells);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar células' });
    }
});

// Busca uma célula específica (dentro da organização)
router.get('/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const cell = await prisma.cell.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            include: {
                people: { select: { id: true, name: true, phone: true } }
            }
        });
        if (!cell) return res.status(404).json({ error: 'Célula não encontrada nesta organização' });
        res.json(cell);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar célula' });
    }
});

// Cadastra nova célula (vinculada à organização)
router.post('/', async (req, res) => {
    const data = req.body;
    const orgId = req.orgId;
    
    if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });

    try {
        // Fase 8: Enforce plan limits
        const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
        if (org?.plan === 'demo') {
            const cellCount = await prisma.cell.count({ where: { organizationId: orgId } });
            if (cellCount >= 2) {
                return res.status(402).json({
                    error: 'Limite do plano Demo atingido',
                    detail: 'O plano Demo permite no máximo 2 células. Faça upgrade para o plano Standard ou superior para criar mais células.',
                    limitReached: true
                });
            }
        }

        const cell = await prisma.cell.create({
            data: {
                name: data.name,
                leaderId: data.leaderId,
                viceLeaderId: data.viceLeaderId,
                hostId: data.hostId,
                address: data.address,
                meetingDay: data.meetingDay,
                meetingTime: data.meetingTime,
                status: data.status || 'ativa',
                generationId: data.generationId || null,
                organizationId: orgId
            }
        });

        // Sincroniza Liderança
        if (data.leaderId) {
            await prisma.person.updateMany({ 
                where: { userId: data.leaderId, organizationId: orgId }, 
                data: { cellId: cell.id } 
            });
        }
        if (data.viceLeaderId) {
            await prisma.person.updateMany({ 
                where: { userId: data.viceLeaderId, organizationId: orgId }, 
                data: { cellId: cell.id } 
            });
        }

        res.status(201).json(cell);
        req.log?.('CREATE', 'cells', cell.id, cell.name);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar célula' });
    }
});


// Atualiza célula (dentro da organização)
router.put('/:id', async (req, res) => {
    const data = req.body;
    const orgId = req.orgId;
    try {
        const existingCell = await prisma.cell.findFirst({ 
            where: { id: req.params.id, organizationId: orgId } 
        });
        
        if (!existingCell) return res.status(404).json({ error: 'Célula não encontrada nesta organização' });

        const cell = await prisma.cell.update({
            where: { id: req.params.id },
            data: {
                name: data.name,
                leaderId: data.leaderId,
                viceLeaderId: data.viceLeaderId,
                hostId: data.hostId,
                address: data.address,
                meetingDay: data.meetingDay,
                meetingTime: data.meetingTime,
                status: data.status,
                generationId: data.generationId || null
            }
        });

        // Sincroniza Liderança
        await prisma.person.updateMany({
            where: { cellId: cell.id, organizationId: orgId, status: { in: ['Líder', 'Vice-Líder'] } },
            data: { cellId: null }
        });

        if (data.leaderId) {
            await prisma.person.updateMany({ where: { userId: data.leaderId, organizationId: orgId }, data: { cellId: cell.id } });
        }
        if (data.viceLeaderId) {
            await prisma.person.updateMany({ where: { userId: data.viceLeaderId, organizationId: orgId }, data: { cellId: cell.id } });
        }

        res.json(cell);
        req.log?.('UPDATE', 'cells', cell.id, cell.name);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar célula' });
    }
});

// Deleta célula (dentro da organização)
router.delete('/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const cell = await prisma.cell.findFirst({ 
            where: { id: req.params.id, organizationId: orgId }, 
            select: { name: true } 
        });
        if (!cell) return res.status(404).json({ error: 'Célula não encontrada nesta organização' });

        await prisma.person.updateMany({
            where: { cellId: req.params.id, organizationId: orgId },
            data: { cellId: null }
        });

        await prisma.cell.delete({ where: { id: req.params.id } });
        res.json({ success: true });
        req.log?.('DELETE', 'cells', req.params.id, cell.name);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar célula' });
    }
});

// Buscar TODAS as presenças (da organização)
router.get('/attendance/all', async (req, res) => {
    try {
        const orgId = req.orgId;
        const whereClause = { organizationId: orgId };
        
        if (req.user.role === 'LIDER_GERACAO' && req.user.generationId) {
            whereClause.cell = { generationId: req.user.generationId };
        } else if (req.user.role === 'LEADER' || req.user.role === 'VICE_LEADER') {
            whereClause.cell = { OR: [{ leaderId: req.user.id }, { viceLeaderId: req.user.id }] };
        }

        const attendance = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                records: {
                    include: { person: { select: { id: true, name: true } } }
                }
            },
            orderBy: { date: 'desc' }
        });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar todas as chamadas' });
    }
});

// Buscar relatório de presenças da célula (dentro da organização)
router.get('/:id/attendance', async (req, res) => {
    try {
        const orgId = req.orgId;
        const cell = await prisma.cell.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!cell) return res.status(404).json({ error: 'Célula não encontrada' });

        const attendance = await prisma.attendance.findMany({
            where: { cellId: req.params.id, organizationId: orgId },
            include: {
                records: {
                    include: { person: { select: { id: true, name: true } } }
                }
            },
            orderBy: { date: 'desc' }
        });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar chamadas da célula' });
    }
});

// Lançar ou atualizar a chamada de um dia
router.post('/:id/attendance', async (req, res) => {
    const { date, notes, customFields, records } = req.body;
    const cellId = req.params.id;
    const orgId = req.orgId;

    try {
        const cellInfo = await prisma.cell.findFirst({ where: { id: cellId, organizationId: orgId } });
        if (!cellInfo) return res.status(404).json({ error: 'Célula não encontrada nesta organização' });

        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.attendance.findFirst({
                where: { cellId, date, organizationId: orgId },
                include: { records: true }
            });

            if (existing) {
                if (records !== undefined) {
                    await tx.attendanceRecord.deleteMany({ where: { attendanceId: existing.id } });
                }
                return await tx.attendance.update({
                    where: { id: existing.id },
                    data: {
                        notes: notes !== undefined ? notes : existing.notes,
                        customFields: customFields !== undefined ? customFields : existing.customFields,
                        records: records !== undefined ? {
                            create: records.map(r => ({ personId: r.personId, status: r.status }))
                        } : undefined
                    },
                    include: { records: true }
                });
            } else {
                return await tx.attendance.create({
                    data: {
                        cellId, date, notes, customFields, organizationId: orgId,
                        records: {
                            create: (records || []).map(r => ({ personId: r.personId, status: r.status }))
                        }
                    },
                    include: { records: true }
                });
            }
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar chamada da célula' });
    }
});

router.post('/:id/cancel', async (req, res) => {
    const { date, authorId } = req.body;
    const cellId = req.params.id;
    const orgId = req.orgId;
    try {
        const existing = await prisma.cellCancellation.findFirst({
            where: { cellId, date, organizationId: orgId }
        });
        if (existing) {
            await prisma.cellCancellation.delete({ where: { id: existing.id } });
            res.json({ canceled: false });
        } else {
            await prisma.cellCancellation.create({
                data: { cellId, date, authorId, organizationId: orgId }
            });
            res.json({ canceled: true });
        }
    } catch (error) { res.status(500).json({ error: 'Erro ao alternar cancelamento' }); }
});

router.post('/:id/justify', async (req, res) => {
    const { date, reason, authorId } = req.body;
    const cellId = req.params.id;
    const orgId = req.orgId;
    try {
        const justification = await prisma.cellJustification.create({
            data: { cellId, date, reason, authorId, organizationId: orgId }
        });
        res.status(201).json(justification);
    } catch (error) { res.status(500).json({ error: 'Erro ao justificar' }); }
});

module.exports = router;
