require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = require('./lib/prisma');
const app = express();
const { createLog, activityLoggerMiddleware } = require('./middleware/activityLogger');

// Confia no proxy reverso (Nginx/Docker) para obter o IP real do cliente
app.set('trust proxy', 1);

// Rate limiter: login — 5 tentativas por IP a cada 15 minutos
const loginRateLimiter = process.env.NODE_ENV === 'production'
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
    })
    : (req, res, next) => next();

// Rate limiter: geral — 200 requisições por IP por minuto
const generalRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Tente novamente em instantes.' }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const path = require('path');
const fs = require('fs');

// Garante que a pasta de uploads existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Pasta uploads criada com sucesso.');
}

app.use('/uploads', express.static(uploadsDir));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('ERRO: A variável de ambiente JWT_SECRET é obrigatória.');
    console.error('Recusando iniciar o servidor por razões de segurança.');
    process.exit(1);
}

// Seed inicial para o Sistema (Organização e Admin)
async function seedAdmin() {
    // 1. Garante que existe pelo menos uma Organização padrão
    let defaultOrg = await prisma.organization.findFirst({
        where: { slug: 'matriz' }
    });

    if (!defaultOrg) {
        defaultOrg = await prisma.organization.create({
            data: {
                name: 'Igreja Matriz',
                slug: 'matriz',
                congregationName: 'Igreja Sede',
                primaryColor: '#0f172a',
                plan: 'normal'
            }
        });
        console.log('Organização padrão "Matriz" criada.');
    } else if (defaultOrg.plan === 'BASIC' || defaultOrg.plan === 'normal' || !['demo', 'normal'].includes(defaultOrg.plan)) {
        // Normaliza plano legado da org matriz para 'normal'
        await prisma.organization.update({ where: { id: defaultOrg.id }, data: { plan: 'normal' } });
    }

    // Normaliza valores de plano legados em todas as orgs (BASIC → demo)
    await prisma.organization.updateMany({
        where: { plan: { notIn: ['demo', 'normal'] } },
        data: { plan: 'demo' }
    });

    // 2. Seed para Superadmin (Gerenciador do SaaS)
    const superadminUsername = process.env.SUPERADMIN_USERNAME || 'superadmin';
    const superadminExists = await prisma.user.findFirst({
        where: { role: 'SUPERADMIN' }
    });

    if (!superadminExists) {
        const superadminPassword = process.env.SUPERADMIN_PASSWORD || 'super123';
        const hashedPassword = await bcrypt.hash(superadminPassword, 10);
        await prisma.user.create({
            data: {
                name: 'Super Administrador',
                username: superadminUsername,
                password: hashedPassword,
                role: 'SUPERADMIN'
            }
        });
        console.log(`Usuário superadmin criado (${superadminUsername} / configurado via SUPERADMIN_PASSWORD)`);
    }

    // 3. Seed para o Admin da Organização Padrão
    const adminExists = await prisma.user.findUnique({
        where: { username: 'admin' }
    });

    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('123456', 10);
        await prisma.user.create({
            data: {
                name: 'Admin Matriz',
                username: 'admin',
                password: hashedPassword,
                role: 'ADMIN',
                organizationId: defaultOrg.id
            }
        });
        console.log('Usuário admin da matriz criado (admin/123456)');
    }

    // 4. Seed inicial para Trilhas (vinculadas à matriz)
    const defaultTracks = [
        { id: 't-waterBaptism', name: 'Batismo nas Águas', category: 'espiritual', icon: 'water_drop', color: 'blue', organizationId: defaultOrg.id },
        { id: 't-holySpiritBaptism', name: 'Batismo com o Espírito Santo', category: 'espiritual', icon: 'local_fire_department', color: 'orange', organizationId: defaultOrg.id },
        { id: 't-leadersSchool', name: 'Escola de Líderes', category: 'espiritual', icon: 'school', color: 'purple', organizationId: defaultOrg.id },
        { id: 't-encounter', name: 'Encontro com Deus', category: 'retiros', icon: 'volunteer_activism', color: 'emerald', organizationId: defaultOrg.id }
    ];

    for (const dt of defaultTracks) {
        const exist = await prisma.track.findUnique({ where: { id: dt.id } });
        if (!exist) {
            await prisma.track.create({ data: dt });
        }
    }

    // 5. Seed da config padrão de notificações e dashboard para a matriz
    const defaultConfig = [
        { key: 'dashboardActions', value: JSON.stringify({
            noVisit: { enabled: true, days: 60 },
            baptism: { enabled: true },
            consolidation: { enabled: true, days: 15 },
            reconciliation: { enabled: true }
        }), organizationId: defaultOrg.id },
        { key: 'notificationConfig', value: JSON.stringify({
            newMember: { enabled: true },
            newEvent: { enabled: true },
            updatedEvent: { enabled: true },
            dailyReminder: { enabled: true }
        }), organizationId: defaultOrg.id }
    ];

    for (const cfg of defaultConfig) {
        const exist = await prisma.systemConfig.findUnique({
            where: { key_organizationId: { key: cfg.key, organizationId: cfg.organizationId } }
        });
        if (!exist) {
            await prisma.systemConfig.create({ data: cfg });
        }
    }
}

// Inicializa a seed
seedAdmin().catch(console.error);

// Middleware de Autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.sendStatus(403);
        try {
            const dbUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { role: true, generationId: true, tokenVersion: true, organizationId: true }
            });

            if (!dbUser) return res.sendStatus(403);

            const dbVersion = dbUser.tokenVersion || 0;
            const tokenVersion = user.version || 0;

            if (dbVersion !== tokenVersion) {
                return res.sendStatus(403);
            }

            user.role = dbUser.role;
            user.generationId = dbUser.generationId;
            user.organizationId = dbUser.organizationId;
        } catch (error) {}
        req.user = user;
        next();
    });
}

// ----------------------------------------------------------------------------
// SAAS: Resolução de Organização pelo Header Host
// Suporta subdomínios (igreja1.saas.com.br) e domínios customizados (minha-igreja.com.br)
// ----------------------------------------------------------------------------
async function resolveOrgFromHost(req) {
    const saasDomain = process.env.SAAS_DOMAIN || '';
    const rawHost = req.headers['x-forwarded-host'] || req.headers['host'] || '';
    const hostname = rawHost.split(':')[0].toLowerCase().trim();

    // Ignora localhost e IPs
    if (!hostname || hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;

    // Painel do superadmin — sem org de contexto
    if (hostname.startsWith('admin.') || hostname.startsWith('painel.')) return null;

    let where;

    if (saasDomain && hostname.endsWith(`.${saasDomain}`)) {
        // Subdomínio da plataforma: igreja1.saas.com.br → subdomain = 'igreja1'
        const sub = hostname.slice(0, hostname.length - saasDomain.length - 1);
        if (!sub) return null;
        where = { OR: [{ slug: sub }, { subdomain: sub }] };
    } else {
        // Domínio customizado: minha-igreja.com.br
        where = { customDomain: hostname };
    }

    try {
        const org = await prisma.organization.findFirst({ where, select: { id: true } });
        return org?.id || null;
    } catch (e) {
        console.error('[SaaS/Host] Erro ao resolver org pelo host:', e.message);
        return null;
    }
}

// Middleware: Resolve o ID da organização para a requisição
// Prioridade: JWT orgId > SUPERADMIN override (query/body) > Header Host > matriz (fallback)
async function resolveOrgContext(req, res, next) {
    if (!req || !req.user) return res.sendStatus(401);

    let orgId = req.user.organizationId;

    try {
        if (req.user.role === 'SUPERADMIN') {
            const queryId = req.query?.organizationId;
            const bodyId = req.body?.organizationId;
            const overrideId = queryId || bodyId;
            if (overrideId) {
                orgId = overrideId;
            }
        }
    } catch (e) {
        console.warn('[SaaS/Context] Erro ao extrair overrideId:', e.message);
    }

    if (!orgId) {
        if (req.user.role === 'SUPERADMIN') {
            // Tenta resolver pelo Host header (superadmin visitando subdomínio de uma igreja)
            const hostOrgId = await resolveOrgFromHost(req);
            if (hostOrgId) {
                orgId = hostOrgId;
            } else {
                // Último fallback: org matriz
                const matriz = await prisma.organization.findFirst({ where: { slug: 'matriz' } });
                orgId = matriz?.id;
            }
        } else {
            return res.status(400).json({ error: 'Organização não identificada' });
        }
    }

    req.orgId = orgId;
    next();
}

// ----------------------------------------------------------------------------
// ROTAS DE AUTENTICAÇÃO
// ----------------------------------------------------------------------------
app.post('/api/login', loginRateLimiter, async (req, res) => {
    const { username, password, orgSlug } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { username },
            include: { organization: true }
        });
        
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

        // Se for um usuário normal (não superadmin), e estamos tentando logar em uma org específica
        if (user.role !== 'SUPERADMIN' && orgSlug && user.organization?.slug !== orgSlug) {
            return res.status(401).json({ error: 'Usuário não pertence a esta igreja' });
        }

        // Bloquear login se a org estiver suspensa
        if (user.role !== 'SUPERADMIN' && user.organization?.status === 'suspended') {
            return res.status(403).json({
                error: 'Esta igreja está com os serviços suspensos.',
                code: 'ORG_SUSPENDED',
                orgName: user.organization.name
            });
        }

        // Verifica a senha
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
            await createLog({ action: 'LOGIN_FAIL', resource: 'auth', detail: `Tentativa falha: ${username}`, ip });
            return res.status(401).json({ error: 'Senha incorreta' });
        }

        // Gera o token limitando o payload
        const tokenPayload = {
            id: user.id,
            username: user.username,
            role: user.role,
            generationId: user.generationId,
            organizationId: user.organizationId,
            version: user.tokenVersion || 0
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

        // Log de login bem-sucedido
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
        await createLog({ userId: user.id, userName: user.name, organizationId: user.organizationId, action: 'LOGIN', resource: 'auth', detail: user.username, ip });

        // Retorna o token e os dados essenciais
        res.json({
            token,
            user: { 
                id: user.id, 
                name: user.name, 
                username: user.username, 
                role: user.role, 
                avatar: user.avatar, 
                generationId: user.generationId,
                organizationId: user.organizationId,
                organization: user.organization ? {
                    name: user.organization.name,
                    slug: user.organization.slug,
                    logoUrl: user.organization.logoUrl,
                    primaryColor: user.organization.primaryColor
                } : null
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Resolve organização automaticamente pelo header Host (subdomínio ou domínio customizado)
app.get('/api/public/org/by-host', async (req, res) => {
    try {
        const orgId = await resolveOrgFromHost(req);
        if (!orgId) return res.status(404).json({ error: 'Organização não identificada pelo domínio' });

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true, loginMessage: true, congregationName: true, status: true }
        });
        if (!org) return res.status(404).json({ error: 'Organização não encontrada' });
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

app.get('/api/public/org/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        // Caso especial: Domínio Central / Portal do Superadmin
        if (slug === 'saas-admin') {
            return res.json({
                name: 'Painel Central SaaS',
                slug: 'saas-admin',
                logoUrl: '',
                primaryColor: '#0f172a',
                loginMessage: 'Portal de Administração Geral da Plataforma'
            });
        }

        const org = await prisma.organization.findFirst({
            where: {
                OR: [
                    { slug: slug },
                    { subdomain: slug },
                    { customDomain: slug }
                ]
            },
            select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                primaryColor: true,
                loginMessage: true,
                congregationName: true,
                status: true
            }
        });
        if (!org) return res.status(404).json({ error: 'Organização não encontrada' });
        res.json(org);
    } catch (err) { res.status(500).json({ error: 'Erro no servidor' }); }
});

// ----------------------------------------------------------------------------
// ROTAS PÚBLICAS (Visitantes e Formulários)
// ----------------------------------------------------------------------------
app.get('/api/public/forms', async (req, res) => {
    try {
        const { org } = req.query;
        const where = { status: 'ativo', showOnLogin: true };

        if (org) {
            const organization = await prisma.organization.findFirst({
                where: { OR: [{ slug: org }, { subdomain: org }, { customDomain: org }] },
                select: { id: true }
            });
            if (organization) where.organizationId = organization.id;
        }

        const forms = await prisma.form.findMany({ where });
        const processed = forms.map(f => ({
            ...f,
            fields: f.fields ? JSON.parse(f.fields) : []
        }));
        res.json(processed);
    } catch (err) { res.status(500).json({ error: 'Erro no servidor' }); }
});

app.get('/api/public/forms/:id', async (req, res) => {
    try {
        const form = await prisma.form.findUnique({ where: { id: req.params.id, status: 'ativo' } });
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado' });
        form.fields = JSON.parse(form.fields);
        res.json(form);
    } catch (err) { res.status(500).json({ error: 'Erro no servidor' }); }
});

app.post('/api/public/triage', async (req, res) => {
    try {
        const { formId, data } = req.body;
        const form = await prisma.form.findUnique({ where: { id: formId } });
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado' });

        const triage = await prisma.triageQueue.create({
            data: { 
                formId, 
                data: JSON.stringify(data || {}), 
                organizationId: form.organizationId 
            }
        });
        res.status(201).json(triage);
    } catch (err) { 
        console.error('[Public Triage Error]:', err);
        res.status(500).json({ error: 'Erro no servidor ao processar triagem' }); 
    }
});

// ----------------------------------------------------------------------------
// ROTAS GENÉRICAS E COMPONENTES
// ----------------------------------------------------------------------------

const usersRouter = require('./routes/users');
const peopleRouter = require('./routes/people');
const cellsRouter = require('./routes/cells');
const { router: eventsRouter, notifyAllLeaders } = require('./routes/events');
const othersRouter = require('./routes/others');
const formsRouter = require('./routes/forms');
const generationsRouter = require('./routes/generations');
const settingsRouter = require('./routes/settings');
const { getNotificationConfig } = require('./routes/config');
const reportsRouter = require('./routes/reports');
const logsRouter = require('./routes/logs');
const adminRouter = require('./routes/admin');
const organizationsRouter = require('./routes/organizations');

// API Pública v1 e gerenciamento admin
const apiV1Router = require('./api/routes/v1/index');
const apiKeysRouter = require('./api/routes/apiKeys');
const webhooksAdminRouter = require('./api/routes/webhooks');

// Rotas Públicas (Sem necessidade de login)
// Montamos em caminhos que não conflitam com os privados
app.use('/api/public/settings', settingsRouter);

// Rate limiting geral (aplicado a todas as rotas autenticadas)
app.use('/api', generalRateLimiter);

// Middlewares Globais de Proteção (Aplicados após as rotas públicas)
app.use('/api/users', authenticateToken, resolveOrgContext, activityLoggerMiddleware, usersRouter);
app.use('/api/people', authenticateToken, resolveOrgContext, activityLoggerMiddleware, peopleRouter);
app.use('/api/cells', authenticateToken, resolveOrgContext, activityLoggerMiddleware, cellsRouter);
app.use('/api/events', authenticateToken, resolveOrgContext, activityLoggerMiddleware, eventsRouter);
app.use('/api/dash', authenticateToken, resolveOrgContext, activityLoggerMiddleware, othersRouter);
app.use('/api/forms', authenticateToken, resolveOrgContext, activityLoggerMiddleware, formsRouter);
app.use('/api/generations', authenticateToken, resolveOrgContext, activityLoggerMiddleware, generationsRouter);
app.use('/api/settings', authenticateToken, resolveOrgContext, activityLoggerMiddleware, settingsRouter);
app.use('/api/reports', authenticateToken, resolveOrgContext, activityLoggerMiddleware, reportsRouter);
app.use('/api/logs', authenticateToken, resolveOrgContext, logsRouter);
// IMPORTANTE: /api/admin/organizations deve vir ANTES de /api/admin
// para evitar que o Express capture o prefixo mais curto primeiro
app.use('/api/admin/organizations', authenticateToken, activityLoggerMiddleware, organizationsRouter);
app.use('/api/admin', authenticateToken, resolveOrgContext, activityLoggerMiddleware, adminRouter);

// ----------------------------------------------------------------------------
// API PÚBLICA v1 (autenticada por API Key) e Admin
// ----------------------------------------------------------------------------
app.use('/api/v1', apiV1Router);
app.use('/api/admin/api-keys', authenticateToken, apiKeysRouter);
app.use('/api/admin/webhooks', authenticateToken, webhooksAdminRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});

// ------------------------------------------------------------------
// JOB DIÁRIO: Lembrete de eventos de amanhã
// ------------------------------------------------------------------
async function scheduleDailyEventReminder() {
    const run = async () => {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0]; // 'YYYY-MM-DD'

            const events = await prisma.event.findMany({
                where: { date: tomorrowStr, recurrence: 'none' }
            });

            // Eventos recorrentes que caem amanhã (weekly/monthly/yearly)
            const allEvents = await prisma.event.findMany({
                where: { date: { lte: tomorrowStr }, recurrence: { not: 'none' } }
            });
            const tomorrowDate = new Date(tomorrowStr + 'T12:00:00');
            const tomorrowDay = tomorrowDate.getDay(); // 0=Dom
            const tomorrowDD = tomorrowDate.getDate();
            const tomorrowMM = tomorrowDate.getMonth();

            allEvents.forEach(ev => {
                const evDate = new Date(ev.date + 'T12:00:00');
                let match = false;
                if (ev.recurrence === 'weekly' && evDate.getDay() === tomorrowDay) match = true;
                if (ev.recurrence === 'monthly-date' && evDate.getDate() === tomorrowDD) match = true;
                if (ev.recurrence === 'yearly' && evDate.getDate() === tomorrowDD && evDate.getMonth() === tomorrowMM) match = true;
                if (match) events.push(ev);
            });

            for (const ev of events) {
                const timeStr = ev.startTime ? ` às ${ev.startTime}` : '';
                const locationStr = ev.location ? ` — ${ev.location}` : '';
                // Evita notificação duplicada: só envia se não houver notif do mesmo título nas últimas 20h
                const recent = await prisma.notification.findFirst({
                    where: {
                        title: { contains: ev.title },
                        organizationId: ev.organizationId,
                        createdAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) }
                    }
                });
                if (!recent) {
                    const notifCfg = await getNotificationConfig(ev.organizationId);
                    if (notifCfg.dailyReminder?.enabled !== false) {
                        await notifyAllLeaders(
                            `⏰ Lembrete: ${ev.title} amanhã`,
                            `A programação "${ev.title}" acontece amanhã${timeStr}${locationStr}. Confirme a presença da sua célula!`,
                            ev.organizationId,
                            `#/calendar`
                        );
                        console.log(`[Lembrete] Notificação enviada para: ${ev.title}`);
                    }
                }
            }
        } catch (e) {
            console.error('[scheduleDailyEventReminder] Erro:', e.message);
        }
    };

    // Roda AGORA e depois a cada 24h
    run();
    setInterval(run, 24 * 60 * 60 * 1000);
}

scheduleDailyEventReminder();

app.post('/api/settings/reset', authenticateToken, resolveOrgContext, async (req, res) => {
    try {
        const orgId = req.orgId;
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem resetar a organização.' });
        }

        const whereOrg = { organizationId: orgId };

        // 1. Limpar arquivos físicos de upload (Opcional: em SaaS real, faríamos por pasta de org)
        // Por enquanto, apenas deletamos do banco para isolamento
        
        // 2. Deletar tudo no banco em ordem de dependência - RESTRITO À ORGANIZAÇÃO
        await prisma.triageQueue.deleteMany({ where: whereOrg });
        await prisma.form.deleteMany({ where: whereOrg });
        await prisma.notification.deleteMany({ where: whereOrg });
        await prisma.personTrack.deleteMany({ where: { person: { organizationId: orgId } } });
        await prisma.track.deleteMany({ where: whereOrg });
        await prisma.cellJustification.deleteMany({ where: whereOrg });
        await prisma.cellCancellation.deleteMany({ where: whereOrg });
        await prisma.eventException.deleteMany({ where: whereOrg });
        await prisma.event.deleteMany({ where: whereOrg });
        await prisma.visit.deleteMany({ where: whereOrg });
        await prisma.pastoralNote.deleteMany({ where: whereOrg });
        await prisma.attendanceRecord.deleteMany({ where: { organizationId: orgId } });
        await prisma.attendance.deleteMany({ where: whereOrg });
        await prisma.consolidation.deleteMany({ where: { person: { organizationId: orgId } } });
        await prisma.person.deleteMany({ where: whereOrg });
        await prisma.cell.deleteMany({ where: whereOrg });
        await prisma.generation.deleteMany({ where: whereOrg });
        await prisma.systemConfig.deleteMany({ where: whereOrg });
        
        // Não deletamos o usuário logado se for o último admin, ou lidamos com cuidado
        await prisma.user.deleteMany({ where: { ...whereOrg, id: { not: req.user.id } } });

        res.json({ success: true, message: 'Dados da organização resetados com sucesso.' });
    } catch (err) {
        console.error('Falha no Factory Reset', err);
        res.status(500).json({ error: 'Erro crítico interno no reset.' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
