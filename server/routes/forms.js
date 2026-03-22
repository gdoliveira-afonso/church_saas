const express = require('express');
const prisma = require('../lib/prisma');
const { sendPushToUsers } = require('../lib/pushNotification');
const router = express.Router();

// ------------------------------------------------------------------
// FORMS
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// FORMS
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const orgId = req.orgId;
        const forms = await prisma.form.findMany({ where: { organizationId: orgId } });
        const processed = forms.map(f => ({
            ...f,
            fields: f.fields ? JSON.parse(f.fields) : []
        }));
        res.json(processed);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar formulários' }); }
});

router.post('/', async (req, res) => {
    try {
        const orgId = req.orgId;
        if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });
        const body = req.body;
        const form = await prisma.form.create({
            data: {
                name: body.name,
                status: body.status || 'ativo',
                showOnLogin: body.showOnLogin || false,
                icon: body.icon || 'description',
                color: body.color || 'blue',
                subtitle: body.subtitle || null,
                personStatus: body.personStatus || null,
                fields: JSON.stringify(body.fields || []),
                organizationId: orgId
            }
        });
        form.fields = JSON.parse(form.fields);
        res.status(201).json(form);
    } catch (err) { res.status(500).json({ error: 'Erro ao criar formulário' }); }
});

router.put('/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const body = req.body;
        const existing = await prisma.form.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!existing) return res.status(404).json({ error: 'Formulário não encontrado' });

        const form = await prisma.form.update({
            where: { id: req.params.id },
            data: {
                name: body.name,
                status: body.status,
                showOnLogin: body.showOnLogin,
                icon: body.icon,
                color: body.color,
                subtitle: body.subtitle,
                personStatus: body.personStatus,
                fields: JSON.stringify(body.fields || [])
            }
        });
        form.fields = JSON.parse(form.fields);
        res.json(form);
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar formulário' }); }
});

router.delete('/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const existing = await prisma.form.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!existing) return res.status(404).json({ error: 'Formulário não encontrado' });

        await prisma.form.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao excluir formulário' }); }
});

// ------------------------------------------------------------------
// TRIAGE
// ------------------------------------------------------------------
router.get('/triage/all', async (req, res) => {
    try {
        const orgId = req.orgId;
        const triage = await prisma.triageQueue.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
            include: { form: true }
        });
        let processed = triage.map(t => ({
            ...t,
            data: t.data ? JSON.parse(t.data) : {},
            formName: t.form ? t.form.name : 'Formulário Excluído'
        }));

        if (req.user.role === 'LIDER_GERACAO') {
            processed = processed.filter(t => t.status === 'forwarded_generation' && String(t.data.generationId) === String(req.user.generationId));
        }

        res.json(processed);
    } catch (err) { 
        console.error('[Forms Triage Error]:', err);
        res.status(500).json({ error: 'Erro ao buscar fila de triagem: ' + err.message }); 
    }
});

router.post('/triage/new', async (req, res) => {
    try {
        const orgId = req.orgId;
        if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });
        const { formId, data } = req.body;
        const triage = await prisma.triageQueue.create({
            data: {
                formId,
                data: JSON.stringify(data || {}),
                organizationId: orgId
            }
        });
        triage.data = JSON.parse(triage.data);
        res.status(201).json(triage);
    } catch (err) { res.status(500).json({ error: 'Erro ao criar item na triagem' }); }
});

router.put('/triage/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const { status, payload } = req.body;
        const updateData = { status };

        const existing = await prisma.triageQueue.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!existing) return res.status(404).json({ error: 'Item não encontrado na triagem' });

        if (payload) {
            const currentData = existing.data ? JSON.parse(existing.data) : {};
            updateData.data = JSON.stringify({ ...currentData, ...payload });
        }

        const triage = await prisma.triageQueue.update({
            where: { id: req.params.id },
            data: updateData
        });

        if (status === 'forwarded_generation') {
            const targetGenId = payload?.generationId;
            if (targetGenId) {
                const leaders = await prisma.user.findMany({
                    where: {
                        organizationId: orgId,
                        role: 'LIDER_GERACAO',
                        generationId: String(targetGenId)
                    }
                });

                const nameField = updateData.data ?
                    (JSON.parse(updateData.data).Nome || JSON.parse(updateData.data)['Nome Completo'] || 'Um novo formulário')
                    : 'Novo cadastro';

                if (leaders.length > 0) {
                    const triageTitle = 'Nova Triagem';
                    const triageMsg = `${nameField} foi encaminhado(a) para a sua Geração!`;
                    await prisma.notification.createMany({
                        data: leaders.map(leader => ({
                            userId: leader.id,
                            title: triageTitle,
                            message: triageMsg,
                            action: '#/triage',
                            organizationId: orgId
                        }))
                    });
                    const leaderIds = leaders.map(l => l.id);
                    sendPushToUsers(leaderIds, { title: triageTitle, body: triageMsg, data: { action: '#/triage' } }).catch(() => {});
                }
            }
        }

        triage.data = JSON.parse(triage.data);
        res.json(triage);
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar triagem' }); }
});

router.delete('/triage/:id', async (req, res) => {
    try {
        const orgId = req.orgId;
        const existing = await prisma.triageQueue.findFirst({ where: { id: req.params.id, organizationId: orgId } });
        if (!existing) return res.status(404).json({ error: 'Item não encontrado' });

        await prisma.triageQueue.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao remover da triagem' }); }
});

module.exports = router;
