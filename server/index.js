require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = require('./lib/prisma');
const app = express();
const { createLog, activityLoggerMiddleware } = require('./middleware/activityLogger');
const cellsGuard = require('./middleware/cellsGuard');
const { checkBirthdays } = require('./services/birthdayService');

// Confia no proxy reverso (Nginx/Docker) para obter o IP real do cliente
app.set('trust proxy', 1);

// Rate limiter: geral — 200 requisições por IP por minuto
const generalRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Tente novamente em instantes.' }
});

// Origens do app Capacitor nativo (Android/iOS) — sempre permitidas independente do ambiente
const CAPACITOR_ORIGINS = ['https://localhost', 'capacitor://localhost', 'ionic://localhost'];

// CORS dinâmico: recebe req para checar o host header (suporte a Capacitor com server.url)
app.use(cors((req, callback) => {
    const origin = req.headers.origin || '';
    const host = (req.headers.host || '').replace(/:\d+$/, ''); // remove porta, se houver

    // Sem origin (Postman, curl) ou Capacitor bundle mode (localhost)
    if (!origin || CAPACITOR_ORIGINS.includes(origin)) {
        return callback(null, { origin: true, credentials: true });
    }
    // Ambiente de desenvolvimento: permite qualquer localhost
    if (process.env.NODE_ENV !== 'production') {
        if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
            return callback(null, { origin: true, credentials: true });
        }
    }
    // Capacitor com server.url: origin == próprio host do servidor (same-host)
    if (host && (origin === `https://${host}` || origin === `http://${host}`)) {
        return callback(null, { origin: true, credentials: true });
    }
    // Permite subdomínios e o próprio SAAS_DOMAIN (multi-tenant)
    const saasDomain = process.env.SAAS_DOMAIN || '';
    if (saasDomain) {
        if (origin === `https://${saasDomain}` || origin === `http://${saasDomain}`) {
            return callback(null, { origin: true, credentials: true });
        }
        if (origin.endsWith(`.${saasDomain}`)) {
            return callback(null, { origin: true, credentials: true });
        }
    }
    // Lista explícita de origens permitidas
    const allowed = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    if (allowed.includes(origin)) {
        return callback(null, { origin: true, credentials: true });
    }
    callback(new Error('CORS: origem não permitida'));
}));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
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

    const matrizName = process.env.MATRIZ_NAME || 'Igreja Matriz';
    const matrizCong = process.env.MATRIZ_CONGREGATION || 'Igreja Sede';

    if (!defaultOrg) {
        defaultOrg = await prisma.organization.create({
            data: {
                name: matrizName,
                slug: 'matriz',
                subdomain: 'matriz',
                congregationName: matrizCong,
                primaryColor: '#0f172a',
                plan: 'normal'
            }
        });
        console.log(`Organização padrão "Matriz" criada: ${matrizName}`);
    } else {
        // Atualiza se necessário conforme env vars (somente se as variáveis estiverem explicitamente no ENV e forem diferentes)
        const updateData = {};
        if (process.env.MATRIZ_NAME && process.env.MATRIZ_NAME !== defaultOrg.name) {
            updateData.name = process.env.MATRIZ_NAME;
        }
        if (process.env.MATRIZ_CONGREGATION && process.env.MATRIZ_CONGREGATION !== defaultOrg.congregationName) {
            updateData.congregationName = process.env.MATRIZ_CONGREGATION;
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.organization.update({
                where: { id: defaultOrg.id },
                data: updateData
            });
            console.log(`Organização "Matriz" atualizada via variáveis de ambiente.`);
        }

        if (defaultOrg.plan === 'BASIC' || defaultOrg.plan === 'normal' || !['demo', 'normal'].includes(defaultOrg.plan)) {
            await prisma.organization.update({ where: { id: defaultOrg.id }, data: { plan: 'normal' } });
        }
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
        const superadminPassword = process.env.SUPERADMIN_PASSWORD || (() => {
            const pwd = require('crypto').randomBytes(16).toString('hex');
            console.warn('⚠️  SUPERADMIN_PASSWORD não definida! Senha gerada aleatoriamente — defina a variável de ambiente.');
            return pwd;
        })();
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
        const adminName = process.env.MATRIZ_ADMIN_NAME || 'Admin Matriz';
        const adminUser = process.env.MATRIZ_ADMIN_USERNAME || 'admin';
        const adminDefaultPassword = process.env.MATRIZ_ADMIN_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD || (() => {
            const pwd = require('crypto').randomBytes(8).toString('hex');
            console.warn('⚠️  MATRIZ_ADMIN_PASSWORD não definida! Senha gerada aleatoriamente — defina a variável de ambiente.');
            return pwd;
        })();
        const hashedPassword = await bcrypt.hash(adminDefaultPassword, 10);
        await prisma.user.create({
            data: {
                name: adminName,
                username: adminUser,
                password: hashedPassword,
                role: 'ADMIN',
                organizationId: defaultOrg.id
            }
        });
        console.log(`Usuário admin da matriz criado (${adminUser} / use MATRIZ_ADMIN_PASSWORD para definir senha)`);
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

    // 6. Seed financeiro: conta padrão, plano de contas e fundos da matriz
    await seedFinance(defaultOrg.id, prisma);
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
                select: { role: true, generationId: true, tokenVersion: true, organizationId: true, secondaryRoles: true }
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
            user.secondaryRoles = dbUser.secondaryRoles;
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

    // Ignora localhost e IPs em produção, mas permite em dev
    if (!hostname ||/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
    
    // Tratamento especial para localhost/127.0.0.1 (DEV)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Em dev local, retorna matriz como padrão se não houver cookie/header indicando org
        // mas aqui retornamos null para não forçar org se for superadmin tentando acessar admin local
        return null;
    }

    // Painel do superadmin — sem org de contexto
    if (saasDomain) {
        if (hostname === `admin.${saasDomain}` || hostname === `painel.${saasDomain}`) return null;
    } else {
        if (hostname.startsWith('admin.') || hostname.startsWith('painel.')) return null;
    }

    let where;

    if (saasDomain && hostname.endsWith(`.${saasDomain}`)) {
        // Subdomínio da plataforma: igreja1.saas.com.br → subdomain = 'igreja1'
        const sub = hostname.slice(0, hostname.length - saasDomain.length - 1);
        if (!sub) return null;
        
        // Se for 'matriz', resolvemos pela slug matriz
        if (sub === 'matriz') {
            where = { slug: 'matriz' };
        } else {
            where = { OR: [{ slug: sub }, { subdomain: sub }] };
        }
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
app.post('/api/login', async (req, res) => {
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
                    id: user.organization.id,
                    name: user.organization.name,
                    appName: user.organization.name,
                    slug: user.organization.slug,
                    logoUrl: user.organization.logoUrl,
                    primaryColor: user.organization.primaryColor,
                    loginMessage: user.organization.loginMessage,
                    congregationName: user.organization.congregationName,
                    congregationAddress: user.organization.congregationAddress,
                    pastorName: user.organization.pastorName,
                    nucleus: user.organization.nucleus,
                    cellsEnabled: user.organization.cellsEnabled,
                    ebdEnabled: user.organization.ebdEnabled,
                    financialEnabled: user.organization.financialEnabled
                } : null
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// ----------------------------------------------------------------------------
// ROTAS PÚBLICAS (SaaS Config)
// ----------------------------------------------------------------------------
app.get('/api/public/config', (req, res) => {
    res.json({
        saasDomain: process.env.SAAS_DOMAIN || '',
        matrizSlug: 'matriz'
    });
});

// Endpoint de descoberta para o app móvel (Capacitor)
// Permite que o app nativo valide se uma URL é um servidor CRM Celular válido
app.get('/api/public/info', async (req, res) => {
    try {
        let organizationName = 'CRM Celular';
        let logoUrl = '';

        const org = await prisma.organization.findFirst({
            where: { slug: 'matriz' },
            select: { name: true, logoUrl: true }
        });
        if (org) {
            organizationName = org.name;
            logoUrl = org.logoUrl || '';
        }

        res.json({
            appName: 'CRM Celular',
            version: process.env.npm_package_version || '1.0.0',
            organizationName,
            logoUrl,
            pushEnabled: false // será true após APP-3
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao obter informações do servidor' });
    }
});

// Resolve organização automaticamente pelo header Host (subdomínio ou domínio customizado)
app.get('/api/public/org/by-host', async (req, res) => {
    try {
        const orgId = await resolveOrgFromHost(req);
        if (!orgId) return res.status(404).json({ error: 'Organização não identificada pelo domínio' });

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { 
                id: true, 
                name: true, 
                slug: true, 
                logoUrl: true, 
                primaryColor: true, 
                loginMessage: true, 
                congregationName: true, 
                congregationAddress: true,
                pastorName: true,
                nucleus: true,
                status: true, 
                ebdEnabled: true, 
                cellsEnabled: true, 
                financialEnabled: true 
            }
        });
        if (!org) return res.status(404).json({ error: 'Organização não encontrada' });
        res.json({ ...org, appName: org.name });
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
                name: 'Gestão Celular - Painel Central (SGI v1.1)',
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
                congregationAddress: true,
                pastorName: true,
                nucleus: true,
                status: true,
                ebdEnabled: true,
                cellsEnabled: true,
                financialEnabled: true
            }
        });
        if (!org) return res.status(404).json({ error: 'Organização não encontrada' });
        res.json({ ...org, appName: org.name });
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
const ebdRouter = require('./routes/ebd');
const ebdGuard = require('./middleware/ebdGuard');
const { financeRouter } = require('./routes/finance/index');
const financeGuard = require('./middleware/financeGuard');
const { seedFinance } = require('./lib/financeSeeds');
const downloadRouter = require('./routes/download');

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
app.use('/api/cells', authenticateToken, resolveOrgContext, cellsGuard, activityLoggerMiddleware, cellsRouter);
app.use('/api/events', authenticateToken, resolveOrgContext, activityLoggerMiddleware, eventsRouter);
app.use('/api/dash', authenticateToken, resolveOrgContext, activityLoggerMiddleware, othersRouter);
app.use('/api/forms', authenticateToken, resolveOrgContext, activityLoggerMiddleware, formsRouter);
app.use('/api/generations', authenticateToken, resolveOrgContext, cellsGuard, activityLoggerMiddleware, generationsRouter);
app.use('/api/settings', authenticateToken, resolveOrgContext, activityLoggerMiddleware, settingsRouter);
app.use('/api/reports', authenticateToken, resolveOrgContext, activityLoggerMiddleware, reportsRouter);
app.use('/api/logs', authenticateToken, resolveOrgContext, logsRouter);
// IMPORTANTE: /api/admin/organizations deve vir ANTES de /api/admin
// para evitar que o Express capture o prefixo mais curto primeiro
app.use('/api/admin/organizations', authenticateToken, activityLoggerMiddleware, organizationsRouter);
app.use('/api/admin', authenticateToken, resolveOrgContext, activityLoggerMiddleware, adminRouter);
app.use('/api/ebd', authenticateToken, resolveOrgContext, ebdGuard, activityLoggerMiddleware, ebdRouter);
app.use('/api/finance', authenticateToken, resolveOrgContext, financeGuard, financeRouter);
// Download temporário para Capacitor Android (POST requer auth, GET usa token curto-vivido)
app.use('/api/download', downloadRouter);

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

// ------------------------------------------------------------------
// JOB DIÁRIO: Verificação de aniversariantes
// ------------------------------------------------------------------
async function scheduleBirthdayChecks() {
    // Roda AGORA e depois a cada 24h
    checkBirthdays();
    setInterval(checkBirthdays, 24 * 60 * 60 * 1000);
}

scheduleBirthdayChecks();

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

// Error handler global — deve ser o ÚLTIMO middleware registrado
// Captura erros de CORS (retorna 403) e outros erros não tratados (retorna 500)
app.use((err, req, res, next) => {
    if (err && (err.message?.includes('CORS') || err.message?.includes('origem não permitida'))) {
        return res.status(403).json({ error: 'Origem não permitida.' });
    }
    console.error('[Server Error]', err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
