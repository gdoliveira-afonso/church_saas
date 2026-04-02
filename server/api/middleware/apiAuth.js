const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const rateLimit = require('express-rate-limit');

const prisma = new PrismaClient();

// Cache de API Keys: keyPrefix → { apiKey, expiresAt }
// Evita bcrypt.compare() O(n) a cada request — TTL de 60s
const keyCache = new Map();
const CACHE_TTL = 60 * 1000;

function getCachedKey(prefix) {
    const entry = keyCache.get(prefix);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
        keyCache.delete(prefix);
        return null;
    }
    return entry.apiKey;
}

function setCachedKey(prefix, apiKey) {
    keyCache.set(prefix, { apiKey, expiresAt: Date.now() + CACHE_TTL });
}

// Rate limiter: 100 req/min por keyPrefix
const apiRateLimiters = new Map();

function getRateLimiter(keyPrefix) {
    if (!apiRateLimiters.has(keyPrefix)) {
        apiRateLimiters.set(keyPrefix, rateLimit({
            windowMs: 60 * 1000,
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
            message: { success: false, error: 'Rate limit excedido. Máximo 100 requisições por minuto.' },
            keyGenerator: () => keyPrefix,
        }));
    }
    return apiRateLimiters.get(keyPrefix);
}

async function apiAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'API key ausente. Use: Authorization: Bearer <sua_api_key>' });
    }

    const providedKey = authHeader.split(' ')[1];

    // keyPrefix é gerado como: rawKey.substring(0, 15) + '...'
    // Reconstituímos o mesmo padrão para busca direta no DB
    const derivedPrefix = providedKey.substring(0, 15) + '...';

    try {
        let matchedKey = getCachedKey(derivedPrefix);

        if (!matchedKey) {
            // Busca apenas a key cujo prefixo bate — O(1) ao invés de O(n)
            const candidate = await prisma.apiKey.findFirst({
                where: { keyPrefix: derivedPrefix, status: 'active' }
            });

            if (!candidate) {
                return res.status(401).json({ success: false, error: 'API key inválida ou revogada.' });
            }

            const valid = await bcrypt.compare(providedKey, candidate.keyHash);
            if (!valid) {
                return res.status(401).json({ success: false, error: 'API key inválida ou revogada.' });
            }

            matchedKey = candidate;
            setCachedKey(derivedPrefix, matchedKey);
        }

        // Aplica rate limit específico desta chave
        const limiter = getRateLimiter(matchedKey.keyPrefix);
        limiter(req, res, async () => {
            // Atualiza lastUsedAt de forma assíncrona (não bloqueia resposta)
            prisma.apiKey.update({
                where: { id: matchedKey.id },
                data: { lastUsedAt: new Date() }
            }).catch(() => { });

            req.apiKey = matchedKey;
            req.apiPermissions = matchedKey.permissions.split(',').map(p => p.trim());
            next();
        });
    } catch (error) {
        console.error('[apiAuth] Erro:', error.message);
        res.status(500).json({ success: false, error: 'Erro interno de autenticação.' });
    }
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.apiPermissions || !req.apiPermissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                error: `Permissão '${permission}' necessária para este endpoint.`
            });
        }
        next();
    };
}

module.exports = { apiAuth, requirePermission };
