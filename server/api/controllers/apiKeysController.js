const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Gera chave: sk_live_<64 hex chars>
function generateApiKey() {
    const raw = crypto.randomBytes(32).toString('hex');
    return `sk_live_${raw}`;
}

// Lista todas as chaves (sem revelar hash)
async function listKeys(req, res) {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        const keys = await prisma.apiKey.findMany({
            where: { organizationId: req.user.organizationId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, keyPrefix: true, permissions: true, status: true, createdAt: true, lastUsedAt: true }
        });
        res.json({ success: true, data: keys });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar chaves.' });
    }
}

// Cria nova chave — exibe APENAS UMA VEZ
async function createKey(req, res) {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        const { name, permissions } = req.body;
        if (!name) return res.status(400).json({ error: 'Nome da chave é obrigatório.' });

        const rawKey = generateApiKey();
        const keyPrefix = rawKey.substring(0, 15) + '...'; // ex: "sk_live_7d9f3a..."
        const keyHash = await bcrypt.hash(rawKey, 10);
        const perms = permissions && permissions.length > 0
            ? permissions.join(',')
            : 'read_membros,read_eventos,read_frequencia';

        const apiKey = await prisma.apiKey.create({
            data: { name, keyHash, keyPrefix, permissions: perms, status: 'active', organizationId: req.user.organizationId }
        });

        // Retorna a chave RAW apenas aqui — nunca mais será exibida
        res.status(201).json({
            success: true,
            message: 'Guarde esta chave agora. Ela não será exibida novamente.',
            data: {
                id: apiKey.id,
                name: apiKey.name,
                key: rawKey, // única vez
                keyPrefix: apiKey.keyPrefix,
                permissions: apiKey.permissions,
                createdAt: apiKey.createdAt
            }
        });
    } catch (err) {
        console.error('[createKey]', err);
        res.status(500).json({ error: 'Erro ao criar chave.' });
    }
}

// Revoga chave
async function revokeKey(req, res) {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        const { id } = req.params;
        const key = await prisma.apiKey.findFirst({ where: { id, organizationId: req.user.organizationId } });
        if (!key) return res.status(404).json({ error: 'Chave não encontrada.' });

        await prisma.apiKey.update({ where: { id }, data: { status: 'revoked' } });
        res.json({ success: true, message: 'Chave revogada com sucesso.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao revogar chave.' });
    }
}

// Remove chave permanentemente
async function deleteKey(req, res) {
    try {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Apenas administradores.' });
        const { id } = req.params;
        const keyToDelete = await prisma.apiKey.findFirst({ where: { id, organizationId: req.user.organizationId } });
        if (!keyToDelete) return res.status(404).json({ error: 'Chave não encontrada.' });
        await prisma.apiKey.delete({ where: { id } });
        res.json({ success: true, message: 'Chave removida.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover chave.' });
    }
}

module.exports = { listKeys, createKey, revokeKey, deleteKey };
