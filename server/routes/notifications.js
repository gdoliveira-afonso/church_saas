const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

// ─── DEVICE TOKENS (Push Notifications) ───────────────────────────────────────

/**
 * POST /api/notifications/device-token
 * Registra ou atualiza o FCM token do dispositivo do usuário autenticado.
 * Body: { token: string, platform?: "android"|"ios" }
 */
router.post('/device-token', async (req, res) => {
    try {
        const userId = req.user.id;
        const orgId = req.orgId;
        const { token, platform = 'android' } = req.body;

        if (!token) return res.status(400).json({ error: 'token é obrigatório.' });

        await prisma.deviceToken.upsert({
            where: { userId_token: { userId, token } },
            create: { userId, organizationId: orgId, token, platform },
            update: { updatedAt: new Date() }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[DeviceToken] Erro ao registrar:', err.message);
        res.status(500).json({ error: 'Erro ao registrar token.' });
    }
});

/**
 * DELETE /api/notifications/device-token
 * Remove o FCM token do dispositivo (ao fazer logout).
 * Body: { token: string }
 */
router.delete('/device-token', async (req, res) => {
    try {
        const userId = req.user.id;
        const { token } = req.body;

        if (!token) return res.status(400).json({ error: 'token é obrigatório.' });

        await prisma.deviceToken.deleteMany({ where: { userId, token } });

        res.json({ success: true });
    } catch (err) {
        console.error('[DeviceToken] Erro ao remover:', err.message);
        res.status(500).json({ error: 'Erro ao remover token.' });
    }
});

// ─── NOTIFICAÇÕES IN-APP ──────────────────────────────────────────────────────

/**
 * GET /api/notifications
 * Retorna as notificações do usuário autenticado (últimas 50).
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        const unreadCount = notifications.filter(n => !n.read).length;
        res.json({ success: true, data: notifications, unreadCount });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar notificações.' });
    }
});

/**
 * PATCH /api/notifications/:id/read
 * Marca uma notificação como lida.
 */
router.patch('/:id/read', async (req, res) => {
    try {
        const userId = req.user.id;
        const notif = await prisma.notification.findFirst({
            where: { id: req.params.id, userId }
        });
        if (!notif) return res.status(404).json({ error: 'Notificação não encontrada.' });

        await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao marcar notificação.' });
    }
});

/**
 * POST /api/notifications/read-all
 * Marca todas as notificações do usuário como lidas.
 */
router.post('/read-all', async (req, res) => {
    try {
        const userId = req.user.id;
        await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao marcar notificações.' });
    }
});

module.exports = router;
