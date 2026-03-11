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
  const isPublicRoute = currentHash === '/login' || currentHash === '' || currentHash === '/f' || currentHash === '/form/public' || currentHash.startsWith('/f?') || currentHash.startsWith('/form/public?');

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
    { id: 'calendar',      icon: 'calendar_month',  label: 'Calendário',       route: '/calendar',     roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER'] },
    { id: 'reports',       icon: 'pie_chart',       label: 'Relatórios',       route: '/reports',      roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO'] },
    { id: 'forms',         icon: 'description',     label: 'Formulários',      route: '/forms',        roles: ['ADMIN'] },
    { id: 'triage',        icon: 'assignment',      label: 'Triagem',          route: '/triage',       roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO'] },
    { id: 'generations',   icon: 'groups',          label: 'Gerações',         route: '/generations',  roles: ['ADMIN', 'SUPERVISOR'], cellModule: true },
    { id: 'ebd',           icon: 'menu_book',       label: 'EBD',              route: '/ebd',          roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'USER'], ebdModule: true },
    { id: 'organizations', icon: 'corporate_fare',  label: 'Igrejas SaaS',     route: '/organizations',roles: ['SUPERADMIN'] },
    { id: 'settings',      icon: 'settings',        label: 'Configurações',    route: '/settings',     roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'SUPERADMIN'] },
  ].filter(t => t.roles.includes(store.currentUser.role) && (!t.cellModule || cellsEnabled) && (!t.ebdModule || store.systemSettings?.ebdEnabled !== false));
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

  const tabs = isSuperadmin ? [
    { id: 'organizations', icon: 'corporate_fare', label: 'Igrejas',  route: '/organizations' },
    { id: 'settings',      icon: 'settings',       label: 'Config',   route: '/settings' },
  ] : [
    { id: 'home',        icon: 'dashboard',     label: 'Início',     route: '/dashboard' },
    { id: 'people',      icon: 'group',         label: 'Pessoas',    route: '/people' },
    { id: 'cells',       icon: 'diversity_3',   label: 'Células',    route: '/cells',       cellModule: true },
    { id: 'calendar',    icon: 'calendar_month',label: 'Agenda',     route: '/calendar' },
    { id: 'reports',     icon: 'pie_chart',     label: 'Relatórios', route: '/reports',     roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO'] },
    { id: 'generations', icon: 'groups',        label: 'Gerações',   route: '/generations', roles: ['ADMIN', 'SUPERVISOR'], cellModule: true },
    { id: 'ebd',         icon: 'menu_book',     label: 'EBD',        route: '/ebd',         roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER', 'USER'], ebdModule: true },
    { id: 'settings',    icon: 'settings',      label: 'Config',     route: '/settings',    roles: ['ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER'] },
  ].filter(t => (!t.roles || t.roles.includes(store.currentUser?.role)) && (!t.cellModule || cellsEnabled) && (!t.ebdModule || store.systemSettings?.ebdEnabled !== false));

  return `<nav class="mobile-nav w-full shrink-0 md:hidden z-20 bg-white border-t border-slate-200 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-1">
    <div class="flex items-center justify-between overflow-x-auto no-scrollbar gap-1 custom-scroll-hidden">${tabs.map(t => `
      <a href="#${t.route}" class="flex flex-col items-center gap-0.5 min-w-[50px] flex-1 pt-1 mb-1 transition-all ${active === t.id ? 'text-primary scale-105' : 'text-slate-400 hover:text-slate-600'}">
        <span class="material-symbols-outlined text-[20px] sm:text-[22px] ${active === t.id ? 'filled font-bold' : ''}">${t.icon}</span>
        <span class="text-[9px] sm:text-[10px] font-medium tracking-tight truncate w-full text-center px-0.5">${t.label}</span>
      </a>`).join('')}
    </div>
  </nav>
  <style>
    .custom-scroll-hidden::-webkit-scrollbar { display: none; }
    .custom-scroll-hidden { -ms-overflow-style: none; scrollbar-width: none; }
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

window.__stopImpersonating = () => {
  const token = sessionStorage.getItem('crm_token_impersonated');
  const user = sessionStorage.getItem('crm_user_impersonated');
  
  if (token && user) {
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_user', user);
    sessionStorage.clear();
    toast('Voltando ao seu usuário original...');
    setTimeout(() => {
      window.location.hash = '/organizations';
      window.location.reload();
    }, 1000);
  } else {
    // Se por algum motivo não tivermos o token original, apenas desloga por segurança
    store.logout();
  }
};

export function header(title, back = false, right = '') {
  const notifs = store.getNotifications() || [];
  const unreadCount = notifs.length;

  return `
  ${impersonationBanner()}
  <header class="sticky top-0 z-20 flex items-center justify-between bg-white/95 dark:bg-slate-900/95 md:bg-white md:dark:bg-slate-900 backdrop-blur-md px-4 md:px-6 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] border-b border-slate-100 dark:border-slate-800 shrink-0">
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
    setTimeout(() => window.location.href = '#/organizations', 500);
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

export function badge(text, color = 'blue') {
  const m = { blue: 'bg-blue-50 text-blue-700 ring-blue-600/10', green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10', red: 'bg-red-50 text-red-700 ring-red-600/10', yellow: 'bg-amber-50 text-amber-700 ring-amber-600/10', purple: 'bg-purple-50 text-purple-700 ring-purple-600/10', orange: 'bg-orange-50 text-orange-700 ring-orange-600/10', slate: 'bg-slate-100 text-slate-600 ring-slate-500/10', indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/10' };
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1 ring-inset ${m[color] || m.blue}">${text}</span>`;
}

export function donut(pct, color = 'text-primary', sz = 80) {
  return `<div class="relative" style="width:${sz}px;height:${sz}px">
    <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" stroke-width="3"/>
      <circle class="${color}" cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="${pct} 100" stroke-linecap="round"/>
    </svg>
    <div class="absolute inset-0 flex items-center justify-center"><span class="text-sm font-bold">${pct}%</span></div>
  </div>`;
}

export function statusColor(s) { return { ['Novo Convertido']: 'indigo', Membro: 'green', 'Reconciliação': 'purple', 'Visitante': 'blue', 'Inativo': 'gray', 'Afastado': 'orange', 'Mudou-se': 'slate' }[s] || 'slate' }
export function riskDot(l) { const c = { low: 'bg-emerald-500', medium: 'bg-amber-400', high: 'bg-red-500' }; return `<span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 ${c[l] || c.low} border-2 border-white rounded-full"></span>` }

// ── Card wrapper for desktop bg ──
export function pageWrap(content, nav) {
  return `<div class="flex-1 overflow-y-auto md:p-6 md:bg-slate-50">${content}</div>${nav}`;
}
