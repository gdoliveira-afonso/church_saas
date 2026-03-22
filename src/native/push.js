/**
 * push.js — Push notifications via @capacitor-firebase/messaging
 *
 * Fluxo:
 *  1. requestPermissionAndRegister() — chamado após login bem-sucedido
 *     → Verifica estado atual → Pede permissão se necessário → Obtém token FCM → Registra no servidor
 *  2. unregisterPushToken() — chamado no logout
 *     → Remove token do servidor e limpa localStorage
 *  3. setupForegroundListener() — escuta notificações recebidas com app aberto
 */

import { isNativeApp } from './index.js';

const TOKEN_KEY = 'fcm_device_token';
const CHANNEL_ID = 'default';

/**
 * Cria o canal de notificação padrão (necessário Android 8+ / API 26+).
 * Sem canal, notificações são silenciosamente descartadas.
 */
async function createNotificationChannel(FirebaseMessaging) {
    try {
        // Verifica se a API está disponível (pode não estar em versões antigas do plugin)
        if (typeof FirebaseMessaging.createChannel !== 'function') {
            console.log('[Push] createChannel não disponível nessa versão do plugin, pulando.');
            return;
        }
        await FirebaseMessaging.createChannel({
            id: CHANNEL_ID,
            name: 'Notificações',
            description: 'Notificações do SGI',
            importance: 4, // HIGH
            visibility: 1, // PUBLIC
            sound: 'default',
            vibration: true,
            lights: true
        });
        console.log('[Push] Canal de notificação criado/atualizado.');
    } catch (e) {
        console.warn('[Push] Erro ao criar canal de notificação:', e.message);
    }
}

/**
 * Registra o token FCM no servidor.
 */
async function registerTokenOnServer(token, apiBase, authToken) {
    console.log('[Push] Registrando token no servidor...');
    const res = await fetch(`${apiBase}/notifications/device-token`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, platform: 'android' })
    });
    if (res.ok) {
        localStorage.setItem(TOKEN_KEY, token);
        console.log('[Push] Token registrado com sucesso no servidor.');
    } else {
        const body = await res.text().catch(() => '');
        console.error(`[Push] Servidor rejeitou o token (HTTP ${res.status}):`, body);
    }
}

/**
 * Solicita permissão de notificação, obtém o token FCM e registra no servidor.
 * Deve ser chamado logo após o login bem-sucedido.
 *
 * @param {object} store — instância do Store
 */
export async function requestPermissionAndRegister(store) {
    if (!isNativeApp()) {
        console.log('[Push] Não é app nativo, ignorando.');
        return;
    }

    console.log('[Push] Iniciando fluxo de permissão e registro...');

    let FirebaseMessaging;
    try {
        const mod = await import('@capacitor-firebase/messaging');
        FirebaseMessaging = mod.FirebaseMessaging;
        console.log('[Push] Plugin @capacitor-firebase/messaging carregado.');
    } catch (e) {
        console.error('[Push] Falha ao carregar plugin Firebase Messaging:', e.message);
        return;
    }

    // Cria canal de notificação para Android 8+
    await createNotificationChannel(FirebaseMessaging);

    // Verifica o estado atual da permissão
    let currentState;
    try {
        const permStatus = await FirebaseMessaging.checkPermissions();
        currentState = permStatus.receive;
        console.log('[Push] Estado atual da permissão:', currentState);
    } catch (e) {
        console.error('[Push] Erro ao verificar permissões:', e.message);
        return;
    }

    // Solicita permissão apenas se ainda não decidido
    if (currentState === 'prompt' || currentState === 'prompt-with-rationale') {
        console.log('[Push] Solicitando permissão ao usuário...');
        try {
            const result = await FirebaseMessaging.requestPermissions();
            currentState = result.receive;
            console.log('[Push] Resultado da solicitação de permissão:', currentState);
        } catch (e) {
            console.error('[Push] Erro ao solicitar permissão:', e.message);
            return;
        }
    }

    if (currentState !== 'granted') {
        console.warn('[Push] Permissão não concedida. Estado final:', currentState);
        return;
    }

    console.log('[Push] Permissão concedida. Obtendo token FCM...');

    // Obtém o token FCM com retry (SERVICE_NOT_AVAILABLE é transitório)
    let token;
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await FirebaseMessaging.getToken();
            token = result.token;
            break;
        } catch (e) {
            console.warn(`[Push] Tentativa ${attempt}/${maxAttempts} falhou: ${e.message}`);
            if (attempt < maxAttempts) {
                const delay = attempt * 3000; // 3s, 6s, 9s
                console.log(`[Push] Aguardando ${delay / 1000}s antes de tentar novamente...`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                console.error('[Push] Todas as tentativas de obter token FCM falharam. Tente novamente mais tarde.');
                return;
            }
        }
    }

    if (!token) {
        console.error('[Push] Token FCM retornou vazio. Verifique google-services.json e conexão com FCM.');
        return;
    }

    console.log('[Push] Token FCM obtido:', token.substring(0, 30) + '...');

    // Registra no servidor se for token novo
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (token !== savedToken) {
        try {
            await registerTokenOnServer(token, store.apiBase, store.token);
        } catch (e) {
            console.error('[Push] Erro ao registrar token no servidor:', e.message);
        }
    } else {
        console.log('[Push] Token já registrado anteriormente, pulando registro.');
    }

    // Listener para token renovado pelo FCM
    try {
        await FirebaseMessaging.addListener('tokenReceived', async ({ token: newToken }) => {
            console.log('[Push] Token renovado pelo FCM, re-registrando...');
            try {
                await registerTokenOnServer(newToken, store.apiBase, store.token);
            } catch (e) {
                console.error('[Push] Erro ao re-registrar token renovado:', e.message);
            }
        });
    } catch (e) {
        console.warn('[Push] Erro ao configurar listener de token renovado:', e.message);
    }

    console.log('[Push] Fluxo de registro concluído com sucesso.');
}

/**
 * Remove o token do dispositivo do servidor (chamar no logout).
 * @param {object} store — instância do Store
 */
export async function unregisterPushToken(store) {
    if (!isNativeApp()) return;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !store.token) return;

    try {
        await fetch(`${store.apiBase}/notifications/device-token`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${store.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });
        localStorage.removeItem(TOKEN_KEY);
        console.log('[Push] Token removido do servidor.');
    } catch (e) {
        console.warn('[Push] Erro ao remover token:', e.message);
    }

    try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        await FirebaseMessaging.removeAllListeners();
    } catch (_) { /* silencia se plugin não disponível */ }
}

/**
 * Navega para uma rota hash, aguardando o router estar pronto se necessário.
 */
function navigateTo(action) {
    if (!action) return;
    // Remove prefixo # duplicado se existir
    const hash = action.startsWith('#') ? action : '#' + action;
    console.log('[Push] Navegando para:', hash);
    if (window.location.hash === hash) {
        // Já na rota — dispara evento para forçar re-render
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
        window.location.hash = hash;
    }
}

/**
 * Configura listener para notificações recebidas com o app em primeiro plano,
 * e tap em notificações (background ou app fechado).
 */
export async function setupForegroundListener() {
    if (!isNativeApp()) return;

    try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

        // Notificação recebida com app aberto → mostra toast
        // Para mensagens data-only, title/body chegam em notification.data
        await FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
            const title = notification?.title || notification?.data?.title || 'SGI';
            const body = notification?.body || notification?.data?.body || '';
            console.log(`[Push] Notificação em foreground: ${title}`);

            window.dispatchEvent(new CustomEvent('push-notification', {
                detail: { title, body, data: notification?.data || {} }
            }));
        });

        // Tap na notificação → abre o app e navega para a tela correta
        await FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
            const data = notification?.data || {};
            console.log('[Push] Notificação tocada, action:', data.action);
            if (data.action) {
                // Pequeno delay para garantir que o router esteja inicializado (cold start)
                setTimeout(() => navigateTo(data.action), 300);
            }
        });

        // Verifica se o app foi aberto por tap em notificação (cold start)
        try {
            const delivered = await FirebaseMessaging.getDeliveredNotifications();
            // Não processa aqui — o notificationActionPerformed cuida disso
            console.log(`[Push] ${delivered?.notifications?.length || 0} notificação(ões) entregue(s) no bandeja.`);
        } catch (_) { /* método pode não estar disponível em todas as versões */ }

        console.log('[Push] Listeners de foreground configurados.');
    } catch (e) {
        console.warn('[Push] Erro ao configurar listeners de foreground:', e.message);
    }
}
