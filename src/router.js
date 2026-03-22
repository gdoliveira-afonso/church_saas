import { store } from './store.js';
import { updateSidebar } from './components/ui.js';
const routes = {};
export function route(p, h) { routes[p] = h }
export function navigate(p) { window.location.hash = p }
export function getParams() { const h = window.location.hash.slice(1); const [p, q] = h.split('?'); const params = {}; if (q) q.split('&').forEach(s => { const [k, v] = s.split('='); params[k] = decodeURIComponent(v) }); return { path: p, params } }
let currentNavTimeout = null;

function showPageLoader() {
    const el = document.getElementById('page-loader');
    if (!el) return;
    el.classList.remove('done');
    el.classList.add('loading');
}

function hidePageLoader() {
    const el = document.getElementById('page-loader');
    if (!el) return;
    el.classList.remove('loading');
    el.classList.add('done');
    setTimeout(() => el.classList.remove('done'), 600);
}

export function startRouter() {
    const handle = () => {
        const { path, params } = getParams();
        const h = routes[path] || routes['/login'];

        const app = document.getElementById('app');
        if (app) {
            if (currentNavTimeout) clearTimeout(currentNavTimeout);

            if (window.__storeDataLoaded) {
                // Navegação in-app: usa barra de progresso no topo (sem flash de tela branca)
                showPageLoader();
                currentNavTimeout = setTimeout(async () => {
                    if (h) await h(params);
                    updateSidebar();
                    hidePageLoader();
                    currentNavTimeout = null;
                }, 0);
            } else {
                // Cold boot (app abrindo pela primeira vez / via notificação): mantém splash
                document.body.classList.remove('app-ready');
                currentNavTimeout = setTimeout(async () => {
                    if (h) await h(params);
                    updateSidebar();
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            document.body.classList.add('app-ready');
                            currentNavTimeout = null;
                        }, 50);
                    });
                }, 300);
            }
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

