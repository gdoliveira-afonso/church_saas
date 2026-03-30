import { store } from '../store.js';

// ── Theme ──
export function isDark() { return document.documentElement.classList.contains('dark'); }
export function toggleTheme() {
  const html = document.documentElement;
  html.classList.toggle('dark');
  localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
  // Update all theme toggle icons
  document.querySelectorAll('.theme-icon').forEach(el => { el.textContent = isDark() ? 'light_mode' : 'dark_mode'; });
}

// ── Toast ──
export function toast(msg, type = 'success') {
  const c = document.getElementById('toast-container'), t = document.createElement('div');
  const bg = { success: 'bg-emerald-600', error: 'bg-red-600', warning: 'bg-amber-500', info: 'bg-primary' };
  t.className = `toast ${bg[type] || bg.info} text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium mb-2`;
  t.textContent = msg; c.appendChild(t); setTimeout(() => t.remove(), 3000);
}

// ── Modal ──
export function openModal(html) {
  const o = document.getElementById('modal-overlay'), c = document.getElementById('modal-content');
  c.innerHTML = html; o.classList.remove('hidden');
  const close = e => { if (e.target === o) closeModal() };
  o.addEventListener('click', close);
  o._close = close;
}
export function closeModal() {
  const o = document.getElementById('modal-overlay');
  o.classList.add('hidden');
  if (o._close) o.removeEventListener('click', o._close);
}
window.openModal = openModal;
window.closeModal = closeModal;

// ── Sidebar ──
export function updateSidebar(active) {
  const sb = document.getElementById('sidebar');
  const s = document.getElementById('sidebar-links'), u = document.getElementById('sidebar-user');

  if (!sb) return;

  // Centralized visibility logic
  const currentHash = (location.hash || '').replace('#', '').split('?')[0];
  const isPublicRoute = currentHash === '/login' || currentHash === '/admin' || currentHash === '' || currentHash === '/f' || currentHash === '/form/public' || currentHash.startsWith('/f?') || currentHash.startsWith('/form/public?');

  if (!store.currentUser || isPublicRoute) {
    sb.classList.add('sidebar-hidden');
    return;
  } else {
    sb.classList.remove('sidebar-hidden');
  }

  if (!s) return;
  const cellsEnabled = store.systemSettings?.cellsEnabled !== false;
  const tabs = [
    { id: 'home',          icon: 'dashboard',      label: 'Dashboard',        route: '/dashboard',    roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER'] },
    { id: 'people',        icon: 'group',           label: 'Pessoas',          route: '/people',       roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER'] },
    { id: 'add-person',    icon: 'person_add',      label: 'Cadastrar Membro', route: '/people/new',   roles: ['ADMIN', 'SUPERVISOR'] },
    { id: 'cells',         icon: 'diversity_3',     label: 'Células',          route: '/cells',        roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER'], cellModule: true },
    { id: 'calendar',      icon: 'calendar_month',  label: 'Calendário',       route: '/calendar',     roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'USER'] },
    { id: 'reports',       icon: 'pie_chart',       label: 'Relatórios',       route: '/reports',      roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO'] },
    { id: 'forms',         icon: 'description',     label: 'Formulários',      route: '/forms',        roles: ['ADMIN'] },
    { id: 'triage',        icon: 'assignment',      label: 'Triagem',          route: '/triage',       roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO'] },
    { id: 'generations',   icon: 'groups',          label: 'Gerações',         route: '/generations',  roles: ['ADMIN', 'SUPERVISOR'], cellModule: true },
    { id: 'ebd',           icon: 'menu_book',       label: 'EBD',              route: '/ebd',          roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'USER'], ebdModule: true },
    { id: 'ebd-reports',   icon: 'pie_chart',       label: 'Relatórios EBD',   route: '/ebd/reports',  roles: ['ADMIN', 'SUPERVISOR', 'USER'], ebdModule: true, ebdAdminOnly: true },
    { id: 'finance',       icon: 'account_balance_wallet', label: 'Financeiro', route: '/finance',      roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'USER'], financeModule: true },
    { id: 'organizations', icon: 'corporate_fare',  label: 'Igrejas SaaS',     route: '/organizations',roles: ['SUPERADMIN'] },
    { id: 'settings',      icon: 'settings',        label: 'Configurações',    route: '/settings',     roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'SUPERADMIN', 'USER'] },
  ].filter(t => t.roles.includes(store.currentUser.role) && (!t.cellModule || cellsEnabled) && (!t.ebdModule || store.systemSettings?.ebdEnabled !== false) && (!t.ebdAdminOnly || store.hasRole('ADMIN', 'SUPERVISOR') || store.hasSecondaryRole('SUPERINTENDENTE_EBD')) && (!t.financeModule || (store.systemSettings?.financialEnabled && (store.hasRole('ADMIN','SUPERADMIN') || store.hasSecondaryRole('AGENTE_FINANCEIRO','GESTOR_FINANCEIRO')))));
  // Auto-detect active from hash if not explicitly set
  if (!active) {
    const hash = (location.hash || '').replace('#', '').split('?')[0];
    const aliases = { '/form-builder': 'forms', '/people/edit': 'people' };
    if (aliases[hash]) { active = aliases[hash]; }
    else {
      // Sort by route length descending so more specific routes match first (e.g. /people/new before /people)
      const sorted = [...tabs].sort((a, b) => b.route.length - a.route.length);
      const match = sorted.find(t => hash === t.route) || sorted.find(t => hash.startsWith(t.route + '/') || (t.route !== '/' && hash.startsWith(t.route)));
      active = match?.id || '';
    }
  }
  s.innerHTML = tabs.map(t => `
    <a href="#${t.route}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${active === t.id ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}">
      <span class="material-symbols-outlined text-[20px] ${active === t.id ? 'filled' : ''}">${t.icon}</span>${t.label}
    </a>`).join('');
  if (u) {
    const themeIcon = isDark() ? 'light_mode' : 'dark_mode';
    u.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">${store.currentUser.name.charAt(0)}</div>
      <div class="flex-1 min-w-0"><p class="text-xs font-semibold truncate">${store.currentUser.name}</p><p class="text-[10px] text-slate-400 truncate">${store.currentUser.username}</p></div>
      <button id="sidebar-theme" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Alternar tema"><span class="material-symbols-outlined theme-icon text-[18px]">${themeIcon}</span></button>
      <button id="sidebar-logout" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Sair"><span class="material-symbols-outlined text-[18px]">logout</span></button>
    </div>`;
    document.getElementById('sidebar-theme')?.addEventListener('click', toggleTheme);
    document.getElementById('sidebar-logout')?.addEventListener('click', () => {
      store.logout(); document.getElementById('sidebar').classList.add('sidebar-hidden');
      toast('Deslogado com sucesso'); window.location.hash = '/login';
    });
  }
}

// ── Bottom Nav (mobile only) ──
export function bottomNav(active) {
  updateSidebar(active);

  const isSuperadmin = store.currentUser?.role === 'SUPERADMIN';
  const cellsEnabled = store.systemSettings?.cellsEnabled !== false;

  const allTabs = isSuperadmin ? [
    { id: 'organizations', icon: 'corporate_fare', label: 'Igrejas',  route: '/organizations' },
    { id: 'settings',      icon: 'settings',       label: 'Config',   route: '/settings' },
  ] : [
    { id: 'home',        icon: 'dashboard',              label: 'Início',     route: '/dashboard',    roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER'] },
    { id: 'people',      icon: 'group',                  label: 'Pessoas',    route: '/people',       roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER'] },
    { id: 'cells',       icon: 'diversity_3',            label: 'Células',    route: '/cells',        roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER'], cellModule: true },
    { id: 'calendar',    icon: 'calendar_month',         label: 'Agenda',     route: '/calendar',     roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'USER'] },
    { id: 'ebd',         icon: 'menu_book',              label: 'EBD',        route: '/ebd',          roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'USER'], ebdModule: true },
    { id: 'finance',     icon: 'account_balance_wallet', label: 'Financeiro', route: '/finance',      roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'USER'], financeModule: true },
    { id: 'reports',     icon: 'pie_chart',              label: 'Relatórios', route: '/reports',      roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO'] },
    { id: 'generations', icon: 'groups',                 label: 'Gerações',   route: '/generations',  roles: ['ADMIN', 'SUPERVISOR'], cellModule: true },
    { id: 'ebd-reports', icon: 'pie_chart',              label: 'Rel. EBD',   route: '/ebd/reports',  roles: ['ADMIN', 'SUPERVISOR', 'USER'], ebdModule: true, ebdAdminOnly: true },
    { id: 'settings',    icon: 'settings',               label: 'Config',     route: '/settings',     roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'USER'] },
  ].filter(t =>
    (!t.roles || t.roles.includes(store.currentUser?.role)) &&
    (!t.cellModule || cellsEnabled) &&
    (!t.ebdModule || store.systemSettings?.ebdEnabled !== false) &&
    (!t.ebdAdminOnly || store.hasRole('ADMIN', 'SUPERVISOR') || store.hasSecondaryRole('SUPERINTENDENTE_EBD')) &&
    (!t.financeModule || (store.systemSettings?.financialEnabled && (store.hasRole('ADMIN', 'SUPERADMIN') || store.hasSecondaryRole('AGENTE_FINANCEIRO', 'GESTOR_FINANCEIRO'))))
  );

  const MAX_VISIBLE = 5;
  const hasMore = allTabs.length > MAX_VISIBLE;
  // Settings always at end of visible — reserve last slot for it when "Mais" needed
  let visibleTabs, moreTabs;
  if (hasMore) {
    // Pick first (MAX_VISIBLE - 1) items + put "Mais" in the last slot
    // Items after index (MAX_VISIBLE - 2) that aren't Settings go into the drawer
    const settingsTab = allTabs.find(t => t.id === 'settings');
    const otherTabs = allTabs.filter(t => t.id !== 'settings');
    visibleTabs = otherTabs.slice(0, MAX_VISIBLE - 1);
    moreTabs = [...otherTabs.slice(MAX_VISIBLE - 1), ...(settingsTab ? [settingsTab] : [])];
  } else {
    visibleTabs = allTabs;
    moreTabs = [];
  }

  const navItemHtml = (t) => `
    <a href="#${t.route}" class="flex flex-col items-center gap-0.5 min-w-[50px] flex-1 pt-1 mb-1 transition-all ${active === t.id ? 'text-primary scale-105' : 'text-slate-400 hover:text-slate-600'}">
      <span class="material-symbols-outlined text-[20px] sm:text-[22px] ${active === t.id ? 'filled font-bold' : ''}">${t.icon}</span>
      <span class="text-[9px] sm:text-[10px] font-medium tracking-tight truncate w-full text-center px-0.5">${t.label}</span>
    </a>`;

  const moreButtonHtml = hasMore ? `
    <button id="bottom-nav-more-btn" class="flex flex-col items-center gap-0.5 min-w-[50px] flex-1 pt-1 mb-1 transition-all text-slate-400 hover:text-slate-600" aria-label="Mais opções">
      <span class="material-symbols-outlined text-[20px] sm:text-[22px]">more_horiz</span>
      <span class="text-[9px] sm:text-[10px] font-medium tracking-tight">Mais</span>
    </button>` : '';

  // Drawer HTML (injected once into body on first open)
  const drawerHtml = hasMore ? `
    <div id="bottom-nav-overlay" class="fixed inset-0 bg-black/50 z-40 opacity-0 transition-opacity duration-200" style="pointer-events:none;" aria-hidden="true"></div>
    <div id="bottom-nav-drawer" class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#162035] rounded-t-2xl shadow-2xl transform translate-y-full transition-transform duration-300 ease-out" role="dialog" aria-modal="true" aria-label="Mais opções de navegação">
      <div class="flex justify-center pt-3 pb-1">
        <div class="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
      </div>
      <div class="px-4 pb-2 pt-1">
        <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Mais opções</p>
        <div class="grid grid-cols-3 gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          ${moreTabs.map(t => `
          <a href="#${t.route}" data-drawer-link class="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${active === t.id ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}">
            <span class="material-symbols-outlined text-[24px] ${active === t.id ? 'filled' : ''}">${t.icon}</span>
            <span class="text-[10px] font-medium text-center leading-tight">${t.label}</span>
          </a>`).join('')}
        </div>
      </div>
    </div>` : '';

  // Schedule drawer setup after render
  if (hasMore) {
    requestAnimationFrame(() => {
      // Remove any stale drawer from previous renders
      document.getElementById('bottom-nav-overlay')?.remove();
      document.getElementById('bottom-nav-drawer')?.remove();

      // Inject fresh drawer into body
      const tmp = document.createElement('div');
      tmp.innerHTML = drawerHtml;
      while (tmp.firstChild) document.body.appendChild(tmp.firstChild);

      const overlay = document.getElementById('bottom-nav-overlay');
      const drawer = document.getElementById('bottom-nav-drawer');
      const moreBtn = document.getElementById('bottom-nav-more-btn');

      function openDrawer() {
        overlay.style.pointerEvents = 'auto';
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
        drawer.classList.remove('translate-y-full');
        drawer.classList.add('translate-y-0');
        moreBtn?.classList.add('text-primary');
        moreBtn?.classList.remove('text-slate-400');
      }

      function closeDrawer() {
        overlay.style.pointerEvents = 'none';
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
        drawer.classList.add('translate-y-full');
        drawer.classList.remove('translate-y-0');
        moreBtn?.classList.remove('text-primary');
        moreBtn?.classList.add('text-slate-400');
      }

      moreBtn?.addEventListener('click', openDrawer);
      overlay?.addEventListener('click', closeDrawer);
      drawer?.querySelectorAll('[data-drawer-link]').forEach(link => {
        link.addEventListener('click', () => { closeDrawer(); });
      });

      // Close drawer on hash change (route navigation)
      const onHashChange = () => closeDrawer();
      window.addEventListener('hashchange', onHashChange, { once: true });
    });
  }

  return `<nav class="mobile-nav fixed bottom-0 left-0 right-0 w-full md:hidden z-50 bg-white dark:bg-[#162035] border-t border-slate-100 dark:border-white/[0.07] px-1">
    <div class="flex items-center justify-around gap-1 h-14">
      ${visibleTabs.map(navItemHtml).join('')}
      ${moreButtonHtml}
    </div>
  </nav>
  <style>
    .bottom-nav-drawer-open { overflow: hidden; }
  </style>`;
}

// ── Header & Notifications ──
// Retorna a faixa de impersonação se houver um token
export function impersonationBanner() {
  const isImpersonating = sessionStorage.getItem('crm_token_impersonated');
  if (!isImpersonating || location.hash === '#/organizations') return '';

  return `
    <div class="bg-amber-500 text-white px-4 py-1.5 text-[11px] font-bold flex items-center justify-center gap-2 sticky top-0 z-30 shadow-md">
      <span class="material-symbols-outlined text-sm">visibility</span> 
      MODO VISUALIZAÇÃO: Você está acessando como <b>${store.currentUser.name}</b>
      <button onclick="window.__stopImpersonating()" class="ml-2 px-2 py-0.5 bg-white text-amber-600 rounded hover:bg-opacity-90 transition-all uppercase tracking-tighter">Sair e Voltar ao Painel</button>
    </div>
  `;
}



export function header(title, back = false, right = '') {
  const notifs = store.getNotifications() || [];
  const unreadCount = notifs.length;

  return `
  ${impersonationBanner()}
  <header class="sticky top-0 z-40 flex items-center justify-between bg-white/95 dark:bg-slate-900/95 md:bg-white md:dark:bg-slate-900 backdrop-blur-md px-4 md:px-6 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] border-b border-slate-100 dark:border-slate-800 shrink-0 transition-colors duration-300">
    <div class="flex items-center w-24">
      ${back ? `<button onclick="history.back()" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 -ml-1"><span class="material-symbols-outlined text-xl">arrow_back</span></button>` : ''}
    </div>
    
    <div class="flex-1 flex justify-center min-w-0">
      <h2 class="text-base font-bold text-slate-900 dark:text-white md:text-lg truncate">${title}</h2>
    </div>
 
    <div class="flex items-center justify-end gap-3 w-24">
      <div class="relative">
        <button id="notif-btn" onclick="window.__toggleNotifications(this)" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-lg">notifications</span>
          ${unreadCount > 0 ? `<span class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>` : ''}
        </button>
      </div>
      <button onclick="window.__toggleTheme?.()" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-500 transition-colors"><span class="material-symbols-outlined theme-icon text-lg">${isDark() ? 'light_mode' : 'dark_mode'}</span></button>
      ${right || ''}
    </div>
  </header>`;
}

window.__globalLogout = () => {
  store.logout();
  toast('Deslogado com sucesso');
};

window.__stopImpersonating = () => {
  const originalToken = sessionStorage.getItem('crm_token_impersonated');
  const originalUser = sessionStorage.getItem('crm_user_impersonated');
  
  if (originalToken && originalUser) {
    localStorage.setItem('crm_token', originalToken);
    localStorage.setItem('crm_user', originalUser);
    sessionStorage.removeItem('crm_token_impersonated');
    sessionStorage.removeItem('crm_user_impersonated');
    
    toast('Voltando ao seu usuário original...');
    window.location.hash = '/organizations';
    setTimeout(() => {
      window.location.reload();
    }, 500);
  } else {
    store.logout();
  }
};

window.addEventListener('store-data-loaded', () => {
  const notifs = store.getNotifications() || [];
  const unreadCount = notifs.length;
  const btn = document.getElementById('notif-btn');
  if (btn) {
    const existingBadge = btn.querySelector('.bg-red-500');
    if (unreadCount > 0 && !existingBadge) {
      btn.innerHTML += `<span class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>`;
    } else if (unreadCount === 0 && existingBadge) {
      existingBadge.remove();
    }
  }
});

window.__toggleNotifications = (btn) => {
  let pop = document.getElementById('notif-popover');
  if (pop) { pop.remove(); return; }

  const notifs = store.getNotifications() || [];
  pop = document.createElement('div');
  pop.id = 'notif-popover';
  pop.className = 'absolute top-14 right-4 md:right-6 w-80 max-h-[400px] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 flex flex-col overflow-hidden';

  const headerHtml = `<div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
    <div class="flex items-center gap-2">
      <h3 class="text-sm font-bold dark:text-white">Notificações</h3>
      <span class="text-xs font-semibold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">${notifs.length}</span>
    </div>
    ${notifs.length ? `<button onclick="window.__markAllNotifsRead()" class="text-[11px] font-semibold text-primary hover:text-blue-700 transition">Limpar tudo</button>` : ''}
  </div>`;

  const listHtml = notifs.length ? `<div class="overflow-y-auto flex-1 p-2 space-y-1">
    ${notifs.map(n => `
    <div class="relative group">
      <a href="${n.action}" onclick="document.getElementById('notif-popover').remove()" class="flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition pr-8">
        <div class="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5"><span class="material-symbols-outlined text-[16px]">info</span></div>
        <div class="flex-1 min-w-0"><p class="text-[13px] font-bold text-slate-900 dark:text-white mb-0.5">${n.title}</p><p class="text-[11px] text-slate-500 dark:text-slate-400 leading-snug break-words">${n.message}</p></div>
      </a>
    </div>`).join('')}
  </div>` : `<div class="p-8 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center"><span class="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_paused</span><p class="text-sm">Nenhuma notificação por enquanto</p></div>`;

  pop.innerHTML = headerHtml + listHtml;
  document.body.appendChild(pop);

  // Close when clicking outside
  setTimeout(() => {
    const clsi = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) { pop.remove(); document.removeEventListener('click', clsi); } };
    document.addEventListener('click', clsi);
  }, 10);
};

window.__markAllNotifsRead = () => {
  store.markAllNotifsRead();
  document.getElementById('notif-popover')?.remove();
  document.querySelectorAll('.material-symbols-outlined').forEach(el => {
    if (el.textContent === 'notifications') {
      const btn = el.closest('button');
      if (btn) { const badge = btn.querySelector('.bg-red-500'); if (badge) badge.remove(); }
    }
  });
};

window.__markNotifRead = (id, btn, e) => {
  e.stopPropagation(); e.preventDefault();
  store.markNotifRead(id);
  const item = btn.closest('.relative.group');
  if (item) item.remove();
  const notifs = store.getNotifications() || [];
  const countBadge = document.querySelector('#notif-popover h3 + span');
  if (countBadge) countBadge.textContent = notifs.length;

  if (notifs.length === 0) {
    document.getElementById('notif-popover')?.remove();
    document.querySelectorAll('.material-symbols-outlined').forEach(el => {
      if (el.textContent === 'notifications') {
        const b = el.closest('button');
        if (b) { const badge = b.querySelector('.bg-red-500'); if (badge) badge.remove(); }
      }
    });
  }
};
// Expose toggleTheme globally for inline onclick in header
window.__toggleTheme = toggleTheme;

// ── Shared UI helpers ──
export function avatar(name, sz = 'h-10 w-10') {
  const c = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-emerald-100 text-emerald-700', 'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700'];
  const ini = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `<div class="flex ${sz} items-center justify-center rounded-full ${c[name.charCodeAt(0) % c.length]} font-bold text-sm shrink-0">${ini}</div>`;
}

const SR_LABEL = { PROFESSOR: 'Prof. EBD', SEGUNDO_PROFESSOR: '2º Prof. EBD', SUPERINTENDENTE_EBD: 'Sup. EBD', AGENTE_FINANCEIRO: 'Ag. Financeiro', GESTOR_FINANCEIRO: 'Gestor Financeiro' };

export function secondaryRoleBadges(user) {
  if (!user || !user.secondaryRoles) return '';
  let roles = user.secondaryRoles;
  if (typeof roles === 'string') { try { roles = JSON.parse(roles || '[]'); } catch { roles = []; } }
  if (!Array.isArray(roles) || !roles.length) return '';
  return roles.map(r => SR_LABEL[r] ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-600/10 dark:bg-purple-900/40 dark:text-purple-300 dark:ring-purple-500/30">${SR_LABEL[r]}</span>` : '').join('');
}

export function badge(text, color = 'blue') {
  const m = { 
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/10 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-500/30', 
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-500/30', 
    red: 'bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-500/30', 
    yellow: 'bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-500/30', 
    purple: 'bg-purple-50 text-purple-700 ring-purple-600/10 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-500/30', 
    orange: 'bg-orange-50 text-orange-700 ring-orange-600/10 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-500/30', 
    slate: 'bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700', 
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/10 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-500/30' 
  };
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1 ring-inset ${m[color] || m.blue}">${text}</span>`;
}

export function donut(pct, color = 'text-primary', sz = 80) {
  return `<div class="relative" style="width:${sz}px;height:${sz}px">
    <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" class="text-slate-200 dark:text-slate-800" stroke-width="3"/>
      <circle class="${color}" cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="${pct} 100" stroke-linecap="round"/>
    </svg>
    <div class="absolute inset-0 flex items-center justify-center"><span class="text-sm font-bold">${pct}%</span></div>
  </div>`;
}

export function statusColor(s) { return { ['Novo Convertido']: 'indigo', Membro: 'green', 'Reconciliação': 'purple', 'Visitante': 'blue', 'Inativo': 'gray', 'Afastado': 'orange', 'Mudou-se': 'slate' }[s] || 'slate' }
export function riskDot(l) { const c = { low: 'bg-emerald-500', medium: 'bg-amber-400', high: 'bg-red-500' }; return `<span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 ${c[l] || c.low} border-2 border-white rounded-full"></span>` }

// ── Card wrapper for desktop bg ──
export function pageWrap(content, nav) {
  return `<div class="flex-1 overflow-y-auto md:p-6 md:bg-slate-50 dark:md:bg-slate-900">${content}</div>${nav}`;
}
