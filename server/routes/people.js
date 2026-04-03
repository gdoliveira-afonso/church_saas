const express = require('express');
const prisma = require('../lib/prisma');
const { getNotificationConfig } = require('./config');
const { sendPushToUsers } = require('../lib/pushNotification');
const { dispatchWebhook } = require('../api/controllers/webhooksController');

const router = express.Router();

// Listar todas as pessoas da organização
router.get('/', async (req, res) => {
    try {
        const orgId = req.orgId;
        let whereClause = { organizationId: orgId };
        
        if (req.user.role === 'LIDER_GERACAO') {
            if (!req.user.generationId) return res.json([]);
            const genCells = await prisma.cell.findMany({
                where: { generationId: req.user.generationId, organizationId: orgId },
                select: { id: true }
            });
            whereClause.cellId = { in: genCells.map(c => c.id) };
        }

        const people = await prisma.person.findMany({
            where: whereClause,
            include: {
                cell: { select: { id: true, name: true, generationId: true } },
                consolidation: true,
                personTracks: true
            }
        });
        
        const processed = people.map(p => {
            const tracksData = {};
            if (p.personTracks) {
                p.personTracks.forEach(pt => tracksData[pt.trackId] = pt.completed);
            }
            delete p.personTracks;
            return { ...p, tracksData };
        });
        res.json(processed);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar pessoas' });
    }
});

// Busca pessoa por ID (dentro da organização)
router.get('/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const person = await prisma.person.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            include: {
                cell: { select: { id: true, name: true, generationId: true } },
                consolidation: true,
                personTracks: { include: { track: true } },
                pastoralNotes: { orderBy: { date: 'desc' } },
                visits: { orderBy: { date: 'desc' } }
            }
        });
        if (!person) return res.status(404).json({ error: 'Pessoa não encontrada nesta organização' });

        const tracksData = {};
        if (person.personTracks) {
            person.personTracks.forEach(pt => tracksData[pt.trackId] = pt.completed);
        }
        person.tracksData = tracksData;

        res.json(person);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar pessoa' });
    }
});

// Cadastra nova pessoa (vinculado à organização)
router.post('/', async (req, res) => {
    try {
        const orgId = req.orgId;
        if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });

        if (!['ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        const data = req.body;
        
        const createData = {
            name: data.name,
            phone: data.phone,
            email: data.email,
            birthdate: data.birthdate,
            address: data.address,
            status: data.status || 'Visitante',
            howKnown: data.howKnown,
            previousCell: data.previousCell,
            returnReason: data.returnReason,
            prayerRequest: data.prayerRequest,
            cellId: data.cellId || null,
            extraData: data.extraData || null,
            organizationId: orgId
        };

        if (data.tracksData) {
            const tracks = Object.keys(data.tracksData).filter(tId => data.tracksData[tId]);
            if (tracks.length > 0) {
                createData.personTracks = {
                    create: tracks.map(tId => ({ trackId: tId, completed: true }))
                };
            }
        }

        if (createData.status === 'Novo Convertido') {
            createData.consolidation = {
                create: { status: 'PENDING' }
            };
        }

        const person = await prisma.person.create({
            data: createData,
            include: { consolidation: true }
        });

        if (createData.cellId) {
            const cell = await prisma.cell.findFirst({
                where: { id: createData.cellId, organizationId: orgId },
                select: { id: true, leaderId: true, viceLeaderId: true, name: true }
            });
            if (cell) {
                // Notificações in-app + push
                const notifCfg = await getNotificationConfig(orgId);
                if (notifCfg.newMember?.enabled !== false && (cell.leaderId || cell.viceLeaderId)) {
                    const notifsToCreate = [];
                    const msg = `${person.name} foi adicionado(a) à sua célula (${cell.name}). Verifique a lista de membros.`;
                    const actionUrl = `#/profile?id=${person.id}`;
                    if (cell.leaderId) notifsToCreate.push({ userId: cell.leaderId, title: "Novo membro", message: msg, action: actionUrl, organizationId: orgId });
                    if (cell.viceLeaderId) notifsToCreate.push({ userId: cell.viceLeaderId, title: "Novo membro", message: msg, action: actionUrl, organizationId: orgId });
                    if (notifsToCreate.length > 0) {
                        await prisma.notification.createMany({ data: notifsToCreate });
                        const recipientIds = notifsToCreate.map(n => n.userId);
                        sendPushToUsers(recipientIds, { title: 'Novo membro', body: msg, data: { action: actionUrl } }).catch(() => {});
                    }
                }
                // Webhook — dispara independente da config de notificações
                const leaderUser = cell.leaderId ? await prisma.user.findUnique({
                    where: { id: cell.leaderId },
                    select: { id: true, name: true, person: { select: { phone: true } } }
                }) : null;
                dispatchWebhook('notificacao.membro_adicionado', {
                    pessoa: { id: person.id, name: person.name, phone: person.phone || null, email: person.email || null, status: person.status },
                    celula: { id: cell.id, name: cell.name },
                    lider: leaderUser ? { id: leaderUser.id, name: leaderUser.name, phone: leaderUser.person?.phone || null } : null,
                    adicionadoEm: new Date().toISOString()
                }, orgId).catch(() => {});
            }
        }

        res.status(201).json({ ...person, tracksData: data.tracksData || {} });
        req.log?.('CREATE', 'people', person.id, person.name);

        // Marcos iniciais
        const milestoneBase = { organizationId: orgId };
        if (createData.status && STATUS_MILESTONES[createData.status]) {
            const m = STATUS_MILESTONES[createData.status];
            await createMilestone(person.id, { type: m.type, label: m.label, icon: m.icon, color: m.color, ...milestoneBase });
        } else {
            await createMilestone(person.id, { type: 'STATUS_CHANGE', label: 'Cadastrado no sistema', icon: 'person_add', color: 'blue', ...milestoneBase });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar pessoa', details: error.message });
    }
});

// Atualiza pessoa (dentro da organização)
router.put('/:id', async (req, res) => {
    const data = req.body;
    const orgId = req.orgId;
    try {
        const existing = await prisma.person.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            include: { consolidation: true, personTracks: true, cell: true }
        });

        if (!existing) return res.status(404).json({ error: 'Pessoa não encontrada nesta organização' });

        const updateData = {
            name: data.name,
            phone: data.phone,
            email: data.email,
            birthdate: data.birthdate,
            address: data.address,
            status: data.status,
            howKnown: data.howKnown,
            previousCell: data.previousCell,
            returnReason: data.returnReason,
            prayerRequest: data.prayerRequest,
            cellId: data.cellId || null,
            extraData: data.extraData || undefined,
        };

        if (data.status === 'Novo Convertido' && existing.status !== 'Novo Convertido' && !existing.consolidation) {
            updateData.consolidation = { create: { status: 'PENDING' } };
        } else if (data.consolidationStatus && existing.consolidation) {
            updateData.consolidation = {
                update: {
                    status: data.consolidationStatus,
                    completedDate: data.consolidationStatus === 'COMPLETED' ? new Date() : null
                }
            };
        }

        if (data.tracksData) {
            const tracks = Object.keys(data.tracksData).filter(tId => data.tracksData[tId]);
            updateData.personTracks = {
                deleteMany: {},
                create: tracks.map(tId => ({ trackId: tId, completed: true }))
            };
        }

        const person = await prisma.person.update({
            where: { id: req.params.id },
            data: updateData,
            include: { consolidation: true, personTracks: { include: { track: true } } }
        });

        res.json({ ...person, tracksData: data.tracksData || {} });
        req.log?.('UPDATE', 'people', req.params.id, person.name);

        // Marcos automáticos pós-atualização (não bloqueiam a resposta)
        (async () => {
            try {
                // 1. Mudança de status → marco
                if (existing.status !== data.status && data.status && STATUS_MILESTONES[data.status]) {
                    const m = STATUS_MILESTONES[data.status];
                    await createMilestone(person.id, { type: m.type, label: m.label, icon: m.icon, color: m.color, organizationId: orgId });
                }

                // 2. Tracks recém-marcadas → marco (ignora desmarcadas — marco permanece)
                if (data.tracksData) {
                    const existingTrackIds = new Set(existing.personTracks.map(pt => pt.trackId));
                    const newTrackIds = Object.keys(data.tracksData).filter(tId => data.tracksData[tId]);
                    const addedTrackIds = newTrackIds.filter(tId => !existingTrackIds.has(tId));
                    if (addedTrackIds.length > 0) {
                        const addedTracks = await prisma.track.findMany({ where: { id: { in: addedTrackIds } } });
                        for (const track of addedTracks) {
                            const isRetiro = track.category === 'retiros';
                            await createMilestone(person.id, {
                                type: isRetiro ? 'RETIRO_COMPLETED' : 'TRACK_COMPLETED',
                                label: track.name,
                                icon: track.icon || 'emoji_events',
                                color: track.color || 'emerald',
                                organizationId: orgId
                            });
                        }
                    }
                }

                // 3. Mudança de célula → marco
                if ((existing.cellId || null) !== (data.cellId || null) && data.cellId) {
                    const newCell = await prisma.cell.findFirst({ where: { id: data.cellId }, select: { name: true } });
                    if (newCell) {
                        await createMilestone(person.id, {
                            type: 'CELL_CHANGE',
                            label: `Entrou para ${newCell.name}`,
                            icon: 'groups',
                            color: 'teal',
                            organizationId: orgId
                        });
                    }
                }

                // 4. Webhook — mudança de status
                if (existing.status !== data.status && data.status) {
                    dispatchWebhook('membro.status.changed', {
                        pessoa: { id: person.id, name: person.name },
                        statusAnterior: existing.status,
                        statusNovo: data.status
                    }, orgId).catch(() => {});
                }

                // 5. Push + Webhook — aniversário salvo = hoje
                if (data.birthdate && data.birthdate !== existing.birthdate) {
                    const hoje = new Date();
                    const aniv = new Date(data.birthdate);
                    if (aniv.getUTCMonth() === hoje.getMonth() && aniv.getUTCDate() === hoje.getDate()) {
                        const celula = existing.cell;
                        const liderUser = celula?.leaderId ? await prisma.user.findUnique({
                            where: { id: celula.leaderId },
                            select: { id: true, name: true, person: { select: { phone: true } } }
                        }) : null;
                        const lideresGeracao = celula?.generationId ? await prisma.user.findMany({
                            where: { role: 'LIDER_GERACAO', generationId: celula.generationId, organizationId: orgId },
                            select: { id: true, name: true, person: { select: { phone: true } } }
                        }) : [];
                        const supervisores = await prisma.user.findMany({
                            where: { role: 'SUPERVISOR', organizationId: orgId },
                            select: { id: true, name: true, person: { select: { phone: true } } }
                        });

                        // Push notification + registro in-app para líder, líderes de geração e supervisores
                        const notifTitle = '🎉 Aniversário Hoje!';
                        const notifMsg = `Hoje é o aniversário de ${person.name} (${celula?.name || 'Sem Célula'})! Parabenize esta pessoa!`;
                        const actionUrl = `#/profile?id=${person.id}`;
                        const recipientIds = new Set();
                        if (liderUser) recipientIds.add(liderUser.id);
                        lideresGeracao.forEach(u => recipientIds.add(u.id));
                        supervisores.forEach(u => recipientIds.add(u.id));
                        if (person.userId) recipientIds.delete(person.userId);

                        if (recipientIds.size > 0) {
                            const ids = Array.from(recipientIds);
                            await prisma.notification.createMany({
                                data: ids.map(userId => ({ userId, organizationId: orgId, title: notifTitle, message: notifMsg, action: actionUrl })),
                                skipDuplicates: true
                            });
                            sendPushToUsers(ids, { title: notifTitle, body: notifMsg, data: { action: actionUrl } }).catch(() => {});
                        }

                        dispatchWebhook('notificacao.aniversario', {
                            isToday: true,
                            pessoa: { id: person.id, name: person.name, phone: person.phone || null, birthdate: data.birthdate },
                            celula: celula ? { id: celula.id, name: celula.name } : null,
                            lider: liderUser ? { id: liderUser.id, name: liderUser.name, phone: liderUser.person?.phone || null } : null,
                            liderGeracao: lideresGeracao.map(u => ({ id: u.id, name: u.name, phone: u.person?.phone || null })),
                            supervisores: supervisores.map(u => ({ id: u.id, name: u.name, phone: u.person?.phone || null }))
                        }, orgId).catch(() => {});
                    }
                }
            } catch (e) { console.error('Erro ao criar marcos automáticos:', e.message); }
        })();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar pessoa' });
    }
});

// Deleta pessoa (dentro da organização)
router.delete('/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const person = await prisma.person.findFirst({
            where: { id: req.params.id, organizationId: orgId },
            select: { name: true }
        });
        if (!person) return res.status(404).json({ error: 'Pessoa não encontrada nesta organização' });

        if (!['ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        await prisma.person.delete({ where: { id: req.params.id } });
        res.json({ success: true });
        req.log?.('DELETE', 'people', req.params.id, person.name);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar pessoa' });
    }
});

const STATUS_MILESTONES = {
    'Novo Convertido': { label: 'Decisão de Fé', icon: 'favorite', color: 'emerald', type: 'STATUS_CHANGE' },
    'Membro': { label: 'Tornou-se Membro', icon: 'verified', color: 'primary', type: 'STATUS_CHANGE' },
    'Reconciliação': { label: 'Reconciliação', icon: 'handshake', color: 'purple', type: 'STATUS_CHANGE' },
    'Líder': { label: 'Líder de Célula', icon: 'shield_person', color: 'indigo', type: 'ROLE_CHANGE' },
    'Vice-Líder': { label: 'Vice-Líder de Célula', icon: 'supervisor_account', color: 'cyan', type: 'ROLE_CHANGE' },
};

async function createMilestone(personId, data) {
    try {
        // data deve conter organizationId
        await prisma.personMilestone.create({ data: { personId, ...data } });
    } catch (e) { console.error('Erro ao criar marco:', e.message); }
}

// Busca milestones de uma pessoa (dentro da organização)
router.get('/:id/milestones', async (req, res) => {
    try {
        const orgId = req.orgId;
        const person = await prisma.person.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!person) return res.status(404).json({ error: 'Não encontrado' });

        const milestones = await prisma.personMilestone.findMany({
            where: { personId: req.params.id },
            orderBy: { date: 'desc' }
        });
        res.json(milestones);
    } catch (e) { res.status(500).json({ error: 'Erro ao buscar marcos' }); }
});

// Marco manual
router.post('/:id/milestones', async (req, res) => {
    try {
        const orgId = req.orgId;
        const person = await prisma.person.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!person) return res.status(404).json({ error: 'Não encontrado' });

        const m = await prisma.personMilestone.create({
            data: {
                personId: req.params.id,
                type: 'MANUAL',
                label: req.body.label,
                detail: req.body.detail || null,
                icon: req.body.icon || 'star',
                color: req.body.color || 'amber',
                date: req.body.date ? new Date(req.body.date) : new Date(),
                organizationId: orgId
            }
        });
        res.status(201).json(m);
    } catch (e) { res.status(500).json({ error: 'Erro ao criar marco' }); }
});

// POST /api/people/import — importar membros via Excel/XLSX (Admin/Supervisor)
router.post('/import', async (req, res) => {
    try {
        if (!['ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        const orgId = req.orgId;
        const { rows } = req.body; // Array de objetos já parseados pelo frontend
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'Nenhuma linha válida enviada' });
        }

        const VALID_STATUSES = ['Novo Convertido', 'Membro', 'Reconciliação', 'Visitante', 'Inativo', 'Afastado', 'Mudou-se', 'Líder', 'Vice-Líder'];
        let created = 0;
        const errors = [];

        for (const row of rows) {
            const name = (row['Nome'] || row['name'] || '').trim();
            if (!name) { errors.push(`Linha sem nome ignorada`); continue; }

            const status = VALID_STATUSES.includes(row['Status'] || row['status']) ? (row['Status'] || row['status']) : 'Membro';
            const phone = (row['Telefone'] || row['phone'] || '').trim();
            const address = (row['Endereço'] || row['address'] || '').trim();
            const rawBirth = (row['Data de Nascimento'] || row['data_nascimento'] || row['birthdate'] || '').trim();
            let birthdate = null;
            if (rawBirth) {
                // Aceita DD/MM/YYYY ou YYYY-MM-DD
                const parts = rawBirth.includes('/') ? rawBirth.split('/') : null;
                if (parts && parts.length === 3) {
                    birthdate = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
                } else if (rawBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    birthdate = new Date(rawBirth);
                }
                if (birthdate && isNaN(birthdate.getTime())) birthdate = null;
            }

            try {
                await prisma.person.create({
                    data: { name, status, phone: phone || null, address: address || null, birthdate: birthdate || null, organizationId: orgId }
                });
                created++;
            } catch (e) {
                errors.push(`Erro ao criar "${name}": ${e.message}`);
            }
        }

        req.log?.('CREATE', 'people', null, `Importação Excel: ${created} criados`);
        res.json({ created, errors, total: rows.length });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao importar planilha', details: e.message });
    }
});

module.exports = router;
