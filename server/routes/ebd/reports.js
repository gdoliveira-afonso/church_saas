const express = require('express');
const prisma = require('../../lib/prisma');
const { hasEbdStrictAdminAccess } = require('../../lib/permissions');

const router = express.Router();

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
