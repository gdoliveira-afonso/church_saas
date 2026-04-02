const express = require('express');
const prisma = require('../lib/prisma');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const router = express.Router();
const { provisionNewOrganization } = require('../services/autoProvisioning');
const { PLANOS_VALIDOS } = require('../lib/planLimits');

const JWT_SECRET = process.env.JWT_SECRET;

const ensureSuperadmin = (req, res, next) => {
    if (req.user?.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Acesso negado. Apenas Super Administradores.' });
    }
    next();
};

// André/DBA: Cascade delete seguro — remove todos os dados da org em ordem correta de dependências
async function deleteOrgCascade(orgId) {
    await prisma.$transaction(async (tx) => {
        const w = { organizationId: orgId };
        await tx.webhookLog.deleteMany({ where: { webhook: w } });
        await tx.webhook.deleteMany({ where: w });
        await tx.apiKey.deleteMany({ where: w });
        await tx.activityLog.deleteMany({ where: w });
        await tx.notification.deleteMany({ where: w });
        await tx.triageQueue.deleteMany({ where: w });
        await tx.form.deleteMany({ where: w });
        await tx.systemConfig.deleteMany({ where: w });
        await tx.cellJustification.deleteMany({ where: w });
        await tx.cellCancellation.deleteMany({ where: w });
        await tx.eventException.deleteMany({ where: w });
        await tx.event.deleteMany({ where: w });
        await tx.personTrack.deleteMany({ where: { person: w } });
        await tx.track.deleteMany({ where: w });
        await tx.visit.deleteMany({ where: w });
        await tx.pastoralNote.deleteMany({ where: w });
        await tx.attendanceRecord.deleteMany({ where: { attendance: { organizationId: orgId } } });
        await tx.attendance.deleteMany({ where: w });
        await tx.personMilestone.deleteMany({ where: w });
        await tx.consolidation.deleteMany({ where: { person: w } });
        await tx.ebdAttendanceRecord.deleteMany({ where: { ebdAttendance: { ebdClass: { organizationId: orgId } } } });
        await tx.ebdAttendance.deleteMany({ where: { ebdClass: { organizationId: orgId } } });
        await tx.ebdOffering.deleteMany({ where: { organizationId: orgId } });
        await tx.ebdStudent.deleteMany({ where: { ebdClass: { organizationId: orgId } } });
        await tx.ebdClass.deleteMany({ where: { organizationId: orgId } });
        await tx.person.deleteMany({ where: w });
        await tx.cell.deleteMany({ where: w });
        await tx.generation.deleteMany({ where: w });
        await tx.user.deleteMany({ where: w });
        await tx.organization.delete({ where: { id: orgId } });
    }, { timeout: 30000 });
}

// GET /api/admin/organizations — Lista todas as organizações
router.get('/', ensureSuperadmin, async (req, res) => {
    try {
        const orgs = await prisma.organization.findMany({
            include: { _count: { select: { users: true, people: true, cells: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orgs);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar organizações' });
    }
});

// GET /api/admin/organizations/stats — Estatísticas globais da plataforma
router.get('/stats', ensureSuperadmin, async (req, res) => {
    try {
        const [orgCount, activeOrgs, userCount, personCount, cellCount] = await Promise.all([
            prisma.organization.count(),
            prisma.organization.count({ where: { status: 'active' } }),
            prisma.user.count({ where: { organizationId: { not: null } } }),
            prisma.person.count(),
            prisma.cell.count()
        ]);
        res.json({
            organizations: orgCount,
            activeOrganizations: activeOrgs,
            inactiveOrganizations: orgCount - activeOrgs,
            users: userCount,
            people: personCount,
            cells: cellCount
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar estatísticas globais' });
    }
});

// GET /api/admin/organizations/search — Busca global de orgs
router.get('/search', ensureSuperadmin, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
        const orgs = await prisma.organization.findMany({
            where: {
                OR: [
                    { name: { contains: q } },
                    { slug: { contains: q } },
                    { subdomain: { contains: q } },
                    { customDomain: { contains: q } },
                    { congregationName: { contains: q } }
                ]
            },
            include: { _count: { select: { users: true, people: true, cells: true } } },
            take: 20
        });
        res.json(orgs);
    } catch (err) {
        res.status(500).json({ error: 'Erro na busca' });
    }
});

// GET /api/admin/organizations/:id/users — Lista usuários de uma org
router.get('/:id/users', ensureSuperadmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { organizationId: req.params.id },
            select: { id: true, name: true, username: true, role: true, createdAt: true },
            orderBy: { role: 'asc' }
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar usuários da organização' });
    }
});

// POST /api/admin/organizations — Criar nova organização + auto-provisioning + admin opcional
router.post('/', ensureSuperadmin, async (req, res) => {
    try {
        const { name, slug, subdomain, congregationName, primaryColor, customDomain, plan,
                cellsEnabled, ebdEnabled,
                adminName, adminUsername, adminPassword } = req.body;

        if (!name || !slug) return res.status(400).json({ error: 'Nome e slug são obrigatórios' });

        if (!/^[a-z0-9-]+$/.test(slug)) {
            return res.status(400).json({ error: 'Slug deve conter apenas letras minúsculas, números e hífens' });
        }

        if (plan && !PLANOS_VALIDOS.includes(plan)) {
            return res.status(400).json({ error: `Plano inválido. Use: ${PLANOS_VALIDOS.join(', ')}` });
        }

        // Verifica unicidade antecipada para mensagens claras
        const existingSlug = await prisma.organization.findFirst({ where: { OR: [{ slug }, { subdomain: slug }] } });
        if (existingSlug) return res.status(400).json({ error: `O slug "${slug}" já está em uso por outra igreja.` });

        if (customDomain) {
            const existingDomain = await prisma.organization.findFirst({ where: { customDomain } });
            if (existingDomain) return res.status(400).json({ error: `O domínio "${customDomain}" já está cadastrado.` });
        }

        // Cria org + admin em transação atômica — se o admin falhar, a org é revertida (sem órfãs)
        let org, adminCreated = null;

        const hashedAdminPassword = (adminUsername && adminPassword)
            ? await bcrypt.hash(adminPassword, 10)
            : null;

        await prisma.$transaction(async (tx) => {
            org = await tx.organization.create({
                data: {
                    name,
                    slug,
                    subdomain: subdomain || slug,
                    congregationName: congregationName || name,
                    primaryColor: primaryColor || '#0f172a',
                    customDomain: customDomain || null,
                    plan: plan || 'demo',
                    cellsEnabled: cellsEnabled !== undefined ? Boolean(cellsEnabled) : true,
                    ebdEnabled: ebdEnabled !== undefined ? Boolean(ebdEnabled) : false,
                    status: 'active'
                }
            });

            if (adminUsername && hashedAdminPassword) {
                const admin = await tx.user.create({
                    data: {
                        name: adminName || 'Administrador',
                        username: adminUsername,
                        password: hashedAdminPassword,
                        role: 'ADMIN',
                        organizationId: org.id
                    }
                });
                adminCreated = { id: admin.id, name: admin.name, username: admin.username, role: admin.role };
            }
        });

        // Provisioning pós-transação (não-crítico: falha aqui não desfaz a org)
        await provisionNewOrganization(org.id).catch(e => console.warn('[Org Provision]', e.message));

        // Seed das trilhas padrão para a nova organização
        await prisma.track.createMany({
            data: [
                { id: `t-waterBaptism-${org.id}`, name: 'Batismo nas Águas', category: 'espiritual', icon: 'water_drop', color: 'blue', organizationId: org.id },
                { id: `t-holySpiritBaptism-${org.id}`, name: 'Batismo com o Espírito Santo', category: 'espiritual', icon: 'local_fire_department', color: 'orange', organizationId: org.id },
                { id: `t-leadersSchool-${org.id}`, name: 'Escola de Líderes', category: 'espiritual', icon: 'school', color: 'purple', organizationId: org.id },
                { id: `t-encounter-${org.id}`, name: 'Encontro com Deus', category: 'retiros', icon: 'volunteer_activism', color: 'emerald', organizationId: org.id },
            ],
            skipDuplicates: true
        }).catch(e => console.warn('[Org Tracks Seed]', e.message));

        res.status(201).json({ ...org, adminCreated });
    } catch (err) {
        if (err.code === 'P2002') {
            const field = err.meta?.target?.[0];
            if (field === 'username') return res.status(400).json({ error: 'Este nome de usuário já existe nesta organização.' });
            return res.status(400).json({ error: 'Slug, subdomínio ou domínio já em uso por outra igreja.' });
        }
        console.error('[Org Create]', err);
        res.status(500).json({ error: 'Erro ao criar organização: ' + err.message });
    }
});

// POST /api/admin/organizations/:id/users — Criar usuário para uma org
router.post('/:id/users', ensureSuperadmin, async (req, res) => {
    const { id } = req.params;
    const { name, username, password, role } = req.body;
    try {
        if (!username || !password) return res.status(400).json({ error: 'Username e senha são obrigatórios' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name: name || 'Administrador', username, password: hashedPassword, role: role || 'ADMIN', organizationId: id }
        });
        res.status(201).json({ id: user.id, name: user.name, username: user.username, role: user.role });
    } catch (err) {
        if (err.code === 'P2002') return res.status(400).json({ error: 'Username já em uso' });
        res.status(500).json({ error: 'Erro ao criar usuário para organização' });
    }
});

// POST /api/admin/organizations/login-as/:userId — Superadmin assume identidade
router.post('/login-as/:userId', ensureSuperadmin, async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, include: { organization: true } });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        const tokenPayload = {
            id: user.id, username: user.username, role: user.role,
            generationId: user.generationId, organizationId: user.organizationId,
            version: user.tokenVersion || 0, isSuperadminImpersonation: true
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '2h' });
        res.json({
            token,
            user: {
                id: user.id, name: user.name, username: user.username, role: user.role,
                organizationId: user.organizationId,
                organization: user.organization ? {
                    name: user.organization.name, slug: user.organization.slug,
                    logoUrl: user.organization.logoUrl, primaryColor: user.organization.primaryColor,
                    cellsEnabled: user.organization.cellsEnabled,
                    ebdEnabled: user.organization.ebdEnabled,
                    financialEnabled: user.organization.financialEnabled
                } : null
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao gerar token de impersonação' });
    }
});

// PUT /api/admin/organizations/:id — Atualizar organização
router.put('/:id', ensureSuperadmin, async (req, res) => {
    try {
        const { name, slug, subdomain, congregationName, congregationAddress, pastorName,
                nucleus, primaryColor, loginMessage, status, plan, customDomain,
                cellsEnabled, ebdEnabled } = req.body;

        if (slug && !/^[a-z0-9-]+$/.test(slug)) {
            return res.status(400).json({ error: 'Slug deve conter apenas letras minúsculas, números e hífens' });
        }

        if (plan && !PLANOS_VALIDOS.includes(plan)) {
            return res.status(400).json({ error: `Plano inválido. Use: ${PLANOS_VALIDOS.join(', ')}` });
        }

        const org = await prisma.organization.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(slug && { slug }),
                ...(subdomain !== undefined && { subdomain }),
                ...(congregationName !== undefined && { congregationName }),
                ...(congregationAddress !== undefined && { congregationAddress }),
                ...(pastorName !== undefined && { pastorName }),
                ...(nucleus !== undefined && { nucleus }),
                ...(primaryColor && { primaryColor }),
                ...(loginMessage !== undefined && { loginMessage }),
                ...(status && { status }),
                ...(plan && { plan }),
                ...(customDomain !== undefined && { customDomain: customDomain || null }),
                ...(cellsEnabled !== undefined && { cellsEnabled: Boolean(cellsEnabled) }),
                ...(ebdEnabled !== undefined && { ebdEnabled: Boolean(ebdEnabled) })
            }
        });
        res.json(org);
    } catch (err) {
        if (err.code === 'P2002') return res.status(400).json({ error: 'Slug, subdomínio ou domínio já em uso' });
        res.status(500).json({ error: 'Erro ao atualizar organização' });
    }
});

// DELETE /api/admin/organizations/:id — Remove organização e TODOS os dados (irreversível)
router.delete('/:id', ensureSuperadmin, async (req, res) => {
    try {
        const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
        if (!org) return res.status(404).json({ error: 'Organização não encontrada' });
        if (org.slug === 'matriz') return res.status(403).json({ error: 'A organização matriz não pode ser removida' });

        await deleteOrgCascade(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('[Org Delete]', err);
        res.status(500).json({ error: 'Erro ao deletar organização: ' + err.message });
    }
});

// GET /api/admin/organizations/panel-settings — Configurações do painel SaaS
router.get('/panel-settings', ensureSuperadmin, async (req, res) => {
    try {
        const matriz = await prisma.organization.findFirst({ where: { slug: 'matriz' } });
        if (!matriz) return res.json({ primaryColor: '#6366f1', logoUrl: '', name: 'Painel Central SaaS' });
        const config = await prisma.systemConfig.findUnique({
            where: { key_organizationId: { key: 'saas_panel', organizationId: matriz.id } }
        });
        if (!config) return res.json({ primaryColor: '#6366f1', logoUrl: '', name: 'Painel Central SaaS' });
        res.json(JSON.parse(config.value));
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar configurações do painel' });
    }
});

// PUT /api/admin/organizations/panel-settings — Atualiza configurações do painel SaaS
router.put('/panel-settings', ensureSuperadmin, async (req, res) => {
    try {
        const { primaryColor, logoUrl, name } = req.body;
        const matriz = await prisma.organization.findFirst({ where: { slug: 'matriz' } });
        if (!matriz) return res.status(404).json({ error: 'Configuração base não encontrada' });
        const value = JSON.stringify({
            primaryColor: primaryColor || '#6366f1',
            logoUrl: logoUrl || '',
            name: name || 'Painel Central SaaS'
        });
        await prisma.systemConfig.upsert({
            where: { key_organizationId: { key: 'saas_panel', organizationId: matriz.id } },
            create: { key: 'saas_panel', value, organizationId: matriz.id },
            update: { value }
        });
        res.json(JSON.parse(value));
    } catch (err) {
        console.error('[Panel Settings]', err);
        res.status(500).json({ error: 'Erro ao salvar configurações do painel' });
    }
});

// GET /api/admin/organizations/superadmin-users — Lista todos os Superadmins
router.get('/superadmin-users', ensureSuperadmin, async (req, res) => {
    try {
        const superadmins = await prisma.user.findMany({
            where: { role: 'SUPERADMIN' },
            select: { id: true, name: true, username: true, createdAt: true }
        });
        res.json(superadmins);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar superadmins' });
    }
});

// POST /api/admin/organizations/superadmin-users — Cria novo Superadmin
router.post('/superadmin-users', ensureSuperadmin, async (req, res) => {
    const { name, username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username e senha são obrigatórios' });
    try {
        const existing = await prisma.user.findFirst({ where: { username } });
        if (existing) return res.status(400).json({ error: `O usuário "${username}" já existe.` });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name: name || 'Superadmin', username, password: hashedPassword, role: 'SUPERADMIN', organizationId: null },
            select: { id: true, name: true, username: true, role: true }
        });
        res.status(201).json(user);
    } catch (err) {
        if (err.code === 'P2002') return res.status(400).json({ error: 'Username já em uso' });
        res.status(500).json({ error: 'Erro ao criar superadmin' });
    }
});

// DELETE /api/admin/organizations/superadmin-users/:id — Remove Superadmin
router.delete('/superadmin-users/:id', ensureSuperadmin, async (req, res) => {
    try {
        if (req.user.id === req.params.id) return res.status(400).json({ error: 'Você não pode remover sua própria conta.' });
        const user = await prisma.user.findFirst({ where: { id: req.params.id, role: 'SUPERADMIN' } });
        if (!user) return res.status(404).json({ error: 'Superadmin não encontrado.' });
        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover superadmin' });
    }
});

module.exports = router;
