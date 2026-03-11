import { store } from './store.js';
import { updateSidebar } from './components/ui.js';
const routes = {};
export function route(p, h) { routes[p] = h }
export function navigate(p) { window.location.hash = p }
export function getParams() { const h = window.location.hash.slice(1); const [p, q] = h.split('?'); const params = {}; if (q) q.split('&').forEach(s => { const [k, v] = s.split('='); params[k] = decodeURIComponent(v) }); return { path: p, params } }
let currentNavTimeout = null;
export function startRouter() {
    const handle = () => {
        const { path, params } = getParams();
        const h = routes[path] || routes['/login'];

        const app = document.getElementById('app');
        if (app) {
            // Se já houver uma transição pendente, cancela para evitar conflitos
            if (currentNavTimeout) clearTimeout(currentNavTimeout);

            // Mostra splash screen para a transição
            document.body.classList.remove('app-ready');

            currentNavTimeout = setTimeout(async () => {
                if (h) await h(params);
                updateSidebar();

                // Garante que o DOM foi processado antes de remover o splash
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        document.body.classList.add('app-ready');
                        currentNavTimeout = null;
                    }, 50);
                });
            }, 300);
        } else {
            if (h) h(params);
            updateSidebar();
        }
    };
    window.addEventListener('hashchange', handle);
    if (!window.location.hash) {
        if (store.isLoggedIn()) {
            if (store.currentUser.role === 'SUPERADMIN') window.location.hash = '/organizations';
            else window.location.hash = '/dashboard';
        }
        else window.location.hash = '/login';
    } else handle();
}

