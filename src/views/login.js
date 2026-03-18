import { store } from '../store.js';
import { toast } from '../components/ui.js';
import { navigate } from '../router.js';

export async function loginView() {
  if (store.isLoggedIn()) {
    const role = store.currentUser?.role;
    navigate(role === 'SUPERADMIN' ? '/organizations' : role === 'USER' ? '/ebd' : '/dashboard');
    return;
  }
  const app = document.getElementById('app');
  const sb = document.getElementById('sidebar'); if (sb) sb.classList.add('sidebar-hidden');
  document.documentElement.classList.remove('dark');

  app.innerHTML = '<div class="flex-1 overflow-y-auto flex items-center justify-center h-full w-full bg-slate-50"><span class="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>';

  // Garante que a organização foi resolvida antes de renderizar (evita race condition no app nativo)
  if (store._saasReady) await store._saasReady;

  // Fallback: se org ainda não foi resolvida (e.g. app nativo sem resolução automática), tenta buscar diretamente
  if (!store.currentOrganization?.logoUrl && store.apiBase && store.apiBase !== '/api') {
    try {
      const r = await fetch(`${store.apiBase}/public/org/by-host`);
      if (r.ok) {
        const orgData = await r.json();
        if (orgData?.logoUrl) store.currentOrganization = { ...store.currentOrganization, ...orgData };
      }
    } catch (_) { /* sem fallback */ }
  }

  let loginForms = [];
  try {
    const orgSlug = store.currentOrganization?.slug;
    const formsBase = `${store.apiBase}/public/forms`;
    const formsUrl = orgSlug ? `${formsBase}?org=${encodeURIComponent(orgSlug)}` : formsBase;
    const res = await fetch(formsUrl);
    if (res.ok) {
      loginForms = await res.json();
    }
  } catch (err) {
    console.error('Falha ao obter formulários públicos:', err);
  }

  const formButtons = loginForms.length ? `
        <div class="mt-6 pt-5 border-t border-slate-100">
          <p class="text-xs font-semibold text-slate-500 text-center mb-3">É sua primeira vez? Preencha um formulário:</p>
          <div class="space-y-2">
            ${loginForms.map(f => {
    const c = f.color || 'blue';
    const colorMap = { emerald: ['emerald-100', 'emerald-600', 'emerald-300', 'emerald-50/50', 'emerald-500'], purple: ['purple-100', 'purple-600', 'purple-300', 'purple-50/50', 'purple-500'], blue: ['blue-100', 'primary', 'primary/30', 'blue-50/50', 'primary'], orange: ['orange-100', 'orange-600', 'orange-300', 'orange-50/50', 'orange-500'], red: ['red-100', 'red-600', 'red-300', 'red-50/50', 'red-500'] };
    const cc = colorMap[c] || colorMap.blue;
    return `<a href="#/form/public?id=${f.id}" class="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-${cc[2]} hover:bg-${cc[3]} transition-all group">
              <div class="w-9 h-9 rounded-lg bg-${cc[0]} flex items-center justify-center text-${cc[1]} shrink-0"><span class="material-symbols-outlined text-lg">${f.icon || 'description'}</span></div>
              <div class="flex-1"><p class="text-sm font-semibold text-slate-900">${f.name}</p><p class="text-[11px] text-slate-400">${f.subtitle || ''}</p></div>
              <span class="material-symbols-outlined text-slate-300 group-hover:text-${cc[4]} text-lg">arrow_forward</span>
            </a>`;
  }).join('')}
          </div>
        </div>` : '';

  let isLoggingIn = false;

  const render = () => {
    const org = store.currentOrganization || {};
    const appName = org.name || 'Gestão Celular';

    // Tela de suspensão
    if (org.status === 'suspended') {
      app.innerHTML = `
      <div class="flex-1 flex items-center justify-center bg-slate-50 p-6">
        <div class="max-w-sm w-full text-center">
          <div class="w-20 h-20 rounded-3xl bg-red-100 flex items-center justify-center mx-auto mb-6">
            <span class="material-symbols-outlined text-red-500 text-4xl">block</span>
          </div>
          <h1 class="text-2xl font-black text-slate-900 mb-2">${appName}</h1>
          <div class="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
            <p class="text-sm font-bold text-red-700 mb-1">Serviços suspensos</p>
            <p class="text-xs text-red-600 leading-relaxed">
              Os serviços desta igreja foram suspensos temporariamente pelo administrador da plataforma.
              Entre em contato com o suporte para regularizar a situação.
            </p>
          </div>
          <p class="text-xs text-slate-400">Se você acredita que isso é um erro, contate o suporte técnico.</p>
        </div>
      </div>`;
      return;
    }

    const loginMsg = org.loginMessage || 'Sistema completo de SGI para gestão de membros, células e discipulado.';
    const resolvedLogoUrl = org.logoUrl ? store.resolveUrl(org.logoUrl) : null;
    const logoSrc = resolvedLogoUrl
      ? `<img src="${resolvedLogoUrl}" alt="Logo" class="max-h-full max-w-full rounded-2xl" />`
      : `<span class="material-symbols-outlined text-primary text-4xl">church</span>`;
    const logoSrcSm = resolvedLogoUrl
      ? `<img src="${resolvedLogoUrl}" alt="Logo" class="max-h-full max-w-full rounded-2xl" />`
      : `<span class="material-symbols-outlined text-primary text-3xl">church</span>`;

    app.innerHTML = `
    <div class="flex flex-col md:flex-row flex-1 h-full w-full">
      <div class="hidden md:flex md:flex-1 bg-gradient-to-br from-primary/20 via-primary/5 to-slate-50 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div class="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
        <div class="absolute bottom-0 left-0 w-72 h-72 bg-primary/5 rounded-full translate-y-1/3 -translate-x-1/4"></div>
        <div class="relative z-10 text-center">
          <div class="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-6 p-2">${logoSrc}</div>
          <h2 class="text-3xl font-extrabold text-slate-800 mb-2">${appName}</h2>
          <p class="text-slate-500 max-w-sm mx-auto">${loginMsg}</p>
          <div class="flex gap-6 mt-8 justify-center text-sm text-slate-500">
            <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-primary text-lg">groups</span>Membros</span>
            <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-primary text-lg">diversity_3</span>Células</span>
            <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-primary text-lg">pie_chart</span>Relatórios</span>
          </div>
        </div>
      </div>
      <div class="flex flex-col flex-1 w-full md:max-w-lg overflow-y-auto bg-white/50 md:bg-white no-scrollbar">
        <div class="relative w-full h-44 shrink-0 bg-gradient-to-br from-primary/30 to-primary/5 md:hidden">
          <div class="absolute inset-0 bg-gradient-to-t from-white to-transparent"></div>
          <div class="absolute -bottom-7 left-1/2 -translate-x-1/2">
              <div class="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center p-2">${logoSrcSm}</div>
          </div>
        </div>
        <div class="flex-1 flex flex-col justify-center px-8 py-8 max-w-sm mx-auto w-full shrink-0">
          <div class="text-center mb-8 mt-4 md:mt-0">
            <h1 class="text-2xl font-extrabold text-slate-900 mb-1 md:text-3xl">${appName}</h1>
            <p class="text-sm text-slate-500">Bem-vindo à ${org.congregationName || 'nossa igreja'}. Faça login para continuar.</p>
          </div>
          <form id="login-form" class="space-y-4">
            <div>
              <label class="text-xs font-semibold text-slate-600 mb-1 block">Usuário</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">person</span>
                <input id="username" type="text" placeholder="Digite seu usuário" autocomplete="username" class="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-base md:text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"/>
              </div>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-600 mb-1 block">Senha</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                <input id="password" type="password" placeholder="Digite sua senha" class="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-base md:text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"/>
                <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors" onclick="const i = document.getElementById('password'); i.type = i.type === 'password' ? 'text' : 'password'; this.firstElementChild.textContent = i.type === 'password' ? 'visibility' : 'visibility_off'"><span class="material-symbols-outlined text-lg">visibility</span></button>
              </div>
            </div>
            <div class="flex items-center gap-2 px-1">
              <input type="checkbox" id="remember" class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"/>
              <label for="remember" class="text-xs font-medium text-slate-600 cursor-pointer">Lembrar acesso neste aparelho</label>
            </div>
            <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold shadow-sm hover:bg-primary/90 active:scale-[.98] transition-all mt-1">Entrar</button>
          </form>
          ${formButtons}
        </div>
        <div class="py-3 text-center border-t border-slate-100 bg-slate-50/50"><p class="text-[11px] text-slate-400">${appName} • SGI v1.1</p></div>
      </div>
    </div>`;

    document.getElementById('login-form').onsubmit = async e => {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector('button[type="submit"]');
      const inputs = form.querySelectorAll('input');
      
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm mr-2">refresh</span> Entrando...';
      btn.disabled = true;
      btn.classList.add('opacity-70', 'cursor-not-allowed');
      inputs.forEach(i => i.disabled = true);
      isLoggingIn = true;

      const remember = document.getElementById('remember').checked;
      const u = await store.login(document.getElementById('username').value.trim(), document.getElementById('password').value, remember);

      if (u) {
        toast(`Bem-vindo, ${u.name}!`);
        navigate(u.role === 'SUPERADMIN' ? '/organizations' : u.role === 'USER' ? '/ebd' : '/dashboard');
      } else {
        // Verifica se é erro de suspensão
        const lastError = store._lastLoginError;
        if (lastError?.code === 'ORG_SUSPENDED') {
          // Re-renderiza a tela de suspensão
          if (store.currentOrganization) store.currentOrganization.status = 'suspended';
          render();
          return;
        }
        toast('Usuário ou senha incorretos', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.classList.remove('opacity-70', 'cursor-not-allowed');
        inputs.forEach(i => i.disabled = false);
        isLoggingIn = false;
      }
    };
  };

  render();

  // Se as configurações do sistema carregarem depois, re-renderiza para aplicar branding
  // (Mas não durante um login em andamento, para evitar perder o estado de carregamento)
  window.addEventListener('system-settings-loaded', () => {
    if ((window.location.hash === '#/login' || !window.location.hash) && !isLoggingIn) render();
  });

  // Hide splash screen smoothly after the actual content is available on screen
  if (window.__removeSplashScreen) {
    setTimeout(window.__removeSplashScreen, 50);
  }
}
