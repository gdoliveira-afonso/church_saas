const express = require('express');
const prisma = require('../../lib/prisma');
const { hasEbdAdminAccess } = require('../../lib/permissions');

const router = express.Router();

// GET /api/ebd/classes/:id/attendance — histórico de chamadas com records
router.get('/classes/:id/attendance', async (req, res) => {
    try {
        const orgId = req.orgId;
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const attendances = await prisma.ebdAttendance.findMany({
            where: { ebdClassId: req.params.id },
            select: {
                id: true, ebdClassId: true, data: true, notes: true,
                professorPresente: true, professorJustificado: true,
                segundoProfessorPresente: true, segundoProfessorJustificado: true,
                terceiroProfessorPresente: true, terceiroProfessorJustificado: true,
                records: {
                    select: {
                        id: true, ebdAttendanceId: true, ebdStudentId: true, presente: true, justificado: true,
                        ebdStudent: {
                            select: {
                                id: true, personId: true, ebdClassId: true, ativo: true,
                                person: { select: { id: true, name: true } }
                            }
                        }
                    }
                }
            },
            orderBy: { data: 'desc' }
        });
        res.json(attendances);
    } catch (error) {
        console.error('[EBD] Erro ao buscar chamadas:', error.message);
        res.status(500).json({ error: 'Erro ao buscar chamadas da classe: ' + error.message });
    }
});

// POST /api/ebd/classes/:id/attendance — upsert chamada por data
// body: { data, notes, records: [{ebdStudentId, presente}] }
router.post('/classes/:id/attendance', async (req, res) => {
    const {
        data, notes, records,
        professorPresente, professorJustificado,
        segundoProfessorPresente, segundoProfessorJustificado,
        terceiroProfessorPresente, terceiroProfessorJustificado
    } = req.body;
    const orgId = req.orgId;

    if (!data) return res.status(400).json({ error: 'Data da chamada é obrigatória' });

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
            return res.status(403).json({ error: 'Acesso negado. Apenas professores da classe ou administradores podem registrar chamada.' });
        }

        const ATTENDANCE_SELECT = {
            id: true, ebdClassId: true, data: true, notes: true,
            professorPresente: true, professorJustificado: true,
            segundoProfessorPresente: true, segundoProfessorJustificado: true,
            terceiroProfessorPresente: true, terceiroProfessorJustificado: true,
            records: { select: { id: true, ebdAttendanceId: true, ebdStudentId: true, presente: true, justificado: true } }
        };

        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.ebdAttendance.findFirst({
                where: { ebdClassId: req.params.id, data }
            });

            if (existing) {
                if (records !== undefined) {
                    await tx.ebdAttendanceRecord.deleteMany({ where: { ebdAttendanceId: existing.id } });
                }
                return await tx.ebdAttendance.update({
                    where: { id: existing.id },
                    data: {
                        notes: notes !== undefined ? notes : existing.notes,
                        professorPresente: professorPresente !== undefined ? professorPresente : existing.professorPresente,
                        professorJustificado: professorJustificado !== undefined ? professorJustificado : existing.professorJustificado,
                        segundoProfessorPresente: segundoProfessorPresente !== undefined ? segundoProfessorPresente : existing.segundoProfessorPresente,
                        segundoProfessorJustificado: segundoProfessorJustificado !== undefined ? segundoProfessorJustificado : existing.segundoProfessorJustificado,
                        terceiroProfessorPresente: terceiroProfessorPresente !== undefined ? terceiroProfessorPresente : existing.terceiroProfessorPresente,
                        terceiroProfessorJustificado: terceiroProfessorJustificado !== undefined ? terceiroProfessorJustificado : existing.terceiroProfessorJustificado,
                        records: records !== undefined ? {
                            create: records.map(r => ({
                                ebdStudentId: r.ebdStudentId,
                                presente: r.presente,
                                justificado: r.justificado || false
                            }))
                        } : undefined
                    },
                    select: ATTENDANCE_SELECT
                });
            } else {
                return await tx.ebdAttendance.create({
                    data: {
                        ebdClassId: req.params.id,
                        data,
                        notes: notes || null,
                        professorPresente: professorPresente || false,
                        professorJustificado: professorJustificado || false,
                        segundoProfessorPresente: segundoProfessorPresente || false,
                        segundoProfessorJustificado: segundoProfessorJustificado || false,
                        terceiroProfessorPresente: terceiroProfessorPresente || false,
                        terceiroProfessorJustificado: terceiroProfessorJustificado || false,
                        records: {
                            create: (records || []).map(r => ({
                                ebdStudentId: r.ebdStudentId,
                                presente: r.presente,
                                justificado: r.justificado || false
                            }))
                        }
                    },
                    select: ATTENDANCE_SELECT
                });
            }
        });

        res.json(result);
        if (req.log) req.log('UPDATE', 'ebd_attendance', req.params.id, `Chamada em ${data} com ${records?.length || 0} alunos`);
    } catch (error) {
        console.error('[EBD] Erro ao salvar chamada:', error.message);
        res.status(500).json({ error: 'Erro ao salvar chamada da classe' });
    }
});

// GET /api/ebd/attendance/all — todas as chamadas da org (para relatórios)
router.get('/attendance/all', async (req, res) => {
    try {
        const orgId = req.orgId;
        const attendances = await prisma.ebdAttendance.findMany({
            where: { ebdClass: { organizationId: orgId } },
            select: {
                id: true, ebdClassId: true, data: true, notes: true,
                professorPresente: true, professorJustificado: true,
                segundoProfessorPresente: true, segundoProfessorJustificado: true,
                terceiroProfessorPresente: true, terceiroProfessorJustificado: true,
                ebdClass: { select: { id: true, name: true } },
                records: {
                    select: {
                        id: true, ebdAttendanceId: true, ebdStudentId: true, presente: true, justificado: true,
                        ebdStudent: {
                            select: {
                                id: true, personId: true, ativo: true,
                                person: { select: { id: true, name: true } }
                            }
                        }
                    }
                }
            },
            orderBy: { data: 'desc' }
        });
        res.json(attendances);
    } catch (error) {
        console.error('[EBD] Erro ao buscar todas as chamadas:', error.message);
        res.status(500).json({ error: 'Erro ao buscar chamadas da EBD: ' + error.message });
    }
});

module.exports = router;
