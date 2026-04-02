const express = require('express');
const router = express.Router();
const prisma = require('../../../lib/prisma');
const { requirePermission } = require('../../middleware/apiAuth');

async function checkEbdEnabled(orgId, res) {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { ebdEnabled: true }
    });
    if (!org?.ebdEnabled) {
        res.status(403).json({ success: false, error: 'Módulo EBD não habilitado para esta organização.' });
        return false;
    }
    return true;
}

// GET /api/v1/ebd/turmas
router.get('/turmas', requirePermission('read_ebd'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        if (!await checkEbdEnabled(orgId, res)) return;

        const { page = 1, limit = 50, ativo } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = { organizationId: orgId };
        if (ativo !== undefined) where.ativo = ativo === 'true';

        const [classes, total] = await Promise.all([
            prisma.ebdClass.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    professor: { select: { id: true, name: true } },
                    segundoProfessor: { select: { id: true, name: true } },
                    _count: { select: { students: true } }
                },
                orderBy: { name: 'asc' }
            }),
            prisma.ebdClass.count({ where })
        ]);

        res.json({ success: true, data: classes, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar turmas EBD.' });
    }
});

// GET /api/v1/ebd/turmas/:id/chamadas
router.get('/turmas/:id/chamadas', requirePermission('read_ebd'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        if (!await checkEbdEnabled(orgId, res)) return;

        const ebdClass = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true, name: true }
        });
        if (!ebdClass) return res.status(404).json({ success: false, error: 'Turma não encontrada.' });

        const { from, to, page = 1, limit = 50 } = req.query;
        const where = { ebdClassId: req.params.id };
        if (from || to) {
            where.data = {};
            if (from) where.data.gte = from;
            if (to) where.data.lte = to;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [attendances, total] = await Promise.all([
            prisma.ebdAttendance.findMany({
                where,
                skip,
                take: parseInt(limit),
                include: {
                    records: {
                        include: {
                            ebdStudent: {
                                include: { person: { select: { id: true, name: true } } }
                            }
                        }
                    }
                },
                orderBy: { data: 'desc' }
            }),
            prisma.ebdAttendance.count({ where })
        ]);

        const data = attendances.map(att => ({
            id: att.id,
            data: att.data,
            notes: att.notes || null,
            presentes: att.records.filter(r => r.presente).length,
            totalAlunos: att.records.length,
            records: att.records.map(r => ({
                presente: r.presente,
                justificado: r.justificado,
                pessoa: r.ebdStudent?.person ? { id: r.ebdStudent.person.id, name: r.ebdStudent.person.name } : null
            }))
        }));

        res.json({
            success: true,
            data,
            meta: { total, page: parseInt(page), limit: parseInt(limit), turma: ebdClass }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar chamadas da turma.' });
    }
});

module.exports = router;
