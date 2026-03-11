import { store } from '../store.js';
import { header, pageWrap, bottomNav, toast, openModal, closeModal } from '../components/ui.js';

export async function organizationsView() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="flex-1 flex items-center justify-center p-12"><span class="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>';

    let orgs = [];
    let stats = { organizations: 0, activeOrganizations: 0, inactiveOrganizations: 0, users: 0, people: 0, cells: 0 };
    let searchQuery = '';

    const fetchData = async () => {
        try {
            const endpoint = searchQuery
                ? `/admin/organizations/search?q=${encodeURIComponent(searchQuery)}`
                : '/admin/organizations';
            const [orgsRes, statsRes] = await Promise.all([
                store.apiFetch(endpoint),
                store.apiFetch('/admin/organizations/stats')
            ]);
            orgs = orgsRes || [];
            stats = statsRes || stats;
        } catch (err) {
            toast('Erro ao carregar dados do SaaS', 'error');
        }
    };

    const getDomainDisplay = (org) => {
        if (org.customDomain) return org.customDomain;
        const saasBase = store.currentOrganization?.slug === 'saas-admin'
            ? (window.location.hostname.replace(/^admin\./, '') || 'localhost')
            : window.location.hostname;
        const base = saasBase === 'localhost' ? 'localhost' : saasBase;
        return `${org.subdomain || org.slug}.${base}`;
    };

    const planLabel = { demo: 'Demo', normal: 'Normal' };
    const planColor = { demo: 'bg-orange-100 text-orange-700', normal: 'bg-emerald-100 text-emerald-700' };

    const render = () => {
        const content = `
            <div class="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">

                <!-- Header -->
                <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-none mb-1">Painel de Controle SaaS</h1>
                        <p class="text-sm text-slate-500 dark:text-slate-400">Gestão centralizada de todas as igrejas da plataforma</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button id="panel-settings-btn"
                            class="bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 hover:bg-slate-600 transition-all active:scale-95" title="Configurações do Painel">
                            <span class="material-symbols-outlined text-lg">tune</span>
                        </button>
                        <button id="manage-superadmins-btn"
                            class="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 hover:bg-slate-700 transition-all active:scale-95">
                            <span class="material-symbols-outlined text-lg">admin_panel_settings</span>
                            <span class="hidden sm:inline">Equipe SaaS</span>
                        </button>
                        <div class="relative">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input type="text" id="org-search" placeholder="Buscar igreja..." value="${searchQuery}"
                                class="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all w-64 dark:text-white dark:placeholder:text-slate-500">
                        </div>
                        <button id="add-org-btn" class="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 hover:bg-primary/90 transition-all active:scale-95">
                            <span class="material-symbols-outlined text-lg">add</span> Nova Igreja
                        </button>
                    </div>
                </div>

                <!-- Stats Cards -->
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                    ${[
                        { icon: 'corporate_fare', color: 'blue', label: 'Igrejas', value: stats.organizations },
                        { icon: 'check_circle', color: 'emerald', label: 'Ativas', value: stats.activeOrganizations, valueColor: 'text-emerald-600' },
                        { icon: 'block', color: 'red', label: 'Inativas', value: stats.inactiveOrganizations, valueColor: 'text-red-500' },
                        { icon: 'group', color: 'purple', label: 'Usuários', value: stats.users },
                        { icon: 'people', color: 'orange', label: 'Membros', value: stats.people }
                    ].map(s => `
                        <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div class="w-9 h-9 rounded-xl bg-${s.color}-50 dark:bg-${s.color}-900/20 text-${s.color}-600 dark:text-${s.color}-400 flex items-center justify-center mb-3">
                                <span class="material-symbols-outlined text-lg">${s.icon}</span>
                            </div>
                            <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">${s.label}</p>
                            <p class="text-2xl font-black ${s.valueColor || 'text-slate-900 dark:text-white'}">${s.value ?? 0}</p>
                        </div>
                    `).join('')}
                </div>

                <!-- Org Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    ${orgs.length ? orgs.map(org => {
                        const isActive = org.status === 'active';
                        const domain = getDomainDisplay(org);
                        return `
                        <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group relative flex flex-col overflow-hidden">

                            <!-- Status strip -->
                            <div class="h-1 w-full ${isActive ? 'bg-emerald-400' : 'bg-slate-200'}"></div>

                            <div class="p-5 flex flex-col flex-1">
                                <!-- Header da org -->
                                <div class="flex items-start justify-between gap-3 mb-4">
                                    <div class="flex items-center gap-3 min-w-0">
                                        <div class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                            ${org.logoUrl
                                                ? `<img src="${org.logoUrl}" class="w-full h-full object-contain" />`
                                                : `<span class="material-symbols-outlined text-xl text-slate-300 dark:text-slate-700">church</span>`}
                                        </div>
                                        <div class="min-w-0">
                                            <h3 class="font-bold text-slate-900 dark:text-white truncate">${org.name}</h3>
                                            <p class="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">${domain}</p>
                                        </div>
                                    </div>
                                <!-- Ações — sempre visíveis (não dependem de hover para funcionar no mobile) -->
                                <div class="flex gap-1 shrink-0">
                                    <button onclick="window.__editOrg('${org.id}')" title="Editar"
                                        class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                                        <span class="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                    <button onclick="window.__toggleStatus('${org.id}', '${org.status}')" title="${isActive ? 'Suspender' : 'Reativar'}"
                                        class="w-8 h-8 flex items-center justify-center ${isActive ? 'text-slate-400 hover:text-orange-600 hover:bg-orange-50' : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'} rounded-lg transition-colors">
                                        <span class="material-symbols-outlined text-lg">${isActive ? 'pause_circle' : 'play_circle'}</span>
                                    </button>
                                    <button onclick="window.__deleteOrg('${org.id}', '${org.name.replace(/'/g, "\\'")}')" title="Excluir"
                                        class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                        <span class="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                </div>
                                </div>

                                <!-- Badges -->
                                <div class="flex flex-wrap gap-2 mb-4">
                                    <span class="px-2.5 py-1 ${planColor[org.plan] || planColor.demo} rounded-lg text-[10px] font-black uppercase tracking-wider dark:bg-opacity-20">
                                        ${planLabel[org.plan] || org.plan || 'Demo'}
                                    </span>
                                    <span class="px-2.5 py-1 ${isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'} rounded-lg text-[10px] font-black uppercase tracking-wider">
                                        ${isActive ? 'Ativa' : 'Suspensa'}
                                    </span>
                                    ${org.customDomain ? `
                                    <span class="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold flex items-center gap-1">
                                        <span class="material-symbols-outlined text-xs">language</span> Domínio próprio
                                    </span>` : ''}
                                </div>

                                <!-- Mini stats -->
                                <div class="grid grid-cols-3 gap-2 py-3 border-y border-slate-50 dark:border-slate-700 mb-4">
                                    ${[
                                        { label: 'Membros', value: org._count?.people ?? 0 },
                                        { label: 'Células', value: org._count?.cells ?? 0 },
                                        { label: 'Usuários', value: org._count?.users ?? 0 }
                                    ].map((s, i) => `
                                        <div class="text-center ${i === 1 ? 'border-x border-slate-100 dark:border-slate-700' : ''}">
                                            <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">${s.label}</p>
                                            <p class="text-base font-black text-slate-800 dark:text-slate-200">${s.value}</p>
                                        </div>
                                    `).join('')}
                                </div>
                                ${org.plan === 'demo' ? (() => {
                                    const count = org._count?.cells ?? 0;
                                    const pct = Math.min(100, Math.round((count / 2) * 100));
                                    const barColor = count >= 2 ? 'bg-red-400' : count === 1 ? 'bg-orange-400' : 'bg-emerald-400';
                                    return `<div class="mb-4">
                                        <div class="flex justify-between items-center mb-1">
                                            <span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">Uso de Células</span>
                                            <span class="text-[10px] font-bold ${count >= 2 ? 'text-red-500' : 'text-slate-500 dark:text-slate-600'}">${count}/2</span>
                                        </div>
                                        <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                                            <div class="${barColor} h-1.5 rounded-full transition-all" style="width:${pct}%"></div>
                                        </div>
                                    </div>`;
                                })() : ''}

                                <!-- Ação principal -->
                                <button onclick="window.__impersonatePrompt('${org.id}', '${org.name.replace(/'/g, "\\'")}')"
                                    class="mt-auto w-full py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-700 dark:hover:bg-slate-600 transition-all active:scale-[0.98] ${!isActive ? 'opacity-50 cursor-not-allowed' : ''}"
                                    ${!isActive ? 'disabled' : ''}>
                                    <span class="material-symbols-outlined text-base">switch_account</span>
                                    Acessar como Administrador
                                </button>
                            </div>
                        </div>`;
                    }).join('') : `
                        <div class="col-span-full py-20 text-center">
                            <span class="material-symbols-outlined text-6xl text-slate-100 block mb-3">search_off</span>
                            <p class="text-slate-400 font-medium">Nenhuma igreja encontrada</p>
                        </div>
                    `}
                </div>
            </div>
        `;

        app.innerHTML = pageWrap(header('Portal de Gestão SaaS') + content, bottomNav('organizations'));

        document.getElementById('add-org-btn').onclick = () => window.__editOrg(null);
        document.getElementById('manage-superadmins-btn').onclick = () => window.__manageSuperadmins();
        document.getElementById('panel-settings-btn').onclick = () => window.__panelSettings();

        const searchInput = document.getElementById('org-search');
        if (searchInput) {
            searchInput.oninput = (e) => {
                searchQuery = e.target.value;
                clearTimeout(window.__orgSearchTimeout);
                window.__orgSearchTimeout = setTimeout(async () => {
                    await fetchData();
                    render();
                    document.getElementById('org-search')?.focus();
                }, 400);
            };
        }
    };

    // -------------------------------------------------------------------------
    // Gestão de Superadmins (Equipe SaaS)
    // -------------------------------------------------------------------------
    window.__manageSuperadmins = async () => {
        openModal(`
            <div class="p-6">
                <div class="flex items-center gap-3 mb-5">
                    <div class="w-10 h-10 rounded-xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center">
                        <span class="material-symbols-outlined">admin_panel_settings</span>
                    </div>
                    <div>
                        <h2 class="text-lg font-black text-slate-900 dark:text-white">Equipe SaaS</h2>
                        <p class="text-xs text-slate-400 dark:text-slate-500">Gerenciar usuários com acesso total ao painel</p>
                    </div>
                </div>
                <div id="superadmin-list" class="py-6 flex justify-center">
                    <span class="material-symbols-outlined animate-spin text-primary">refresh</span>
                </div>
                <div class="border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
                    <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Adicionar novo Superadmin</p>
                    <form id="create-superadmin-form" class="space-y-3">
                        <input type="text" name="name" placeholder="Nome completo"
                            class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm dark:text-white" required>
                        <input type="text" name="username" placeholder="usuário de login"
                            class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono dark:text-white" required>
                        <input type="text" name="password" placeholder="senha inicial"
                            class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono dark:text-white" required>
                        <button type="submit" class="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-sm hover:opacity-90 active:scale-95 transition-all">
                            Criar Superadmin
                        </button>
                    </form>
                </div>
            </div>
        `);

        const loadList = async () => {
            const container = document.getElementById('superadmin-list');
            if (!container) return;
            try {
                const admins = await store.apiFetch('/admin/organizations/superadmin-users');
                if (!admins?.length) {
                    container.innerHTML = '<p class="text-slate-400 text-sm text-center py-2">Nenhum superadmin encontrado.</p>';
                    return;
                }
                container.innerHTML = `<div class="space-y-2 w-full">
                    ${admins.map(a => `
                        <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div>
                                <p class="text-sm font-bold text-slate-900 dark:text-white">${a.name}</p>
                                <p class="text-xs text-slate-400 dark:text-slate-500 font-mono">@${a.username}</p>
                            </div>
                            <button onclick="window.__deleteSuperadmin('${a.id}', '${a.username}')"
                                class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                <span class="material-symbols-outlined text-base">delete</span>
                            </button>
                        </div>
                    `).join('')}
                </div>`;
            } catch {
                container.innerHTML = '<p class="text-red-400 text-sm text-center">Erro ao carregar lista.</p>';
            }
        };

        window.__deleteSuperadmin = async (id, username) => {
            if (!confirm(`Remover @${username} do painel SaaS?`)) return;
            try {
                await store.apiFetch(`/admin/organizations/superadmin-users/${id}`, { method: 'DELETE' });
                toast(`@${username} removido.`, 'success');
                await loadList();
            } catch(err) {
                toast(err.message || 'Erro ao remover', 'error');
            }
        };

        document.getElementById('create-superadmin-form').onsubmit = async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target).entries());
            const btn = e.target.querySelector('[type="submit"]');
            btn.disabled = true; btn.textContent = 'Criando...';
            try {
                await store.apiFetch('/admin/organizations/superadmin-users', { method: 'POST', body: JSON.stringify(data) });
                toast(`Superadmin @${data.username} criado!`, 'success');
                e.target.reset();
                await loadList();
            } catch(err) {
                toast(err.message || 'Erro ao criar', 'error');
            } finally {
                btn.disabled = false; btn.textContent = 'Criar Superadmin';
            }
        };

        await loadList();
    };

    // -------------------------------------------------------------------------
    // Impersonação: lista usuários da org e permite entrar como um deles
    // -------------------------------------------------------------------------
    window.__impersonatePrompt = async (orgId, orgName) => {

        openModal(`
            <div class="p-6">
                <div class="flex items-center justify-between mb-1">
                    <h2 class="text-lg font-black text-slate-900 dark:text-white">Acessar ${orgName}</h2>
                    <button onclick="window.__createAdminModal('${orgId}', '${orgName.replace(/'/g, "\\'")}')"
                        class="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[11px] font-bold hover:bg-primary hover:text-white transition-all">
                        <span class="material-symbols-outlined text-sm">person_add</span> Novo Admin
                    </button>
                </div>
                <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">Escolha um usuário para assumir a identidade temporariamente.</p>
                <div id="user-list-container" class="py-8 flex justify-center">
                    <span class="material-symbols-outlined animate-spin text-primary text-2xl">refresh</span>
                </div>
            </div>
        `);

        try {
            const users = await store.apiFetch(`/admin/organizations/${orgId}/users`);
            const container = document.getElementById('user-list-container');
            if (!container) return;

            if (!users || !users.length) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <p class="text-slate-400 text-sm mb-3">Nenhum usuário nesta igreja.</p>
                        <button onclick="window.__createAdminModal('${orgId}', '${orgName.replace(/'/g, "\\'")}')"
                            class="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold">Criar primeiro acesso</button>
                    </div>`;
                return;
            }

            const roleLabel = { ADMIN: 'Admin', SUPERVISOR: 'Supervisor', LEADER: 'Líder', VICE_LEADER: 'Vice-Líder', USER: 'Usuário', LIDER_GERACAO: 'Lider de Geração' };
            container.innerHTML = `
                <div class="space-y-2 w-full max-h-72 overflow-y-auto">
                    ${users.map(u => `
                        <button onclick="window.__loginAs('${u.id}')"
                            class="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
                            <div>
                                <p class="text-sm font-bold text-slate-900 dark:text-white">${u.name}</p>
                                <p class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">${roleLabel[u.role] || u.role} · @${u.username}</p>
                            </div>
                            <span class="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors">chevron_right</span>
                        </button>
                    `).join('')}
                </div>`;
        } catch (err) {
            toast('Erro ao buscar usuários', 'error');
            closeModal();
        }
    };

    window.__loginAs = async (userId) => {
        try {
            const res = await store.apiFetch(`/admin/organizations/login-as/${userId}`, { method: 'POST' });
            if (!res.token) throw new Error('Token não retornado');

            sessionStorage.setItem('crm_token_impersonated', store.token);
            sessionStorage.setItem('crm_user_impersonated', JSON.stringify(store.currentUser));
            localStorage.setItem('crm_token', res.token);
            localStorage.setItem('crm_user', JSON.stringify(res.user));

            toast('Redirecionando para o painel da igreja...', 'success');
            setTimeout(() => window.location.href = '/', 1000);
        } catch (err) {
            toast('Falha ao assumir identidade', 'error');
        }
    };

    // -------------------------------------------------------------------------
    // Criar admin para uma org existente
    // -------------------------------------------------------------------------
    window.__createAdminModal = (orgId, orgName) => {
        openModal(`
            <div class="p-6">
                <div class="flex items-center gap-3 mb-5">
                    <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <span class="material-symbols-outlined">person_add</span>
                    </div>
                    <div>
                        <h3 class="text-base font-black text-slate-900 dark:text-white">Novo Administrador</h3>
                        <p class="text-xs text-slate-400 dark:text-slate-500">${orgName}</p>
                    </div>
                </div>
                <form id="create-admin-form" class="space-y-3">
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Nome Completo</label>
                        <input type="text" name="name" class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm dark:text-white" required placeholder="Nome do administrador">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Usuário (Login)</label>
                        <input type="text" name="username" class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm dark:text-white" required placeholder="admin.nomeigreja">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Senha Inicial</label>
                        <input type="text" name="password" class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono dark:text-white" required placeholder="Senha para primeiro acesso">
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button type="button" onclick="window.__impersonatePrompt('${orgId}', '${orgName.replace(/'/g, "\\'")}')"
                            class="flex-1 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Voltar</button>
                        <button type="submit"
                            class="flex-1 py-2.5 text-sm font-bold bg-primary text-white rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all">Criar Acesso</button>
                    </div>
                </form>
            </div>
        `);

        document.getElementById('create-admin-form').onsubmit = async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target).entries());
            data.role = 'ADMIN';
            try {
                await store.apiFetch(`/admin/organizations/${orgId}/users`, { method: 'POST', body: JSON.stringify(data) });
                toast(`Acesso criado para ${data.name}!`, 'success');
                window.__impersonatePrompt(orgId, orgName);
            } catch (err) {
                toast(err.message || 'Erro ao criar admin', 'error');
            }
        };
    };

    // -------------------------------------------------------------------------
    // Criar / Editar organização
    // -------------------------------------------------------------------------
    window.__editOrg = async (id) => {
        const isNew = !id;
        const org = isNew
            ? { name: '', slug: '', subdomain: '', congregationName: '', primaryColor: '#0f172a', status: 'active', plan: 'demo', customDomain: '', cellsEnabled: true, ebdEnabled: false }
            : orgs.find(o => o.id === id) || {};

        openModal(`
            <div class="p-6 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center gap-3 mb-5">
                    <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <span class="material-symbols-outlined">${isNew ? 'add_business' : 'edit'}</span>
                    </div>
                    <h2 class="text-xl font-black text-slate-900 dark:text-white">${isNew ? 'Nova Igreja no SaaS' : 'Configurar Igreja'}</h2>
                </div>

                <form id="org-form" class="space-y-4">
                    <!-- Dados da Igreja -->
                    <div class="space-y-3">
                        <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Dados da Igreja</p>
                        <input type="text" name="name" value="${org.name || ''}" required placeholder="Nome da Igreja"
                            class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm dark:text-white">
                        <input type="text" name="congregationName" value="${org.congregationName || ''}" placeholder="Nome da Congregação (opcional)"
                            class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm dark:text-white">
                    </div>

                    <!-- Domínio -->
                    <div class="space-y-3">
                        <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Domínio / Acesso</p>
                        <div>
                            <input type="text" name="slug" value="${org.slug || ''}" ${isNew ? 'required' : ''} placeholder="slug (ex: transformacao)"
                                class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono dark:text-white">
                            <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1 ml-1">Apenas letras minúsculas, números e hífens</p>
                        </div>
                        <input type="text" name="customDomain" value="${org.customDomain || ''}" placeholder="Domínio próprio (ex: app.minha-igreja.com.br)"
                            class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm dark:text-white">
                    </div>

                    <!-- Plano e Status -->
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Plano</p>
                            <select name="plan" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">
                                <option value="demo" ${!org.plan || org.plan === 'demo' ? 'selected' : ''}>Demo (limite de 2 células)</option>
                                <option value="normal" ${org.plan === 'normal' ? 'selected' : ''}>Normal (sem limite)</option>
                            </select>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Cor Principal</p>
                            <div class="flex gap-2 items-center">
                                <input type="color" name="primaryColor" value="${org.primaryColor || '#0f172a'}"
                                    class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer bg-slate-50 dark:bg-slate-900 p-1">
                                <span class="text-xs text-slate-400 dark:text-slate-500">Identidade visual</span>
                            </div>
                        </div>
                    </div>

                    ${!isNew ? `
                    <div>
                        <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Status</p>
                        <select name="status" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm dark:text-white">
                            <option value="active" ${org.status === 'active' ? 'selected' : ''}>Ativa</option>
                            <option value="suspended" ${org.status === 'suspended' ? 'selected' : ''}>Suspensa</option>
                        </select>
                    </div>` : ''}

                    <!-- Módulos -->
                    <div class="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-3">
                        <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Módulos</p>
                        <label class="flex items-center justify-between gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/30 transition-colors">
                            <div class="flex items-center gap-2.5">
                                <span class="material-symbols-outlined text-indigo-500 text-lg">diversity_3</span>
                                <div>
                                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Módulo Celular habilitado</p>
                                    <p class="text-[10px] text-slate-400 dark:text-slate-500">Células, Frequência e Gerações</p>
                                </div>
                            </div>
                            <div class="relative inline-flex items-center shrink-0">
                                <input type="checkbox" id="org-cells-enabled" name="cellsEnabled" class="sr-only peer" ${org.cellsEnabled !== false ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                            </div>
                        </label>
                        <label class="flex items-center justify-between gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-300 transition-colors">
                            <div class="flex items-center gap-2.5">
                                <span class="material-symbols-outlined text-amber-500 text-lg">menu_book</span>
                                <div>
                                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Módulo EBD habilitado</p>
                                    <p class="text-[10px] text-slate-400 dark:text-slate-500">Escola Bíblica Dominical</p>
                                </div>
                            </div>
                            <div class="relative inline-flex items-center shrink-0">
                                <input type="checkbox" id="org-ebd-enabled" name="ebdEnabled" class="sr-only peer" ${org.ebdEnabled ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                            </div>
                        </label>
                    </div>

                    <!-- Admin inicial (apenas na criação) -->
                    ${isNew ? `
                    <div class="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-3">
                        <div class="flex items-center justify-between">
                            <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Criar Acesso Inicial</p>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="create-admin-check" class="rounded dark:bg-slate-900 dark:border-slate-700" checked>
                                <span class="text-xs text-slate-500 dark:text-slate-400">Sim</span>
                            </label>
                        </div>
                        <div id="admin-fields" class="space-y-3">
                            <input type="text" name="adminName" placeholder="Nome do administrador" value="Administrador"
                                class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm dark:text-white">
                            <input type="text" name="adminUsername" id="admin-username" placeholder="usuário de login (ex: admin.transformacao)"
                                class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono dark:text-white">
                            <input type="text" name="adminPassword" value="igreja@2025" placeholder="Senha inicial"
                                class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono dark:text-white">
                        </div>
                    </div>` : ''}

                    <div class="flex gap-3 pt-2">
                        <button type="button" onclick="closeModal()" class="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-all">Cancelar</button>
                        <button type="submit" class="flex-1 py-3 text-sm font-bold bg-primary text-white rounded-2xl shadow-sm hover:opacity-90 active:scale-95 transition-all">
                            ${isNew ? 'Criar Igreja' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        `);

        // Auto-preenche username admin baseado no slug
        if (isNew) {
            const slugInput = document.querySelector('[name="slug"]');
            const usernameInput = document.getElementById('admin-username');
            const createCheck = document.getElementById('create-admin-check');
            const adminFields = document.getElementById('admin-fields');

            if (slugInput && usernameInput) {
                slugInput.oninput = (e) => {
                    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    e.target.value = slug;
                    usernameInput.value = slug ? `admin.${slug}` : '';
                };
            }

            if (createCheck && adminFields) {
                createCheck.onchange = () => {
                    adminFields.style.display = createCheck.checked ? 'block' : 'none';
                };
            }
        }

        document.getElementById('org-form').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            // Converter checkboxes de módulos para booleano (FormData retorna "on" ou ausente)
            data.cellsEnabled = document.getElementById('org-cells-enabled')?.checked ?? true;
            data.ebdEnabled = document.getElementById('org-ebd-enabled')?.checked ?? false;

            // Se checkbox desmarcado, remove dados de admin
            if (isNew && !document.getElementById('create-admin-check')?.checked) {
                delete data.adminName;
                delete data.adminUsername;
                delete data.adminPassword;
            }

            const btn = e.target.querySelector('[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Salvando...';

            try {
                if (!isNew) {
                    await store.apiFetch(`/admin/organizations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
                    toast('Igreja atualizada com sucesso!', 'success');
                    closeModal();
                    await fetchData();
                    render();
                } else {
                    const res = await store.apiFetch('/admin/organizations', { method: 'POST', body: JSON.stringify(data) });
                    closeModal();

                    // Mostra credenciais criadas
                    if (res.adminCreated) {
                        window.__showCredentials(res.name, res.adminCreated.username, data.adminPassword);
                    } else {
                        toast('Igreja criada com sucesso!', 'success');
                    }

                    await fetchData();
                    render();
                }
            } catch (err) {
                toast(err.message || 'Erro ao salvar', 'error');
                btn.disabled = false;
                btn.textContent = isNew ? 'Criar Igreja' : 'Salvar Alterações';
            }
        };
    };

    // Mostra credenciais recém-criadas
    window.__showCredentials = (orgName, username, password) => {
        openModal(`
            <div class="p-6 text-center">
                <div class="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <h2 class="text-xl font-black text-slate-900 dark:text-white mb-1">Igreja criada!</h2>
                <p class="text-sm text-slate-400 dark:text-slate-500 mb-6">Guarde as credenciais de acesso abaixo:</p>
                <div class="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 text-left space-y-3 mb-6 border dark:border-slate-800">
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Organização</p>
                        <p class="text-white font-bold">${orgName}</p>
                    </div>
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Usuário</p>
                        <p class="text-emerald-400 font-mono font-bold text-lg">${username}</p>
                    </div>
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Senha Inicial</p>
                        <p class="text-emerald-400 font-mono font-bold text-lg">${password}</p>
                    </div>
                </div>
                <p class="text-xs text-slate-400 mb-4">Compartilhe estas credenciais com o administrador da igreja. Recomende a troca de senha no primeiro acesso.</p>
                <button onclick="closeModal()" class="w-full py-3 bg-primary text-white font-bold rounded-2xl text-sm">Entendido</button>
            </div>
        `);
    };

    // -------------------------------------------------------------------------
    // Toggle rápido de status (suspender / reativar)
    // -------------------------------------------------------------------------
    window.__toggleStatus = async (orgId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const label = newStatus === 'suspended' ? 'suspender' : 'reativar';
        const org = orgs.find(o => o.id === orgId);

        openModal(`
            <div class="p-6 text-center">
                <div class="w-14 h-14 rounded-2xl ${newStatus === 'suspended' ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'} flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-2xl">${newStatus === 'suspended' ? 'pause_circle' : 'play_circle'}</span>
                </div>
                <h2 class="text-lg font-black text-slate-900 dark:text-white mb-2">${newStatus === 'suspended' ? 'Suspender Igreja' : 'Reativar Igreja'}</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    ${newStatus === 'suspended'
                        ? `A igreja <strong>${org?.name}</strong> e seus usuários não conseguirão mais acessar o sistema.`
                        : `A igreja <strong>${org?.name}</strong> voltará a ter acesso normal ao sistema.`}
                </p>
                <div class="flex gap-3">
                    <button onclick="closeModal()" class="flex-1 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                    <button id="confirm-toggle" class="flex-1 py-2.5 text-sm font-bold ${newStatus === 'suspended' ? 'bg-orange-500' : 'bg-emerald-500'} text-white rounded-xl transition-all hover:opacity-90">
                        ${newStatus === 'suspended' ? 'Suspender' : 'Reativar'}
                    </button>
                </div>
            </div>
        `);

        document.getElementById('confirm-toggle').onclick = async () => {
            try {
                await store.apiFetch(`/admin/organizations/${orgId}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
                toast(`Igreja ${newStatus === 'suspended' ? 'suspensa' : 'reativada'} com sucesso.`, 'success');
                closeModal();
                await fetchData();
                render();
            } catch (err) {
                toast(`Erro ao ${label} igreja`, 'error');
            }
        };
    };

    // -------------------------------------------------------------------------
    // Configurações do Painel SaaS (cor, ícone/logo)
    // -------------------------------------------------------------------------
    window.__panelSettings = async () => {
        let current = { primaryColor: '#6366f1', logoUrl: '', name: 'Painel Central SaaS' };
        try {
            const data = await store.apiFetch('/admin/organizations/panel-settings');
            current = { ...current, ...data };
        } catch (e) { /* usa defaults */ }

        openModal(`
            <div class="p-6">
                <div class="flex items-center gap-3 mb-5">
                    <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <span class="material-symbols-outlined">tune</span>
                    </div>
                    <div>
                        <h3 class="text-base font-black text-slate-900 dark:text-white">Configurações do Painel</h3>
                        <p class="text-xs text-slate-400 dark:text-slate-500">Aparência do portal de administração SaaS</p>
                    </div>
                </div>
                <form id="panel-settings-form" class="space-y-4">
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Nome do Painel</label>
                        <input type="text" name="name" value="${current.name}"
                            class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm dark:text-white" placeholder="Painel Central SaaS">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Cor do Painel</label>
                        <div class="flex items-center gap-3">
                            <input type="color" name="primaryColor" value="${current.primaryColor}"
                                class="w-12 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent">
                            <input type="text" id="color-text-input" value="${current.primaryColor}"
                                class="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono dark:text-white" placeholder="#6366f1">
                        </div>
                        <div class="flex gap-2 mt-2 flex-wrap">
                            ${['#6366f1','#0f172a','#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899'].map(c =>
                                `<button type="button" onclick="document.querySelector('[name=primaryColor]').value='${c}';document.getElementById('color-text-input').value='${c}'"
                                    class="w-7 h-7 rounded-lg border-2 border-white dark:border-slate-700 shadow-sm hover:scale-110 transition-transform" style="background:${c}"></button>`
                            ).join('')}
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">URL do Logo/Ícone (opcional)</label>
                        <input type="url" name="logoUrl" value="${current.logoUrl}"
                            class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm dark:text-white" placeholder="https://...">
                        <p class="text-[10px] text-slate-400 mt-1">Deixe vazio para usar o ícone padrão do painel.</p>
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">Cancelar</button>
                        <button type="submit" class="flex-1 py-2.5 text-sm font-bold bg-primary text-white rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all">Salvar</button>
                    </div>
                </form>
            </div>
        `);

        // Sincroniza input de texto com o color picker
        const colorPicker = document.querySelector('[name=primaryColor]');
        const colorText = document.getElementById('color-text-input');
        colorPicker.oninput = () => { colorText.value = colorPicker.value; };
        colorText.oninput = () => {
            if (/^#[0-9a-fA-F]{6}$/.test(colorText.value)) colorPicker.value = colorText.value;
        };

        document.getElementById('panel-settings-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const payload = {
                name: fd.get('name') || 'Painel Central SaaS',
                primaryColor: colorText.value.match(/^#[0-9a-fA-F]{6}$/) ? colorText.value : colorPicker.value,
                logoUrl: fd.get('logoUrl') || ''
            };
            try {
                const saved = await store.apiFetch('/admin/organizations/panel-settings', {
                    method: 'PUT', body: JSON.stringify(payload)
                });
                // Aplica imediatamente na sessão atual
                store.currentOrganization = { ...store.currentOrganization, ...saved };
                await store.applySystemSettings();
                toast('Configurações do painel salvas!', 'success');
                closeModal();
            } catch (err) {
                toast(err.message || 'Erro ao salvar configurações', 'error');
            }
        };
    };

    // -------------------------------------------------------------------------
    // Delete com modal de confirmação (Beatriz: dupla confirmação por ser irreversível)
    // -------------------------------------------------------------------------
    window.__deleteOrg = (orgId, orgName) => {
        openModal(`
            <div class="p-6 text-center">
                <div class="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-2xl">delete_forever</span>
                </div>
                <h2 class="text-lg font-black text-slate-900 dark:text-white mb-2">Excluir Igreja</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-2">Esta ação é <strong>irreversível</strong>. Todos os dados serão apagados permanentemente:</p>
                <p class="text-sm font-bold text-red-600 dark:text-red-400 mb-4">membros, células, presenças, formulários, usuários e configurações.</p>
                <div class="mb-5">
                    <p class="text-xs text-slate-400 dark:text-slate-500 mb-2">Digite o nome da igreja para confirmar:</p>
                    <input type="text" id="confirm-name-input" placeholder="${orgName}"
                        class="w-full px-4 py-2.5 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950 rounded-xl outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900/50 text-sm text-center font-bold dark:text-white dark:placeholder:text-red-800">
                </div>
                <div class="flex gap-3">
                    <button onclick="closeModal()" class="flex-1 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                    <button id="confirm-delete-btn" disabled
                        class="flex-1 py-2.5 text-sm font-bold bg-red-500 text-white rounded-xl transition-all opacity-40 cursor-not-allowed">
                        Excluir Definitivamente
                    </button>
                </div>
            </div>
        `);

        const input = document.getElementById('confirm-name-input');
        const btn = document.getElementById('confirm-delete-btn');

        input.oninput = () => {
            const match = input.value.trim() === orgName.trim();
            btn.disabled = !match;
            btn.classList.toggle('opacity-40', !match);
            btn.classList.toggle('cursor-not-allowed', !match);
            btn.classList.toggle('hover:opacity-90', match);
        };

        btn.onclick = async () => {
            btn.textContent = 'Excluindo...';
            btn.disabled = true;
            try {
                await store.apiFetch(`/admin/organizations/${orgId}`, { method: 'DELETE' });
                toast('Igreja removida permanentemente.', 'success');
                closeModal();
                await fetchData();
                render();
            } catch (err) {
                toast(err.message || 'Erro ao excluir', 'error');
                closeModal();
            }
        };
    };

    await fetchData();
    render();
}
