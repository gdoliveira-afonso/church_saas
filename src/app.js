import { store } from './store.js';
import { route, startRouter, navigate } from './router.js';
import { isNativeApp, setupNativeUI } from './native/index.js';
import { setupForegroundListener } from './native/push.js';
import { toast } from './components/ui.js';
import { getServerUrl } from './native/server-config.js';
import { serverSetupView } from './views/server-setup.js';
import { loginView } from './views/login.js';
import { errorPageView } from './views/error-page.js';
import { dashboardView } from './views/dashboard.js';
import { peopleView, personFormView } from './views/people.js';
import { profileView } from './views/profile.js';
import { cellsView, cellDetailView } from './views/cells.js';
import { attendanceView } from './views/attendance.js';
import { reportsView } from './views/reports.js';
import { settingsView, triageView } from './views/settings.js';
import { publicFormView } from './views/public-form.js';
import { formListView, formBuilderView } from './views/form-builder.js';
import { calendarView } from './views/calendar.js';
import { generationsView } from './views/generations.js';
import { apiKeysView } from './views/api-keys.js';
import { webhooksView } from './views/webhooks.js';
import { apiDocsView } from './views/api-docs.js';
import { organizationsView } from './views/organizations.js';
import { ebdView } from './views/ebd.js';
import { ebdClassView } from './views/ebd-class.js';
import { ebdReportsView } from './views/ebd-reports.js';
import { financeDashboardView } from './views/finance-dashboard.js';
import { financeAccountsView } from './views/finance-accounts.js';
import { financeTransactionsView } from './views/finance-transactions.js';
import { financeDonationsView } from './views/finance-donations.js';
import { financeBillsView } from './views/finance-bills.js';
import { financeFundsView } from './views/finance-funds.js';
import { financeReportsView } from './views/finance-reports.js';
import { financeBiView } from './views/finance-bi.js';
import { financeChartView } from './views/finance-chart.js';

function restoreTheme() { const t = localStorage.getItem('theme'); if (t === 'dark') { document.documentElement.classList.add('dark'); } }

function guard(fn) {
    return async (p) => {
        if (!store.isLoggedIn()) { navigate('/login'); return; }
        restoreTheme(); await fn(p);
    };
}

function roleGuard(roles, fn) {
    return async (p) => {
        if (!store.isLoggedIn()) { navigate('/login'); return; }
        if (!store.hasRole(...roles)) { navigate('/dashboard'); return; }
        restoreTheme(); await fn(p);
    };
}

/**
 * Factory para módulos opcionais e/ou guards por role+secondaryRole.
 * @param {{ module?: string, strictModule?: boolean, roles?: string[], secondaryRoles?: string[], redirect?: string }} opts
 *   module       — chave em systemSettings (ex: 'cellsEnabled')
 *   strictModule — true: bloqueia se !val (finance); false: bloqueia só se val===false (cells)
 *   roles        — roles primárias permitidas (OR com secondaryRoles)
 *   secondaryRoles — secondaryRoles permitidas
 *   redirect     — destino quando acesso negado (default: '/dashboard')
 */
function moduleGuard({ module, strictModule = false, roles, secondaryRoles, redirect = '/dashboard' } = {}, fn) {
    return async (p) => {
        if (!store.isLoggedIn()) { navigate('/login'); return; }
        if (module) {
            const val = store.systemSettings?.[module];
            if (strictModule ? !val : val === false) { navigate(redirect); return; }
        }
        if (roles || secondaryRoles) {
            const ok = (roles && store.hasRole(...roles)) || (secondaryRoles && store.hasSecondaryRole(...secondaryRoles));
            if (!ok) { navigate(redirect); return; }
        }
        restoreTheme(); await fn(p);
    };
}

const cellGuard      = (fn) => moduleGuard({ module: 'cellsEnabled' }, fn);
const cellAdminGuard = (fn) => moduleGuard({ module: 'cellsEnabled', roles: ['ADMIN', 'SUPERVISOR'] }, fn);
const ebdAdminGuard  = (fn) => moduleGuard({ roles: ['ADMIN', 'SUPERVISOR'], secondaryRoles: ['SUPERINTENDENTE_EBD'], redirect: '/ebd' }, fn);
const financeGuard   = (fn) => moduleGuard({ module: 'financialEnabled', strictModule: true, roles: ['ADMIN', 'SUPERADMIN'], secondaryRoles: ['AGENTE_FINANCEIRO', 'GESTOR_FINANCEIRO'] }, fn);

// Rota de painel superadmin — acessível sem login (mostra tela de login admin-context)
// SUPERADMIN já logado → redireciona para /organizations
// Outro role logado → redireciona para /dashboard
async function adminRouteView() {
    if (store.isLoggedIn()) {
        navigate(store.currentUser?.role === 'SUPERADMIN' ? '/organizations' : '/dashboard');
        return;
    }
    // Garante que domainStatus é admin-context para o loginView renderizar o visual correto
    store.domainStatus = 'admin-context';
    await loginView();
}

route('/login', loginView);
route('/admin', adminRouteView);
route('/form/public', publicFormView);
route('/f', publicFormView);
route('/dashboard', guard(async (p) => {
    if (store.hasRole('SUPERADMIN')) { navigate('/organizations'); return; }
    if (store.hasRole('USER')) { navigate('/ebd'); return; }
    if (!store.hasRole('ADMIN','SUPERVISOR','LIDER_GERACAO','LEADER','VICE_LEADER') && store.hasSecondaryRole('AGENTE_FINANCEIRO','GESTOR_FINANCEIRO') && store.systemSettings?.financialEnabled) { navigate('/finance'); return; }
    await dashboardView(p);
}));
route('/people', guard(peopleView));
route('/people/new', roleGuard(['ADMIN', 'SUPERVISOR'], () => personFormView({ id: 'new' })));
route('/people/edit', roleGuard(['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER'], personFormView));
route('/profile', guard(profileView));
route('/cells', cellGuard(cellsView));
route('/cell', cellGuard(cellDetailView));
route('/attendance', cellGuard(attendanceView));
route('/reports', roleGuard(['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO'], reportsView));
route('/settings', roleGuard(['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'SUPERADMIN', 'USER'], settingsView));
route('/forms', roleGuard(['ADMIN', 'SUPERVISOR'], formListView));
route('/form-builder', roleGuard(['ADMIN', 'SUPERVISOR'], formBuilderView));
route('/triage', roleGuard(['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'SUPERADMIN'], triageView));
route('/generations', cellAdminGuard(generationsView));
route('/calendar', guard(calendarView));
route('/api-keys', roleGuard(['ADMIN'], apiKeysView));
route('/webhooks', roleGuard(['ADMIN'], webhooksView));
route('/api-docs', guard(apiDocsView));
route('/organizations', roleGuard(['SUPERADMIN'], organizationsView));
route('/ebd', guard(ebdView));
route('/ebd/class', guard(ebdClassView));
route('/ebd/reports', ebdAdminGuard(ebdReportsView));
route('/finance', financeGuard(financeDashboardView));
route('/finance/chart', financeGuard(financeChartView));
route('/finance/accounts', financeGuard(financeAccountsView));
route('/finance/transactions', financeGuard(financeTransactionsView));
route('/finance/donations', financeGuard(financeDonationsView));
route('/finance/bills', financeGuard(financeBillsView));
route('/finance/funds', financeGuard(financeFundsView));
route('/finance/reports', financeGuard(financeReportsView));
route('/finance/bi', financeGuard(financeBiView));

window.addEventListener('system-settings-loaded', () => {
    const s = store.systemSettings;
    if (!s) return;

    // Sidebar update
    const titleEl = document.querySelector('#sidebar p.text-sm.font-bold');
    if (titleEl && s.appName) titleEl.textContent = s.appName;

    const logoContainer = document.getElementById('brand-logo-container');
    if (logoContainer && s.logoUrl) {
        logoContainer.innerHTML = `<img src="${store.resolveUrl(s.logoUrl)}" alt="${s.appName || 'Logo'}" class="max-h-full max-w-full object-contain" />`;
        logoContainer.classList.remove('bg-primary/10', 'text-primary');
    }
});

// Exibe toast quando push notification chega com app em primeiro plano
window.addEventListener('push-notification', (e) => {
    const { title, body } = e.detail || {};
    if (title || body) toast(`${title}${body ? ': ' + body : ''}`, 'info');
});

// Boot: modo nativo verifica URL do servidor antes de iniciar o router
async function boot() {
    // Configura StatusBar e safe area antes de qualquer renderização
    await setupNativeUI();

    // Configura listener de notificações em primeiro plano (silencioso se não for nativo)
    setupForegroundListener().catch(() => {});

    // Se já estamos em um domínio real (via server.url do Capacitor), inicia diretamente.
    // A tela de configuração só é necessária no modo bundle local (localhost).
    const runningAtRealDomain = window.location.hostname !== 'localhost';

    if (isNativeApp() && !runningAtRealDomain) {
        const serverUrl = await getServerUrl();
        if (!serverUrl) {
            // Primeira abertura: mostra tela de configuração do servidor
            serverSetupView({
                onSuccess: async (url) => {
                    store.apiBase = url + '/api';
                    await store.initSaaS();
                    startRouter();
                }
            });
            // Remove splash screen para mostrar a tela de setup
            document.body.classList.add('app-ready');
            return;
        }
        // URL já configurada: store já definiu apiBase no constructor, inicia normalmente
    }

    // Aguarda resolução de org + domainStatus antes de iniciar o router.
    // Mostra spinner enquanto aguarda para não ficar em branco.
    if (store._saasReady) {
        const app = document.getElementById('app');
        if (app && !app.children.length) {
            app.innerHTML = '<div class="flex-1 flex items-center justify-center h-full w-full bg-slate-50"><span class="material-symbols-outlined animate-spin text-slate-400 text-3xl">refresh</span></div>';
        }
        await store._saasReady;
    }

    // Domínios bloqueados ou desconhecidos: exibe tela de erro e não inicia o router
    const ds = store.domainStatus;
    if (ds === 'ip-blocked' || ds === 'domain-unknown' || ds === 'inactive') {
        errorPageView(ds);
        document.body.classList.add('app-ready');
        return;
    }

    startRouter();
}

boot();

// Registro do Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.warn('SW registration failed:', err);
        });
    });
}
// Função global que remove a Splash Screen de forma segura
window.__removeSplashScreen = function () {
    if (!document.body.classList.contains('app-ready')) {
        document.body.classList.add('app-ready');
    }
};

window.addEventListener('store-data-loaded', () => {
    // Apenas dispara hashchange se NÃO estiver na tela de login
    // Isso evita o "pisca" durante o fluxo de login manual
    const isLoginPage = !window.location.hash || window.location.hash === '#/login';
    if (!isLoginPage) {
        window.dispatchEvent(new Event('hashchange'));
    }

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(window.__removeSplashScreen);
    } else {
        setTimeout(window.__removeSplashScreen, 300);
    }
}, { once: true });



