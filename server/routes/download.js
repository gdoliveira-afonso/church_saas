/**
 * Download temporário — suporte a Capacitor Android WebView
 *
 * O Android WebView não suporta <a download> com blob: URLs nem Web Share API com arquivos
 * gerados no cliente. A solução é:
 *   1. POST /api/download/temp  — recebe base64, armazena em memória com token (TTL 2 min)
 *   2. GET  /api/download/temp/:token — retorna o arquivo com Content-Disposition: attachment
 *      sem autenticação (o token curto-vivido é a autenticação)
 *
 * O GET dispara o DownloadListener nativo do Android, que salva o arquivo via DownloadManager.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware de autenticação local (sem resolveOrgContext — só valida token JWT)
function requireAuth(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return res.sendStatus(401);
    try {
        req.user = jwt.verify(auth.slice(7), JWT_SECRET);
        next();
    } catch (e) {
        res.sendStatus(401);
    }
}

// Mapa em memória: token → { data: Buffer, filename, mimeType, expiresAt }
const tempStore = new Map();

// Limpeza periódica de tokens expirados (a cada 5 minutos)
setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of tempStore.entries()) {
        if (entry.expiresAt < now) tempStore.delete(token);
    }
}, 5 * 60 * 1000);

/**
 * POST /api/download/temp
 * Body: { data: "<base64>", filename: "arquivo.xlsx", mimeType: "application/vnd.openxmlformats..." }
 * Requer autenticação JWT.
 * Retorna: { token: "<uuid>", url: "/api/download/temp/<token>" }
 */
router.post('/temp', requireAuth, (req, res) => {
    const { data, filename, mimeType } = req.body;

    if (!data || !filename || !mimeType) {
        return res.status(400).json({ error: 'data, filename e mimeType são obrigatórios' });
    }

    // Limite de 20MB em base64 (~15MB binário)
    if (data.length > 20 * 1024 * 1024) {
        return res.status(413).json({ error: 'Arquivo muito grande (máx 20MB)' });
    }

    let buffer;
    try {
        buffer = Buffer.from(data, 'base64');
    } catch (e) {
        return res.status(400).json({ error: 'Dados base64 inválidos' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 2 * 60 * 1000; // 2 minutos

    tempStore.set(token, { data: buffer, filename, mimeType, expiresAt });

    res.json({ token, url: `/api/download/temp/${token}` });
});

/**
 * GET /api/download/temp/:token
 * Sem autenticação — o token curto-vivido é a autenticação.
 * Retorna o arquivo com Content-Disposition: attachment para disparar o DownloadManager do Android.
 */
router.get('/temp/:token', (req, res) => {
    const entry = tempStore.get(req.params.token);

    if (!entry) {
        return res.status(404).send('Token inválido ou expirado');
    }

    if (entry.expiresAt < Date.now()) {
        tempStore.delete(req.params.token);
        return res.status(410).send('Token expirado');
    }

    // Consome o token (uso único)
    tempStore.delete(req.params.token);

    // Sanitiza o filename para uso no header HTTP
    const safeFilename = entry.filename.replace(/[^a-zA-Z0-9._\-() ]/g, '_');

    res.setHeader('Content-Type', entry.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', entry.data.length);
    res.setHeader('Cache-Control', 'no-store');
    res.end(entry.data);
});

module.exports = router;
