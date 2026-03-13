const express = require('express');
const prisma = require('../lib/prisma');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router();

// Helper: busca configurações via SystemConfig por organização
async function getOrgConfig(orgId, key) {
    try {
        const config = await prisma.systemConfig.findUnique({ 
            where: { key_organizationId: { key, organizationId: orgId } } 
        });
        return config ? config.value : '';
    } catch (e) { return ''; }
}

async function saveOrgConfig(orgId, key, value) {
    try {
        await prisma.systemConfig.upsert({
            where: { key_organizationId: { key, organizationId: orgId } },
            update: { value: value || '' },
            create: { key, value: value || '', organizationId: orgId }
        });
        return true;
    } catch (e) {
        console.error(`Error saving config ${key}:`, e);
        return false;
    }
}

// ROTA PÚBLICA: GET /api/public/settings/config
router.get('/config', async (req, res) => {
    try {
        const { org: slug } = req.query;
        if (!slug) return res.status(400).json({ error: 'Organização não especificada' });

        const org = await prisma.organization.findFirst({
            where: { OR: [{ slug }, { subdomain: slug }, { customDomain: slug }] }
        });

        if (!org) return res.status(404).json({ error: 'Igreja não encontrada' });

        const settings = {
            id: org.id,
            appName: org.name,
            primaryColor: org.primaryColor,
            logoUrl: org.logoUrl,
            loginMessage: org.loginMessage,
            congregationName: org.congregationName,
            congregationAddress: org.congregationAddress,
            pastorName: org.pastorName,
            nucleus: org.nucleus,
            cellsEnabled: org.cellsEnabled,
            ebdEnabled: org.ebdEnabled,
            financialEnabled: org.financialEnabled
        };

        const cellCustomFields = await getOrgConfig(org.id, 'cellCustomFields');
        res.json({ ...settings, cellCustomFields });
    } catch (error) {
        console.error("Erro ao buscar configurações públicas:", error);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

// NOVO: GET /api/public/settings/public-cell-fields
router.get('/public-cell-fields', async (req, res) => {
    try {
        const { org: slug } = req.query;
        if (!slug) return res.status(400).json({ error: 'Organização não especificada' });

        const org = await prisma.organization.findFirst({
            where: { OR: [{ slug }, { subdomain: slug }, { customDomain: slug }] }
        });

        if (!org) return res.status(404).json({ error: 'Igreja não encontrada' });

        const value = await getOrgConfig(org.id, 'cellCustomFields');
        res.json({ cellCustomFields: value });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar campos' });
    }
});

// ROTA PÚBLICA: GET /api/public/settings/manifest.json
router.get('/manifest.json', async (req, res) => {
    try {
        const { org: slugParam } = req.query;
        const hostname = req.hostname;
        let slug = slugParam;

        if (!slug) {
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                slug = 'matriz';
            } else {
                slug = hostname; // Tenta o domínio cheio
            }
        }

        let org = await prisma.organization.findFirst({
            where: { OR: [{ slug: slug || 'matriz' }, { subdomain: slug }, { customDomain: slug }] }
        });

        // Fallback para subdomínio se for algo como igreja.meusistema.com
        if (!org && hostname.includes('.') && hostname !== 'localhost') {
            const sub = hostname.split('.')[0];
            org = await prisma.organization.findFirst({
                where: { OR: [{ slug: sub }, { subdomain: sub }] }
            });
        }

        // Se ainda nada, usa a matriz como fallback seguro para o manifesto
        if (!org) {
            org = await prisma.organization.findFirst({ where: { slug: 'matriz' } });
        }

        if (!org) return res.status(404).json({ error: 'Organização não encontrada para o manifesto' });

        const manifest = {
            name: org.name,
            short_name: org.name,
            description: org.loginMessage || 'CRM Celular',
            start_url: '/',
            display: 'standalone',
            orientation: 'portrait',
            background_color: '#ffffff',
            theme_color: org.primaryColor,
            icons: []
        };

        if (org.logoUrl) {
            manifest.icons.push({ src: org.logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any' });
            manifest.icons.push({ src: org.logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any maskable' });
        }

        res.json(manifest);
    } catch (error) {
        console.error("[Manifest Error]:", error);
        res.status(500).json({ error: 'Erro ao gerar manifesto' });
    }
});

// ROTA PRIVADA: GET /api/settings — dados completos da organização para o admin
router.get('/', async (req, res) => {
    try {
        const orgId = req.orgId;
        if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });

        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) return res.status(404).json({ error: 'Organização não encontrada' });

        const cellCustomFields = await getOrgConfig(orgId, 'cellCustomFields');

        res.json({
            id: org.id,
            name: org.name,
            appName: org.name,
            slug: org.slug,
            subdomain: org.subdomain,
            customDomain: org.customDomain,
            status: org.status,
            plan: org.plan,
            cellsEnabled: org.cellsEnabled,
            ebdEnabled: org.ebdEnabled,
            financialEnabled: org.financialEnabled,
            primaryColor: org.primaryColor,
            logoUrl: org.logoUrl,
            loginMessage: org.loginMessage,
            congregationName: org.congregationName,
            congregationAddress: org.congregationAddress,
            pastorName: org.pastorName,
            nucleus: org.nucleus,
            createdAt: org.createdAt,
            cellCustomFields
        });
    } catch (error) {
        console.error('[Settings GET Error]:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

// ROTA PRIVADA: PUT /api/settings
router.put('/', async (req, res) => {
    try {
        const { appName, primaryColor, logoUrl, loginMessage, congregationName, congregationAddress, pastorName, nucleus, cellCustomFields, cellsEnabled, ebdEnabled, financialEnabled } = req.body;
        
        // req.orgId é resolvido pelo middleware resolveOrgContext (no index.js)
        const orgId = req.orgId;

        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        if (!orgId) {
            return res.status(400).json({ error: 'Organização não identificada para salvamento.' });
        }

        // Busca org atual para detectar mudança de logo e limpar arquivo antigo
        const currentOrg = await prisma.organization.findUnique({ where: { id: orgId }, select: { logoUrl: true } });

        const data = {};
        if (appName !== undefined) data.name = appName;
        if (primaryColor !== undefined) data.primaryColor = primaryColor || '#0f172a';
        if (logoUrl !== undefined) data.logoUrl = logoUrl;
        if (loginMessage !== undefined) data.loginMessage = loginMessage;
        if (congregationName !== undefined) data.congregationName = congregationName;
        if (congregationAddress !== undefined) data.congregationAddress = congregationAddress;
        if (pastorName !== undefined) data.pastorName = pastorName;
        if (nucleus !== undefined) data.nucleus = nucleus;
        if (cellsEnabled !== undefined) data.cellsEnabled = Boolean(cellsEnabled);
        if (ebdEnabled !== undefined) data.ebdEnabled = Boolean(ebdEnabled);
        if (financialEnabled !== undefined) data.financialEnabled = Boolean(financialEnabled);

        const updated = await prisma.organization.update({
            where: { id: orgId },
            data
        });

        // Limpa o arquivo de logo anterior se foi substituído por um arquivo local novo
        if (logoUrl !== undefined && currentOrg?.logoUrl !== logoUrl && currentOrg?.logoUrl?.startsWith('/uploads/')) {
            const oldPath = path.join(__dirname, '..', currentOrg.logoUrl);
            fs.unlink(oldPath, () => {}); // assíncrono, não bloqueia a resposta
        }

        if (cellCustomFields !== undefined) {
            await saveOrgConfig(orgId, 'cellCustomFields', cellCustomFields);
        }

        // Retorna mapeado para appName para consistência com o frontend e rotas públicas
        res.json({
            ...updated,
            appName: updated.name
        });
    } catch (error) {
        console.error("[Settings PUT Error]:", error);
        res.status(500).json({ error: 'Erro ao atualizar configurações: ' + error.message });
    }
});

// ROTAS DEDICADAS para campos customizados
router.get('/cell-fields', async (req, res) => {
    try {
        const orgId = req.orgId;
        if (!orgId) return res.status(400).json({ error: 'ID da organização não identificado' });
        const value = await getOrgConfig(orgId, 'cellCustomFields');
        res.json({ cellCustomFields: value });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar campos' });
    }
});

router.put('/cell-fields', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        const { cellCustomFields } = req.body;
        const orgId = req.orgId;
        await saveOrgConfig(orgId, 'cellCustomFields', cellCustomFields);
        res.json({ cellCustomFields });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar campos' });
    }
});

const multer = require('multer');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const orgId = req.orgId || 'default';
        const orgPath = path.join(__dirname, '..', 'uploads', orgId);
        if (!fs.existsSync(orgPath)) fs.mkdirSync(orgPath, { recursive: true });
        cb(null, orgPath);
    },
    filename: function (req, file, cb) {
        const rawExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
        const ext = ALLOWED_EXT.includes(rawExt.slice(1)) ? rawExt : '.png';
        const unique = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        cb(null, 'logo-' + unique + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido. Use PNG, JPG, GIF, WEBP ou SVG.'));
        }
    }
});

router.post('/upload-logo', (req, res, next) => {
    upload.single('logo')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        const orgId = req.orgId || 'default';
        res.json({ url: `/uploads/${orgId}/${req.file.filename}` });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no upload' });
    }
});

module.exports = router;
