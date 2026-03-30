/**
 * Web Push Notifications (navegador)
 * Funciona em Chrome/Edge/Firefox desktop e mobile.
 * No iOS: só funciona quando o site está salvo na Tela de Início (PWA) e iOS 16.4+.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { isNativeApp } from './index.js';

const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyAtygPhnf5mAdQvQxNY9ib5jCUayRoxAgI',
    authDomain: 'crm-celular.firebaseapp.com',
    projectId: 'crm-celular',
    storageBucket: 'crm-celular.firebasestorage.app',
    messagingSenderId: '145723578932',
    appId: '1:145723578932:web:3ad4dfd224515e9f53c861',
};

const VAPID_KEY = 'BJz1t0o081z9QjU-eUHG7HyXLXcHvzggeVAS8ELUz-XSRz7NLpoKOwgyEIOVGlrupQJcHNR4TxJsFkfF_EYRfbg';
const TOKEN_KEY = 'fcm_web_token';

function isSupported() {
    return !isNativeApp()
        && 'Notification' in window
        && 'serviceWorker' in navigator
        && 'PushManager' in window;
}

function getApp() {
    return getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
}

/**
 * Solicita permissão e registra o token FCM web no servidor.
 * Chamado após login bem-sucedido.
 */
export async function requestWebPushPermission(store) {
    if (!isSupported()) return;

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;

        const messaging = getMessaging(getApp());
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw });

        if (!token) return;

        // Evita re-registrar o mesmo token
        if (localStorage.getItem(TOKEN_KEY) === token) return;

        await fetch(`${store.apiBase}/notifications/device-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${store.token}`,
            },
            body: JSON.stringify({ token, platform: 'web' }),
        });

        localStorage.setItem(TOKEN_KEY, token);
        console.log('[push-web] token registrado com sucesso');
    } catch (e) {
        console.warn('[push-web] registro falhou:', e);
    }
}

/**
 * Escuta notificações com app aberto (foreground) e exibe toast.
 */
export async function setupWebForegroundListener(store) {
    if (!isSupported()) return;
    if (Notification.permission !== 'granted') return;

    try {
        const messaging = getMessaging(getApp());
        onMessage(messaging, (payload) => {
            const title = payload.notification?.title || '';
            const body  = payload.notification?.body  || '';
            const text  = [title, body].filter(Boolean).join(' — ');
            if (text && store.showToast) store.showToast(text, 'info');
        });
    } catch (e) {
        console.warn('[push-web] foreground listener falhou:', e);
    }
}

/**
 * Remove token web do servidor no logout.
 */
export async function unregisterWebPushToken(store) {
    if (!isSupported()) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {
        await fetch(`${store.apiBase}/notifications/device-token`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${store.token}`,
            },
            body: JSON.stringify({ token }),
        });
    } catch (_) {}

    localStorage.removeItem(TOKEN_KEY);
}

/* ── Banner iOS ─────────────────────────────────────────────────────────── */

export function showIOSInstallBanner() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
    const dismissed = localStorage.getItem('ios-banner-dismissed');

    if (!isIOS || isStandalone || dismissed) return;

    const banner = document.createElement('div');
    banner.id = 'ios-install-banner';
    banner.innerHTML = `
        <div style="
            position:fixed;bottom:0;left:0;right:0;z-index:99998;
            background:#1b2840;color:#dde8f7;
            padding:16px 20px 28px;border-top:1px solid rgba(255,255,255,0.1);
            display:flex;align-items:flex-start;gap:14px;
            font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;
            box-shadow:0 -8px 32px rgba(0,0,0,0.35);
            animation:ios-slide-up 0.35s cubic-bezier(0.34,1.56,0.64,1);
        ">
            <span style="font-size:28px;flex-shrink:0;">📲</span>
            <div style="flex:1">
                <p style="margin:0 0 4px;font-weight:700;font-size:15px;">Ative as notificações</p>
                <p style="margin:0;color:#8aa8cc;">
                    Para receber notificações no iPhone, adicione este app à
                    <strong style="color:#dde8f7;">Tela de Início</strong>:
                    toque em <strong style="color:#dde8f7;">⬆️ Compartilhar</strong>
                    e depois <strong style="color:#dde8f7;">"Adicionar à Tela de Início"</strong>.
                </p>
            </div>
            <button id="ios-banner-close" style="
                background:none;border:none;color:#8aa8cc;font-size:20px;
                cursor:pointer;padding:0;flex-shrink:0;line-height:1;
            ">✕</button>
        </div>
        <style>
            @keyframes ios-slide-up {
                from{transform:translateY(100%);opacity:0}
                to{transform:translateY(0);opacity:1}
            }
        </style>
    `;

    document.body.appendChild(banner);
    document.getElementById('ios-banner-close').addEventListener('click', () => {
        banner.remove();
        localStorage.setItem('ios-banner-dismissed', '1');
    });
    setTimeout(() => banner?.remove(), 20000);
}
