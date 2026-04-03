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
const ipBlock = require('./middleware/ipBlock');
const { checkBirthdays } = require('./services/birthdayService');
const { startRetryJob } = require('./services/webhookRetryService');

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
    // Extrai apenas o hostname da origin (sem protocolo e sem porta) para comparar corretamente
    const saasDomain = process.env.SAAS_DOMAIN || '';
    if (saasDomain) {
        let originHostname = '';
        try { originHostname = new URL(origin).hostname; } catch (_) {}
        if (originHostname === saasDomain || originHostname.endsWith(`.${saasDomain}`)) {
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
app.use(ipBlock);
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

// Uploads são ativos públicos (logos, fotos) — deve ser acessível pelo app Capacitor
// em https://localhost. O helmet define CORP: same-origin globalmente, então
// precisamos sobrescrever para cross-origin nesta rota específica.
// Cache-Control: no-store evita que o Cloudflare/CDN cache o header antigo.
app.use('/uploads', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    next();
}, express.static(uploadsDir));

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
    const adminExists = await prisma.user.findFirst({
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
            dailyReminder: { enabled: true },
            birthday: { enabled: true },
            cellMeeting: { enabled: true }
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

    // 7. Garante trilhas default para todas as organizações existentes
    const orgsWithoutTracks = await prisma.organization.findMany({
        where: { tracks: { none: {} } }
    });
    for (const org of orgsWithoutTracks) {
        await prisma.track.createMany({
            data: [
                { id: `t-waterBaptism-${org.id}`, name: 'Batismo nas Águas', category: 'espiritual', icon: 'water_drop', color: 'blue', organizationId: org.id },
                { id: `t-holySpiritBaptism-${org.id}`, name: 'Batismo com o Espírito Santo', category: 'espiritual', icon: 'local_fire_department', color: 'orange', organizationId: org.id },
                { id: `t-leadersSchool-${org.id}`, name: 'Escola de Líderes', category: 'espiritual', icon: 'school', color: 'purple', organizationId: org.id },
                { id: `t-encounter-${org.id}`, name: 'Encontro com Deus', category: 'retiros', icon: 'volunteer_activism', color: 'emerald', organizationId: org.id },
            ],
            skipDuplicates: true
        });
        console.log(`[seed] Trilhas padrão criadas para org: ${org.name}`);
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
// SAAS: Resolução de Organização pelo Header Host — retorno discriminado
// Suporta subdomínios (igreja1.saas.com.br) e domínios customizados (minha-igreja.com.br)
//
// Tipos de retorno:
//   { type: 'ok', orgId }      — org encontrada
//   { type: 'IP_BLOCKED' }     — acesso via IP puro (ex: 192.168.1.1)
//   { type: 'DEV', orgId: null } — localhost / sem SAAS_DOMAIN configurado
//   { type: 'ADMIN_DOMAIN' }   — admin.SAAS_DOMAIN ou painel.SAAS_DOMAIN
//   { type: 'NOT_FOUND' }      — domínio desconhecido (não mapeado a nenhuma org)
// ----------------------------------------------------------------------------
async function resolveOrgFromHost(req) {
    const saasDomain = process.env.SAAS_DOMAIN || '';
    const rawHost = req.headers['x-forwarded-host'] || req.headers['host'] || '';
    const hostname = rawHost.split(':')[0].toLowerCase().trim();

    // Loopback (localhost / 127.0.0.1) — dev ou proxy Vite, sempre permitido
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return { type: 'DEV', orgId: null };
    }

    // IP puro (não-loopback) — resolve para a org matriz (permite troubleshooting)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        try {
            const matriz = await prisma.organization.findFirst({ where: { slug: 'matriz' }, select: { id: true } });
            if (matriz) return { type: 'ok', orgId: matriz.id };
        } catch (e) { /* ignora */ }
        return { type: 'DEV', orgId: null };
    }

    // Sem SAAS_DOMAIN configurado — tenta customDomain antes de assumir dev/standalone
    if (!saasDomain) {
        try {
            const org = await prisma.organization.findFirst({ where: { customDomain: hostname }, select: { id: true } });
            if (org) return { type: 'ok', orgId: org.id };
        } catch (e) { /* ignora, continua como dev */ }
        return { type: 'DEV', orgId: null };
    }

    // Subdomínio reservado para painel do superadmin
    if (hostname === `admin.${saasDomain}` || hostname === `painel.${saasDomain}`) {
        return { type: 'ADMIN_DOMAIN' };
    }

    let where;

    if (hostname.endsWith(`.${saasDomain}`)) {
        // Subdomínio da plataforma: igreja1.saas.com.br → subdomain = 'igreja1'
        const sub = hostname.slice(0, hostname.length - saasDomain.length - 1);
        if (!sub) return { type: 'NOT_FOUND' };

        where = sub === 'matriz'
            ? { slug: 'matriz' }
            : { OR: [{ slug: sub }, { subdomain: sub }, { customDomain: hostname }] };
    } else {
        // Domínio completamente customizado: minha-igreja.com.br
        where = { customDomain: hostname };
    }

    try {
        const org = await prisma.organization.findFirst({ where, select: { id: true } });
        if (!org) return { type: 'NOT_FOUND' };
        return { type: 'ok', orgId: org.id };
    } catch (e) {
        console.error('[SaaS/Host] Erro ao resolver org pelo host:', e.message);
        return { type: 'NOT_FOUND' };
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
            const hostResult = await resolveOrgFromHost(req);
            if (hostResult.type === 'ok') {
                orgId = hostResult.orgId;
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
    const { username, password, orgSlug, adminContext } = req.body;

    try {
        // ── Branch: acesso ao painel superadmin via #/admin ────────────────────
        // adminContext=true indica que o frontend está na rota #/admin.
        // Neste caso, ignoramos completamente a resolução de org e buscamos
        // apenas usuários SUPERADMIN. Qualquer outro role é rejeitado.
        if (adminContext === true) {
            const superUser = await prisma.user.findFirst({
                where: { username, role: 'SUPERADMIN' },
                include: { organization: true }
            });
            if (!superUser) {
                return res.status(401).json({ error: 'SUPERADMIN_NOT_FOUND', message: 'Usuário superadmin não encontrado.' });
            }
            const validPwd = await bcrypt.compare(password, superUser.password);
            if (!validPwd) {
                const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
                await createLog({ action: 'LOGIN_FAIL', resource: 'auth', detail: `Admin context fail: ${username}`, ip });
                return res.status(401).json({ error: 'Senha incorreta' });
            }
            const tokenPayload = {
                id: superUser.id,
                username: superUser.username,
                role: superUser.role,
                generationId: superUser.generationId,
                organizationId: superUser.organizationId,
                version: superUser.tokenVersion || 0
            };
            const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });
            const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
            await createLog({ userId: superUser.id, userName: superUser.name, organizationId: superUser.organizationId, action: 'LOGIN', resource: 'auth', detail: `admin-context: ${superUser.username}`, ip });
            return res.json({
                token,
                user: {
                    id: superUser.id,
                    name: superUser.name,
                    username: superUser.username,
                    role: superUser.role,
                    avatar: superUser.avatar,
                    generationId: superUser.generationId,
                    organizationId: superUser.organizationId,
                    organization: null
                }
            });
        }
        // ── Fim branch adminContext ─────────────────────────────────────────────

        // Resolve org pelo Host header (fonte mais confiável para multi-tenant)
        const hostResult = await resolveOrgFromHost(req);

        // Extrai orgId do resultado discriminado
        const loginOrgId = hostResult.type === 'ok' ? hostResult.orgId : null;

        // Fallback: resolve pelo orgSlug enviado pelo frontend (útil em dev local sem SAAS_DOMAIN)
        // Ignora slugs especiais (saas-admin, matriz) para não forçar org errada
        let resolvedOrgId = loginOrgId;
        if (!resolvedOrgId && orgSlug && orgSlug !== 'saas-admin' && orgSlug !== 'matriz') {
            const slugOrg = await prisma.organization.findFirst({
                where: { OR: [{ slug: orgSlug }, { subdomain: orgSlug }, { customDomain: orgSlug }] },
                select: { id: true }
            });
            resolvedOrgId = slugOrg?.id || null;
        }

        let user;
        if (resolvedOrgId) {
            // Busca na org resolvida; se não achar, tenta SUPERADMIN (orgId = null)
            user = await prisma.user.findFirst({ where: { username, organizationId: resolvedOrgId }, include: { organization: true } })
                || await prisma.user.findFirst({ where: { username, organizationId: null }, include: { organization: true } });
        } else {
            // Nenhuma org identificada (dev local / acesso pelo painel central): busca global
            user = await prisma.user.findFirst({ where: { username }, include: { organization: true } });
        }

        if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

        // Se for um usuário normal (não superadmin), valida que pertence à org da requisição
        if (user.role !== 'SUPERADMIN' && orgSlug && user.organization?.slug !== orgSlug) {
            // Permite se a org resolvida bate com a org do usuário (frontend pode ter resolvido errado)
            if (!resolvedOrgId || resolvedOrgId !== user.organizationId) {
                return res.status(401).json({ error: 'Usuário não pertence a esta igreja' });
            }
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
// Permite que o app nativo valide se uma URL é um servidor SGI v1.0 válido
app.get('/api/public/info', async (req, res) => {
    try {
        let organizationName = 'SGI v1.0';
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
            appName: 'SGI v1.0',
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
// Retorna erros explícitos para o frontend poder tomar decisões de UX (ex: tela de erro, admin-context)
app.get('/api/public/org/by-host', async (req, res) => {
    try {
        const result = await resolveOrgFromHost(req);

        if (result.type === 'NOT_FOUND')    return res.status(404).json({ error: 'NOT_FOUND' });
        if (result.type === 'ADMIN_DOMAIN') return res.status(200).json({ adminDomain: true });
        if (result.type === 'DEV')          return res.status(200).json({ dev: true });

        const org = await prisma.organization.findUnique({
            where: { id: result.orgId },
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
        if (!org) return res.status(404).json({ error: 'NOT_FOUND' });
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
const notificationsRouter = require('./routes/notifications');

// API Pública v1 e gerenciamento admin
const apiV1Router = require('./api/routes/v1/index');
const apiKeysRouter = require('./api/routes/apiKeys');
const webhooksAdminRouter = require('./api/routes/webhooks');
const { dispatchWebhook } = require('./api/controllers/webhooksController');

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
app.use('/api/notifications', authenticateToken, resolveOrgContext, notificationsRouter);

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
// JOB DIÁRIO: Lembrete de reuniões de célula amanhã e aniversários
// Nota: lembretes de cultos/eventos foram removidos — notificações
// de "um dia antes" existem apenas para células e aniversários.
// ------------------------------------------------------------------
async function scheduleDailyEventReminder() {
    const run = async () => {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            const tomorrowDate = new Date(tomorrowStr + 'T12:00:00');
            const tomorrowDay = tomorrowDate.getDay(); // 0=Dom

            // Lembrete de reuniões de célula amanhã
            const dayNamesMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            const tomorrowDayPrefix = dayNamesMap[tomorrowDay].slice(0, 3); // 'Seg', 'Ter', etc.
            const cellsTomorrow = await prisma.cell.findMany({
                where: { meetingDay: { startsWith: tomorrowDayPrefix } },
                select: { id: true, name: true, meetingTime: true, organizationId: true, leaderId: true, viceLeaderId: true }
            });

            for (const cell of cellsTomorrow) {
                if (!cell.organizationId) continue;
                const notifCfg = await getNotificationConfig(cell.organizationId);
                if (notifCfg.cellMeeting?.enabled === false) continue;

                const recipientIds = [cell.leaderId, cell.viceLeaderId].filter(Boolean);
                if (!recipientIds.length) continue;

                const timeStr = cell.meetingTime ? ` às ${cell.meetingTime}` : '';
                const title = `🏠 Reunião de Célula Amanhã`;
                const message = `A célula "${cell.name}" se reúne amanhã${timeStr}. Confirme a presença dos membros!`;

                const recent = await prisma.notification.findFirst({
                    where: {
                        title,
                        message,
                        organizationId: cell.organizationId,
                        createdAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) }
                    }
                });
                if (recent) continue;

                try {
                    await prisma.notification.createMany({
                        data: recipientIds.map(userId => ({ userId, organizationId: cell.organizationId, title, message, action: '#/calendar' })),
                        skipDuplicates: true
                    });
                    sendPushToUsers(recipientIds, { title, body: message, data: { action: '#/calendar' } }).catch(() => {});
                    console.log(`[Lembrete] Reunião amanhã: ${cell.name}`);

                    // Webhook — payload completo com líder
                    const leaderUser = cell.leaderId ? await prisma.user.findUnique({
                        where: { id: cell.leaderId },
                        select: { id: true, name: true, person: { select: { phone: true } } }
                    }) : null;
                    dispatchWebhook('notificacao.reuniao_celula', {
                        celula: { id: cell.id, name: cell.name, meetingDay: cell.meetingDay, meetingTime: cell.meetingTime || null },
                        lider: leaderUser ? { id: leaderUser.id, name: leaderUser.name, phone: leaderUser.person?.phone || null } : null,
                        dataReuniao: tomorrowStr
                    }, cell.organizationId).catch(() => {});
                } catch (e) {
                    console.error('[Lembrete] Erro ao notificar célula:', cell.name, e.message);
                }
            }
            // Lembrete de eventos do calendário hoje
            const todayStr = new Date().toISOString().split('T')[0];
            const todayDate = new Date(todayStr + 'T12:00:00');
            const todayDow = todayDate.getDay(); // 0=Dom
            const todayDom = todayDate.getDate(); // dia do mês
            const todayMonth = todayDate.getMonth() + 1; // 1-12
            const todayMD = `${String(todayMonth).padStart(2,'0')}-${String(todayDom).padStart(2,'0')}`;

            // Busca todos os eventos com notify=true (filtra por recurrence abaixo)
            const allEvents = await prisma.event.findMany({
                where: { notify: true },
                select: { id: true, title: true, date: true, startTime: true, location: true, recurrence: true, organizationId: true }
            });

            // Busca exceções canceladas para hoje
            const canceledExceptions = await prisma.eventException.findMany({
                where: { date: todayStr, canceled: true },
                select: { eventId: true }
            });
            const canceledIds = new Set(canceledExceptions.map(e => e.eventId));

            for (const event of allEvents) {
                if (canceledIds.has(event.id)) continue;

                const eventDate = new Date(event.date + 'T12:00:00');
                const rec = event.recurrence || 'none';
                const occursToday =
                    (rec === 'none' && event.date === todayStr) ||
                    (rec === 'weekly' && eventDate.getDay() === todayDow) ||
                    (rec === 'monthly' && eventDate.getDate() === todayDom) ||
                    (rec === 'yearly' && event.date.slice(5) === todayMD); // MM-DD

                if (!occursToday) continue;

                const notifCfg = await getNotificationConfig(event.organizationId);
                if (notifCfg.newEvent?.enabled === false) continue;

                const dateFormatted = todayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
                const timeStr = event.startTime ? ` às ${event.startTime}` : '';
                const locationStr = event.location ? ` — ${event.location}` : '';
                const title = `📅 Hoje: ${event.title}`;
                const message = `"${event.title}" acontece hoje${timeStr}${locationStr}.`;

                // Evita duplicata no mesmo dia
                const recent = await prisma.notification.findFirst({
                    where: { title, organizationId: event.organizationId, createdAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) } }
                });
                if (recent) continue;

                try {
                    await notifyAllLeaders(title, message, event.organizationId, '#/calendar');
                    console.log(`[Lembrete] Evento hoje: ${event.title} (org=${event.organizationId})`);
                } catch (e) {
                    console.error('[Lembrete] Erro ao notificar evento:', event.title, e.message);
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
startRetryJob();

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
