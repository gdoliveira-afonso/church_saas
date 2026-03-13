const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

// Campos seguros do EbdClass (sem superintendenteId que foi removido do schema)
const EBD_CLASS_SELECT = {
    id: true, name: true, faixaEtaria: true, sala: true,
    professorId: true, segundoProfessorId: true, ativo: true,
    organizationId: true, createdAt: true, updatedAt: true
};

// Verifica se o usuário tem acesso administrativo ao módulo EBD:
// roles ADMIN/SUPERVISOR/SUPERADMIN ou secondaryRole SUPERINTENDENTE_EBD
function hasEbdAdminAccess(req) {
    if (['ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(req.user?.role)) return true;
    try {
        const sr = Array.isArray(req.user.secondaryRoles)
            ? req.user.secondaryRoles
            : JSON.parse(req.user.secondaryRoles || '[]');
        return sr.includes('SUPERINTENDENTE_EBD');
    } catch { return false; }
}

// Verifica se o usuário tem acesso de admin restrito (apenas ADMIN/SUPERADMIN)
function hasEbdStrictAdminAccess(req) {
    if (['ADMIN', 'SUPERADMIN'].includes(req.user?.role)) return true;
    try {
        const sr = Array.isArray(req.user.secondaryRoles)
            ? req.user.secondaryRoles
            : JSON.parse(req.user.secondaryRoles || '[]');
        return sr.includes('SUPERINTENDENTE_EBD');
    } catch { return false; }
}

// ----------------------------------------------------------------------------
// CLASSES
// ----------------------------------------------------------------------------

// GET /api/ebd/classes — lista classes da organização
router.get('/classes', async (req, res) => {
    try {
        const orgId = req.orgId;
        // Professor vê apenas suas próprias classes; admins veem todas
        const isProfessorOnly = !hasEbdAdminAccess(req);
        const professorFilter = isProfessorOnly
            ? { OR: [{ professorId: req.user.id }, { segundoProfessorId: req.user.id }] }
            : {};
        const classes = await prisma.ebdClass.findMany({
            where: { organizationId: orgId, ativo: true, ...professorFilter },
            select: {
                id: true, name: true, faixaEtaria: true, sala: true,
                professorId: true, segundoProfessorId: true, ativo: true,
                organizationId: true, createdAt: true, updatedAt: true,
                professor: { select: { id: true, name: true } },
                segundoProfessor: { select: { id: true, name: true } },
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
    const { name, faixaEtaria, professorId, segundoProfessorId, sala } = req.body;
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
                professorId: true, segundoProfessorId: true, ativo: true,
                organizationId: true, createdAt: true, updatedAt: true,
                professor: { select: { id: true, name: true, username: true, role: true } },
                segundoProfessor: { select: { id: true, name: true, username: true, role: true } },
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
    const { name, faixaEtaria, professorId, segundoProfessorId, sala, ativo } = req.body;
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

// ----------------------------------------------------------------------------
// ALUNOS
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// CHAMADA
// ----------------------------------------------------------------------------

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
                records: {
                    select: {
                        id: true, ebdAttendanceId: true, ebdStudentId: true, presente: true,
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
    const { data, notes, records } = req.body;
    const orgId = req.orgId;

    if (!data) return res.status(400).json({ error: 'Data da chamada é obrigatória' });

    try {
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

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
                        records: records !== undefined ? {
                            create: records.map(r => ({
                                ebdStudentId: r.ebdStudentId,
                                presente: r.presente
                            }))
                        } : undefined
                    },
                    select: { id: true, ebdClassId: true, data: true, notes: true, records: { select: { id: true, ebdAttendanceId: true, ebdStudentId: true, presente: true } } }
                });
            } else {
                return await tx.ebdAttendance.create({
                    data: {
                        ebdClassId: req.params.id,
                        data,
                        notes: notes || null,
                        records: {
                            create: (records || []).map(r => ({
                                ebdStudentId: r.ebdStudentId,
                                presente: r.presente
                            }))
                        }
                    },
                    select: { id: true, ebdClassId: true, data: true, notes: true, records: { select: { id: true, ebdAttendanceId: true, ebdStudentId: true, presente: true } } }
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
                ebdClass: { select: { id: true, name: true } },
                records: {
                    select: {
                        id: true, ebdAttendanceId: true, ebdStudentId: true, presente: true,
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

// ----------------------------------------------------------------------------
// OFERTAS
// ----------------------------------------------------------------------------

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

    if (!hasEbdAdminAccess(req)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores e supervisores.' });
    }

    try {
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { id: true }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

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

// ----------------------------------------------------------------------------
// PESSOA — resumo EBD individual
// ----------------------------------------------------------------------------

// GET /api/ebd/person/:personId — matrícula e frequência de uma pessoa
router.get('/person/:personId', async (req, res) => {
    try {
        const orgId = req.orgId;
        const { personId } = req.params;

        const person = await prisma.person.findFirst({
            where: { id: personId, organizationId: orgId }
        });
        if (!person) return res.status(404).json({ error: 'Pessoa não encontrada' });

        const student = await prisma.ebdStudent.findFirst({
            where: { personId, ebdClass: { organizationId: orgId } },
            include: { ebdClass: { select: { id: true, name: true, faixaEtaria: true } } }
        });

        if (!student) return res.json({ enrolled: false });

        const records = await prisma.ebdAttendanceRecord.findMany({
            where: { ebdStudentId: student.id }
        });

        const total = records.length;
        const present = records.filter(r => r.presente).length;

        res.json({
            enrolled: true,
            studentId: student.id,
            class: student.ebdClass,
            totalAulas: total,
            totalPresente: present,
            percentual: total > 0 ? Math.round((present / total) * 100) : 0
        });
    } catch (error) {
        console.error('[EBD] Erro ao buscar resumo da pessoa:', error.message);
        res.status(500).json({ error: 'Erro ao buscar dados EBD da pessoa' });
    }
});

// ----------------------------------------------------------------------------
// RELATÓRIO
// ----------------------------------------------------------------------------

// GET /api/ebd/reports/summary — resumo geral
router.get('/reports/summary', async (req, res) => {
    try {
        const orgId = req.orgId;

        const totalClasses = await prisma.ebdClass.count({
            where: { organizationId: orgId, ativo: true }
        });

        const totalAlunos = await prisma.ebdStudent.count({
            where: { ebdClass: { organizationId: orgId, ativo: true } }
        });

        const todasChamadas = await prisma.ebdAttendance.findMany({
            where: { ebdClass: { organizationId: orgId } },
            include: { records: { select: { presente: true } } }
        });

        let mediaPresenca = 0;
        if (todasChamadas.length > 0) {
            const percentuais = todasChamadas
                .filter(a => a.records.length > 0)
                .map(a => {
                    const presentes = a.records.filter(r => r.presente).length;
                    return (presentes / a.records.length) * 100;
                });
            if (percentuais.length > 0) {
                mediaPresenca = percentuais.reduce((acc, p) => acc + p, 0) / percentuais.length;
            }
        }

        const now = new Date();
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const ofertasMes = await prisma.ebdOffering.aggregate({
            where: { organizationId: orgId, data: { gte: inicioMes, lte: fimMes } },
            _sum: { valor: true }
        });

        res.json({
            totalClasses,
            totalAlunos,
            mediaPresenca: Math.round(mediaPresenca * 10) / 10,
            totalOfertasMes: ofertasMes._sum.valor || 0
        });
    } catch (error) {
        console.error('[EBD] Erro ao gerar relatório:', error.message);
        res.status(500).json({ error: 'Erro ao gerar relatório da EBD' });
    }
});

// DELETE /api/ebd/all-data — Apagar todos os dados da EBD da organização (Perigo)
router.delete('/all-data', async (req, res) => {
    try {
        const orgId = req.orgId;
        if (!hasEbdStrictAdminAccess(req)) {
            return res.status(403).json({ error: 'Apenas administradores podem apagar os dados da EBD.' });
        }

        const classes = await prisma.ebdClass.findMany({
            where: { organizationId: orgId },
            select: { id: true }
        });
        const classIds = classes.map(c => c.id);

        if (classIds.length > 0) {
            await prisma.$transaction([
                prisma.ebdAttendanceRecord.deleteMany({ where: { ebdAttendance: { ebdClassId: { in: classIds } } } }),
                prisma.ebdAttendance.deleteMany({ where: { ebdClassId: { in: classIds } } }),
                prisma.ebdOffering.deleteMany({ where: { ebdClassId: { in: classIds } } }),
                prisma.ebdStudent.deleteMany({ where: { ebdClassId: { in: classIds } } }),
                prisma.ebdClass.deleteMany({ where: { organizationId: orgId } })
            ]);
        }

        res.json({ success: true, message: 'Dados da EBD apagados com sucesso.' });
        if (req.log) req.log('DELETE', 'ebd_all', 'all', 'Apagou todos os dados do módulo EBD');
    } catch (error) {
        console.error('[EBD] Erro ao limpar dados:', error);
        res.status(500).json({ error: 'Erro ao apagar dados da EBD' });
    }
});

module.exports = router;
