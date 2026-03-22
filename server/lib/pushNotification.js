/**
 * pushNotification.js
 * Envia push notifications via Firebase Cloud Messaging (FCM HTTP v1).
 *
 * Variáveis de ambiente necessárias:
 *   FCM_PROJECT_ID          — ID do projeto Firebase (ex: meu-app-12345)
 *   FCM_SERVICE_ACCOUNT_KEY — JSON completo da service account (stringificado)
 */

const prisma = require('./prisma');

let _auth = null;

function getAuth() {
    if (!process.env.FCM_PROJECT_ID || !process.env.FCM_SERVICE_ACCOUNT_KEY) {
        return null;
    }
    if (!_auth) {
        try {
            const { GoogleAuth } = require('google-auth-library');
            _auth = new GoogleAuth({
                credentials: JSON.parse(process.env.FCM_SERVICE_ACCOUNT_KEY),
                scopes: ['https://www.googleapis.com/auth/firebase.messaging']
            });
        } catch (err) {
            console.error('[Push] Erro ao inicializar GoogleAuth:', err.message);
            return null;
        }
    }
    return _auth;
}

/**
 * Envia uma mensagem FCM para um token específico.
 * @returns {Promise<boolean>} true se enviado com sucesso
 */
async function sendToToken(token, { title, body, data = {} }) {
    console.log('[Push] sendToToken token='+token.substring(0,20)+' title='+title+' data='+JSON.stringify(data));
    const auth = getAuth();
    if (!auth) { console.log('[Push] FCM não configurado'); return false; }

    try {
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        const projectId = process.env.FCM_PROJECT_ID;
        const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

        const message = {
            message: {
                token,
                notification: { title, body },
                data: Object.fromEntries(
                    Object.entries(data).map(([k, v]) => [k, String(v)])
                ),
                android: {
                    priority: 'high'
                },
                apns: {
                    payload: { aps: { sound: 'default', badge: 1 } }
                }
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            const err = await response.text();
            // Token inválido/expirado — sinaliza para remoção
            if (response.status === 404 || err.includes('UNREGISTERED')) {
                return 'unregistered';
            }
            console.error('[Push] FCM error:', response.status, err);
            return false;
        }

        console.log('[Push] FCM OK para token='+token.substring(0,20));
        return true;
    } catch (err) {
        console.error('[Push] Erro ao enviar push:', err.message);
        return false;
    }
}

/**
 * Envia push notification para todos os dispositivos registrados de um usuário.
 * Tokens inválidos (UNREGISTERED) são removidos automaticamente.
 *
 * @param {string} userId
 * @param {{ title: string, body: string, data?: object }} notification
 */
async function sendPushToUser(userId, notification) {
    const auth = getAuth();
    if (!auth) return;

    try {
        const tokens = await prisma.deviceToken.findMany({ where: { userId } });
        console.log('[Push] sendPushToUser userId='+userId+' tokens='+tokens.length);
        if (!tokens.length) return;

        const results = await Promise.allSettled(
            tokens.map(dt => sendToToken(dt.token, notification))
        );

        // Remove tokens inválidos
        const toRemove = [];
        results.forEach((result, i) => {
            if (result.status === 'fulfilled' && result.value === 'unregistered') {
                toRemove.push(tokens[i].id);
            }
        });

        if (toRemove.length) {
            await prisma.deviceToken.deleteMany({ where: { id: { in: toRemove } } });
        }
    } catch (err) {
        console.error('[Push] sendPushToUser error:', err.message);
    }
}

/**
 * Envia push para múltiplos usuários (em paralelo, sem lançar exceções).
 *
 * @param {string[]} userIds
 * @param {{ title: string, body: string, data?: object }} notification
 */
async function sendPushToUsers(userIds, notification) {
    if (!userIds?.length) return;
    await Promise.allSettled(userIds.map(id => sendPushToUser(id, notification)));
}

module.exports = { sendPushToUser, sendPushToUsers };
