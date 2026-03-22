const express = require('express');
const prisma = require('../../lib/prisma');

const router = express.Router();

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

        let isProfessor = false;
        let teachingClasses = [];
        if (person.userId) {
            const classesFound = await prisma.ebdClass.findMany({
                where: {
                    organizationId: orgId,
                    ativo: true,
                    OR: [
                        { professorId: person.userId },
                        { segundoProfessorId: person.userId },
                        { terceiroProfessorId: person.userId }
                    ]
                },
                select: { name: true }
            });
            if (classesFound.length > 0) {
                isProfessor = true;
                teachingClasses = classesFound.map(c => c.name);
            }
        }

        if (!student) return res.json({ enrolled: false, isProfessor, teachingClasses });

        const records = await prisma.ebdAttendanceRecord.findMany({
            where: { ebdStudentId: student.id }
        });

        const total = records.length;
        const present = records.filter(r => r.presente).length;

        res.json({
            enrolled: true,
            isProfessor,
            teachingClasses,
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

module.exports = router;
