import { store } from './store.js';
import { route, startRouter, navigate } from './router.js';
import { loginView } from './views/login.js';
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

function restoreTheme() { const t = localStorage.getItem('theme'); if (t === 'dark') { document.documentElement.classList.add('dark'); } }
function guard(fn) { return async (p) => { if (!store.isLoggedIn()) { navigate('/login'); return } restoreTheme(); await fn(p) } }
function roleGuard(roles, fn) { return async (p) => { if (!store.isLoggedIn()) { navigate('/login'); return } if (!store.hasRole(...roles)) { navigate('/dashboard'); return } restoreTheme(); await fn(p) } }
function cellModuleGuard(fn) { return async (p) => { if (!store.isLoggedIn()) { navigate('/login'); return } if (store.systemSettings?.cellsEnabled === false) { navigate('/dashboard'); return } restoreTheme(); await fn(p) } }
function cellModuleRoleGuard(roles, fn) { return async (p) => { if (!store.isLoggedIn()) { navigate('/login'); return } if (!store.hasRole(...roles)) { navigate('/dashboard'); return } if (store.systemSettings?.cellsEnabled === false) { navigate('/dashboard'); return } restoreTheme(); await fn(p) } }

route('/login', loginView);
route('/form/public', publicFormView);
route('/f', publicFormView);
route('/dashboard', guard(async (p) => {
    if (store.hasRole('SUPERADMIN')) { navigate('/organizations'); return; }
    await dashboardView(p);
}));
route('/people', guard(peopleView));
route('/people/new', roleGuard(['ADMIN', 'SUPERVISOR'], () => personFormView({ id: 'new' })));
route('/people/edit', roleGuard(['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER'], personFormView));
route('/profile', guard(profileView));
route('/cells', cellModuleGuard(cellsView));
route('/cell', cellModuleGuard(cellDetailView));
route('/attendance', cellModuleGuard(attendanceView));
route('/reports', roleGuard(['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO'], reportsView));
route('/settings', roleGuard(['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'SUPERADMIN'], settingsView));
route('/forms', roleGuard(['ADMIN', 'SUPERVISOR'], formListView));
route('/form-builder', roleGuard(['ADMIN', 'SUPERVISOR'], formBuilderView));
route('/triage', roleGuard(['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'SUPERADMIN'], triageView));
route('/generations', cellModuleRoleGuard(['ADMIN', 'SUPERVISOR'], generationsView));
route('/calendar', guard(calendarView));
route('/api-keys', roleGuard(['ADMIN'], apiKeysView));
route('/webhooks', roleGuard(['ADMIN'], webhooksView));
route('/api-docs', guard(apiDocsView));
route('/organizations', roleGuard(['SUPERADMIN'], organizationsView));
route('/ebd', guard(ebdView));
route('/ebd/class', guard(ebdClassView));
route('/ebd/reports', roleGuard(['ADMIN', 'SUPERVISOR'], ebdReportsView));

window.addEventListener('system-settings-loaded', () => {
    const s = store.systemSettings;
    if (!s) return;

    // Sidebar update
    const titleEl = document.querySelector('#sidebar p.text-sm.font-bold');
    if (titleEl && s.appName) titleEl.textContent = s.appName;

    const logoContainer = document.getElementById('brand-logo-container');
    if (logoContainer && s.logoUrl) {
        logoContainer.innerHTML = `<img src="${s.logoUrl}" alt="${s.appName || 'Logo'}" class="max-h-full max-w-full object-contain" />`;
        logoContainer.classList.remove('bg-primary/10', 'text-primary');
    }
});

startRouter();

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



