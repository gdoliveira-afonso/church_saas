const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

// ----------------------------------------------------------------------------
// CLASSES
// ----------------------------------------------------------------------------

// GET /api/ebd/classes — lista classes da organização
router.get('/classes', async (req, res) => {
    try {
        const orgId = req.orgId;
        const classes = await prisma.ebdClass.findMany({
            where: { organizationId: orgId, ativo: true },
            include: {
                professor: { select: { name: true } },
                segundoProfessor: { select: { name: true } },
                superintendente: { select: { name: true } },
                _count: { select: { students: true } }
            },
            orderBy: { nome: 'asc' }
        });
        res.json(classes);
    } catch (error) {
        console.error('[EBD] Erro ao listar classes:', error.message);
        res.status(500).json({ error: 'Erro ao listar classes da EBD' });
    }
});

// POST /api/ebd/classes — cria nova classe (ADMIN, SUPERVISOR)
router.post('/classes', async (req, res) => {
    const { nome, descricao, faixaEtaria, professorId, segundoProfessorId, superintendenteId, sala } = req.body;
    const orgId = req.orgId;

    if (!['ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores e supervisores.' });
    }

    if (!nome) return res.status(400).json({ error: 'Nome da classe é obrigatório' });

    try {
        const classe = await prisma.ebdClass.create({
            data: {
                nome,
                descricao: descricao || null,
                faixaEtaria: faixaEtaria || null,
                professorId: professorId || null,
                segundoProfessorId: segundoProfessorId || null,
                superintendenteId: superintendenteId || null,
                sala: sala || null,
                organizationId: orgId,
                ativo: true
            }
        });
        res.status(201).json(classe);
        req.log?.('CREATE', 'ebd_classes', classe.id, classe.nome);
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
            include: {
                professor: true,
                segundoProfessor: true,
                superintendente: true,
                students: {
                    include: { person: true }
                },
                attendances: {
                    orderBy: { data: 'desc' }
                }
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
    const { nome, descricao, faixaEtaria, professorId, segundoProfessorId, superintendenteId, sala } = req.body;
    const orgId = req.orgId;

    if (!['ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores e supervisores.' });
    }

    try {
        const existing = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId }
        });
        if (!existing) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const classe = await prisma.ebdClass.update({
            where: { id: req.params.id },
            data: {
                ...(nome !== undefined && { nome }),
                ...(descricao !== undefined && { descricao }),
                ...(faixaEtaria !== undefined && { faixaEtaria }),
                ...(professorId !== undefined && { professorId: professorId || null }),
                ...(segundoProfessorId !== undefined && { segundoProfessorId: segundoProfessorId || null }),
                ...(superintendenteId !== undefined && { superintendenteId: superintendenteId || null }),
                ...(sala !== undefined && { sala })
            }
        });
        res.json(classe);
        req.log?.('UPDATE', 'ebd_classes', classe.id, classe.nome);
    } catch (error) {
        console.error('[EBD] Erro ao atualizar classe:', error.message);
        res.status(500).json({ error: 'Erro ao atualizar classe da EBD' });
    }
});

// DELETE /api/ebd/classes/:id — desativa classe (soft delete) (ADMIN)
router.delete('/classes/:id', async (req, res) => {
    const orgId = req.orgId;

    if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }

    try {
        const existing = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { nome: true }
        });
        if (!existing) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        await prisma.ebdClass.update({
            where: { id: req.params.id },
            data: { ativo: false }
        });
        res.json({ success: true });
        req.log?.('DELETE', 'ebd_classes', req.params.id, existing.nome);
    } catch (error) {
        console.error('[EBD] Erro ao desativar classe:', error.message);
        res.status(500).json({ error: 'Erro ao desativar classe da EBD' });
    }
});

// ----------------------------------------------------------------------------
// ALUNOS
// ----------------------------------------------------------------------------

// GET /api/ebd/classes/:id/students — lista alunos da classe
router.get('/classes/:id/students', async (req, res) => {
    try {
        const orgId = req.orgId;
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const students = await prisma.ebdStudent.findMany({
            where: { ebdClassId: req.params.id },
            include: {
                person: { select: { name: true, phone: true, status: true } }
            },
            orderBy: { createdAt: 'asc' }
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

    if (!['ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores e supervisores.' });
    }

    try {
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        // Verifica se a pessoa pertence à mesma organização
        const person = await prisma.person.findFirst({
            where: { id: personId, organizationId: orgId }
        });
        if (!person) return res.status(404).json({ error: 'Pessoa não encontrada nesta organização' });

        // Verifica se já está matriculado
        const existing = await prisma.ebdStudent.findFirst({
            where: { ebdClassId: req.params.id, personId }
        });
        if (existing) return res.status(400).json({ error: 'Aluno já matriculado nesta classe' });

        const student = await prisma.ebdStudent.create({
            data: {
                ebdClassId: req.params.id,
                personId
            },
            include: {
                person: { select: { name: true, phone: true, status: true } }
            }
        });
        res.status(201).json(student);
        req.log?.('CREATE', 'ebd_students', student.id, person.name);
    } catch (error) {
        console.error('[EBD] Erro ao matricular aluno:', error.message);
        res.status(500).json({ error: 'Erro ao matricular aluno na classe' });
    }
});

// DELETE /api/ebd/classes/:id/students/:studentId — remove matrícula
router.delete('/classes/:id/students/:studentId', async (req, res) => {
    const orgId = req.orgId;

    if (!['ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores e supervisores.' });
    }

    try {
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const student = await prisma.ebdStudent.findFirst({
            where: { id: req.params.studentId, ebdClassId: req.params.id }
        });
        if (!student) return res.status(404).json({ error: 'Matrícula não encontrada' });

        await prisma.ebdStudent.delete({ where: { id: req.params.studentId } });
        res.json({ success: true });
        req.log?.('DELETE', 'ebd_students', req.params.studentId, null);
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
            where: { id: req.params.id, organizationId: orgId }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const attendances = await prisma.ebdAttendance.findMany({
            where: { ebdClassId: req.params.id },
            include: {
                records: {
                    include: {
                        student: {
                            include: { person: { select: { id: true, name: true } } }
                        }
                    }
                }
            },
            orderBy: { data: 'desc' }
        });
        res.json(attendances);
    } catch (error) {
        console.error('[EBD] Erro ao buscar chamadas:', error.message);
        res.status(500).json({ error: 'Erro ao buscar chamadas da classe' });
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
            where: { id: req.params.id, organizationId: orgId }
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
                    include: { records: true }
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
                    include: { records: true }
                });
            }
        });

        res.json(result);
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
            include: {
                ebdClass: { select: { id: true, nome: true } },
                records: {
                    include: {
                        student: {
                            include: { person: { select: { id: true, name: true } } }
                        }
                    }
                }
            },
            orderBy: { data: 'desc' }
        });
        res.json(attendances);
    } catch (error) {
        console.error('[EBD] Erro ao buscar todas as chamadas:', error.message);
        res.status(500).json({ error: 'Erro ao buscar chamadas da EBD' });
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
            where: { id: req.params.id, organizationId: orgId }
        });
        if (!classe) return res.status(404).json({ error: 'Classe não encontrada nesta organização' });

        const offerings = await prisma.ebdOffering.findMany({
            where: { ebdClassId: req.params.id, organizationId: orgId },
            include: {
                registradoPor: { select: { name: true } }
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

    if (!['ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores e supervisores.' });
    }

    try {
        const classe = await prisma.ebdClass.findFirst({
            where: { id: req.params.id, organizationId: orgId }
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
        req.log?.('CREATE', 'ebd_offerings', offering.id, `Oferta R$${valor}`);
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
            include: {
                ebdClass: { select: { id: true, nome: true } },
                registradoPor: { select: { name: true } }
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
// RELATÓRIO
// ----------------------------------------------------------------------------

// GET /api/ebd/reports/summary — resumo geral
router.get('/reports/summary', async (req, res) => {
    try {
        const orgId = req.orgId;

        // Total de classes ativas
        const totalClasses = await prisma.ebdClass.count({
            where: { organizationId: orgId, ativo: true }
        });

        // Total de alunos ativos (em classes ativas)
        const totalAlunos = await prisma.ebdStudent.count({
            where: { ebdClass: { organizationId: orgId, ativo: true } }
        });

        // Média de presença: percentual médio de presentes nas chamadas da org
        const todasChamadas = await prisma.ebdAttendance.findMany({
            where: { ebdClass: { organizationId: orgId } },
            include: {
                records: { select: { presente: true } }
            }
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

        // Total de ofertas do mês corrente
        const now = new Date();
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const ofertasMes = await prisma.ebdOffering.aggregate({
            where: {
                organizationId: orgId,
                data: { gte: inicioMes, lte: fimMes }
            },
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

module.exports = router;
