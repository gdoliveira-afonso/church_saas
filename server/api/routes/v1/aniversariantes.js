const express = require('express');
const router = express.Router();
const prisma = require('../../../lib/prisma');
const { requirePermission } = require('../../middleware/apiAuth');

function formatMD(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${mm}-${dd}`;
}

function buildDates(when) {
    const today = new Date();
    if (when === 'today') {
        return [formatMD(today)];
    }
    if (when === 'tomorrow') {
        const t = new Date(today);
        t.setDate(t.getDate() + 1);
        return [formatMD(t)];
    }
    // week: próximos 7 dias incluindo hoje
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push(formatMD(d));
    }
    return dates;
}

// GET /api/v1/aniversariantes?when=today|tomorrow|week (default: today+tomorrow)
router.get('/', requirePermission('read_membros'), async (req, res) => {
    try {
        const orgId = req.apiKey.organizationId;
        const { when = 'today+tomorrow' } = req.query;

        let targetDates;
        if (when === 'today+tomorrow' || !when) {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            targetDates = [formatMD(today), formatMD(tomorrow)];
        } else {
            targetDates = buildDates(when);
        }

        const todayMD = formatMD(new Date());

        // Busca pessoas com aniversário nas datas alvo
        const people = await prisma.person.findMany({
            where: {
                organizationId: orgId,
                OR: targetDates.map(md => ({ birthdate: { endsWith: md } }))
            },
            include: {
                cell: {
                    select: { id: true, name: true, meetingDay: true, meetingTime: true, leaderId: true, viceLeaderId: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Monta payload enriquecido
        const result = await Promise.all(people.map(async (person) => {
            const [lider, vice] = await Promise.all([
                person.cell?.leaderId ? prisma.user.findUnique({
                    where: { id: person.cell.leaderId },
                    select: { id: true, name: true, person: { select: { phone: true } } }
                }) : null,
                person.cell?.viceLeaderId ? prisma.user.findUnique({
                    where: { id: person.cell.viceLeaderId },
                    select: { id: true, name: true, person: { select: { phone: true } } }
                }) : null
            ]);

            const birthdateMD = person.birthdate ? person.birthdate.slice(-5) : null;
            const isToday = birthdateMD === todayMD;

            return {
                isToday,
                pessoa: {
                    id: person.id,
                    name: person.name,
                    phone: person.phone || null,
                    email: person.email || null,
                    birthdate: person.birthdate || null,
                    status: person.status
                },
                celula: person.cell ? {
                    id: person.cell.id,
                    name: person.cell.name,
                    meetingDay: person.cell.meetingDay || null,
                    meetingTime: person.cell.meetingTime || null
                } : null,
                lider: lider ? { id: lider.id, name: lider.name, phone: lider.person?.phone || null } : null,
                vice: vice ? { id: vice.id, name: vice.name, phone: vice.person?.phone || null } : null
            };
        }));

        res.json({ success: true, data: result, meta: { total: result.length, when } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar aniversariantes.' });
    }
});

module.exports = router;
