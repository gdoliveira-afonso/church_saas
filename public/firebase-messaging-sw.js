/* Firebase Messaging Service Worker
 * Responsável por receber e exibir notificações quando o app está fechado/em background.
 * DEVE estar na raiz do site (/firebase-messaging-sw.js) — servido por Vite via public/.
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyAtygPhnf5mAdQvQxNY9ib5jCUayRoxAgI',
    authDomain: 'crm-celular.firebaseapp.com',
    projectId: 'crm-celular',
    storageBucket: 'crm-celular.firebasestorage.app',
    messagingSenderId: '145723578932',
    appId: '1:145723578932:web:3ad4dfd224515e9f53c861',
});

const messaging = firebase.messaging();

// Notificações recebidas com app fechado ou em background
messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'Nova notificação';
    const body  = payload.notification?.body  || '';
    const icon  = payload.data?.icon || '/favicon.ico';

    self.registration.showNotification(title, {
        body,
        icon,
        badge: icon,
        data: payload.data || {},
        vibrate: [200, 100, 200],
    });
});

// Clique na notificação: abre/foca a aba do app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            for (const client of list) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow('/');
        })
    );
});
