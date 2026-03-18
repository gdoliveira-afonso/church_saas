import { isNativeApp } from './native/index.js';
import { getServerUrlSync } from './native/server-config.js';

const API_URL = '/api';

const D = {
    currentUser: null,
    currentOrganization: null, // SaaS: Identifica a igreja atual
    users: [], people: [], cells: [], attendance: [], pastoralNotes: [], visits: [], events: [], cellCancellations: [], cellJustifications: [], eventExceptions: [],
    forms: [], tracks: [], triageQueue: [], notifications: [], generations: [],
    ebdClasses: [], ebdAttendance: [], ebdOfferings: [],
    financeAccounts: [], financeFunds: [], financeChartOfAccounts: []
};

class Store {
    constructor() {
        // Suporte nativo (Capacitor): usa URL do servidor salva localmente
        const nativeServerUrl = isNativeApp() ? getServerUrlSync() : '';
        this.apiBase = nativeServerUrl ? nativeServerUrl + '/api' : API_URL;

        Object.assign(this, JSON.parse(JSON.stringify(D)));

        // Try localStorage first (persistent), then sessionStorage (temporary)
        this.token = localStorage.getItem('crm_token') || sessionStorage.getItem('crm_token');
        const savedUser = localStorage.getItem('crm_user') || sessionStorage.getItem('crm_user');

        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this._pendingInitialLoad = true; // defer until systemSettings resolved
        }

        // Em modo nativo sem URL configurada, aguarda app.js inicializar após setup
        if (isNativeApp() && !nativeServerUrl) return;

        this.initSaaS();
    }

    async initSaaS() {
        try {
            const configRes = await fetch(`${this.apiBase}/public/config`);
            if (configRes.ok) {
                const config = await configRes.json();
                this.saasDomain = config.saasDomain;
                this.matrizSlug = config.matrizSlug || 'matriz';
            }
        } catch (e) { console.error('[SaaS] Error fetching config:', e); }

        await this.resolveOrganization();
        await this.applySystemSettings();

        // Load initial data only after systemSettings is resolved (so EBD/finance flags are known)
        if (this._pendingInitialLoad) {
            this._pendingInitialLoad = false;
            this.loadInitialData();
        }
    }

    async resolveOrganization() {
        const hostname = window.location.hostname;
        const urlParams = new URLSearchParams(window.location.search);
        const orgParam = urlParams.get('org');
        const saasDomain = this.saasDomain || '';

        // 1. Caso especial: painel do superadmin
        const isSaasAdmin = (saasDomain && hostname === `admin.${saasDomain}`) || 
                          hostname.startsWith('admin.') || 
                          hostname === 'admin.localhost';

        const isSuperadminUser = this.currentUser?.role === 'SUPERADMIN';

        if ((isSaasAdmin || isSuperadminUser) && !orgParam) {
            this.currentOrganization = {
                name: 'Painel Central SaaS',
                slug: 'saas-admin',
                logoUrl: '',
                primaryColor: '#6366f1',
                loginMessage: 'Portal de Administração Geral da Plataforma'
            };
            if (this.token) {
                try {
                    const res = await fetch(`${this.apiBase}/admin/organizations/panel-settings`, {
                        headers: { 'Authorization': `Bearer ${this.token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        this.currentOrganization = { ...this.currentOrganization, ...data };
                    }
                } catch (e) { /* usa defaults */ }
            }
            return;
        }

        // 2. Se veio um slug explícito via query (?org=xxx), usa ele diretamente
        if (orgParam) {
            try {
                const res = await fetch(`${this.apiBase}/public/org/${encodeURIComponent(orgParam)}`);
                if (res.ok) { this.currentOrganization = await res.json(); return; }
            } catch (e) { /* continua para fallback */ }
        }

        // 3. Resolução Determinística via Subdomínio
        if (saasDomain && hostname.endsWith(`.${saasDomain}`)) {
            const sub = hostname.slice(0, hostname.length - saasDomain.length - 1);
            if (sub) {
                try {
                    const res = await fetch(`${this.apiBase}/public/org/${encodeURIComponent(sub)}`);
                    if (res.ok) {
                        this.currentOrganization = await res.json();
                        console.log('[SaaS] Org resolvida por subdomínio:', sub);
                        return;
                    }
                } catch (e) { /* continua */ }
            }
        }

        // 4. Resolução por Header Host do Banco (mais precisa para domínios customizados)
        try {
            const res = await fetch(`${this.apiBase}/public/org/by-host`);
            if (res.ok) {
                this.currentOrganization = await res.json();
                console.log('[SaaS] Org resolvida pelo host:', this.currentOrganization.name);
                return;
            }
        } catch (e) { /* continua */ }

        // 5. Localhost e IPs → Matriz (ambiente de dev)
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
        if (isLocal) {
            try {
                const res = await fetch(`${this.apiBase}/public/org/${this.matrizSlug || 'matriz'}`);
                if (res.ok) this.currentOrganization = await res.json();
            } catch (e) { console.error('[SaaS] Erro ao carregar org matriz:', e); }
            return;
        }

        // 6. Último recurso: carrega a matriz para não quebrar o layout
        console.warn('[SaaS] Nenhuma org encontrada para o domínio, usando matriz como fallback.');
        try {
            const res = await fetch(`${this.apiBase}/public/org/${this.matrizSlug || 'matriz'}`);
            if (res.ok) this.currentOrganization = await res.json();
        } catch (e) { console.error('[SaaS] Erro crítico na resolução de org:', e); }
    }

    async applySystemSettings() {
        // SaaS: Prioriza as configurações da Organização resolvida
        const settings = this.currentOrganization || {};
        this.systemSettings = settings;

        // Color injection
        if (settings.primaryColor) {
            const hexToRgb = hex => {
                let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : null;
            };
            const rbgStr = hexToRgb(settings.primaryColor);
            if (rbgStr) document.documentElement.style.setProperty('--color-primary', rbgStr);
        }

        // Title and Favicon
        if (settings.name || settings.appName) {
            document.title = settings.name || settings.appName;
        }
        if (settings.logoUrl) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = settings.logoUrl;
        }

        window.dispatchEvent(new Event('system-settings-loaded'));
    }

    async fetchOrgSettings() {
        const res = await this.apiFetch('/settings');
        return res;
    }

    async updateSystemSettings(data) {
        // Se for Superadmin, injeta o ID da org atual no payload
        if (this.currentUser?.role === 'SUPERADMIN' && this.currentOrganization?.id) {
            data.organizationId = this.currentOrganization.id;
        }
        const res = await this.apiFetch('/settings', { method: 'PUT', body: JSON.stringify(data) });
        this.currentOrganization = res;
        this.systemSettings = res;
        await this.applySystemSettings(); // Re-aplica cor/nome logo após salvar
        return res;
    }

    // Campos Customizados de Célula (usa endpoint dedicado via SystemConfig)
    async getCellFields() {
        try {
            const orgSlug = this.currentOrganization?.slug || 'matriz';
            // Use the PUBLIC endpoint with the PUBLIC path
            const res = await fetch(`${this.apiBase}/public/settings/public-cell-fields?org=${orgSlug}`);
            if (res.ok) {
                const data = await res.json();
                if (this.systemSettings) this.systemSettings.cellCustomFields = data.cellCustomFields;
                else this.systemSettings = { cellCustomFields: data.cellCustomFields };
                return data.cellCustomFields || '';
            }
        } catch (e) { /* silencia */ }
        return '';
    }

    async saveCellFields(fields) {
        if (!this.token) throw new Error('Not authenticated');
        const res = await fetch(`${this.apiBase}/settings/cell-fields`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ cellCustomFields: fields })
        });
        if (!res.ok) throw new Error('Falha ao salvar campos');
        const data = await res.json();
        if (this.systemSettings) this.systemSettings.cellCustomFields = data.cellCustomFields;
        else this.systemSettings = { cellCustomFields: data.cellCustomFields };
        return data.cellCustomFields || '';
    }

    async uploadSystemLogo(file) {
        const formData = new FormData();
        formData.append('logo', file);
        if (!this.token) throw new Error('Not authenticated');
        const r = await fetch(`${this.apiBase}/settings/upload-logo`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });
        if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(err.error || 'Erro ao enviar logo');
        }
        return await r.json();
    }

    async apiFetch(endpoint, options = {}) {
        if (!options.headers) options.headers = {};
        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }
        options.headers['Content-Type'] = 'application/json';

        // SaaS: Se for Superadmin sem orgId no token, mas tivermos uma org resolvida, injeta via Query
        if (this.currentUser?.role === 'SUPERADMIN' && !this.currentUser.organizationId && this.currentOrganization?.id) {
            const separator = endpoint.includes('?') ? '&' : '?';
            endpoint += `${separator}organizationId=${this.currentOrganization.id}`;
        }

        try {
            const res = await fetch(`${this.apiBase}${endpoint}`, options);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                if (res.status === 401) {
                    this.logout();
                }
                const err = new Error(errData.error || `API Error: ${res.status}`);
                err.status = res.status;
                err.code = errData.code || null;
                err.data = errData;
                throw err;
            }
            return await res.json();
        } catch (e) {
            console.error('Fetch error:', e);
            throw e;
        }
    }

    async loadInitialData() {
        if (!this.isLoggedIn()) return;
        try {
            this.users = await this.apiFetch('/users');
            this.people = await this.apiFetch('/people');
            this.cells = await this.apiFetch('/cells');
            this.tracks = await this.apiFetch('/dash/tracks');
            this.forms = await this.apiFetch('/forms');
            this.triageQueue = await this.apiFetch('/forms/triage/all');
            this.generations = await this.apiFetch('/generations');

            const eventsData = await this.apiFetch('/events');
            this.events = eventsData.events || [];
            this.cellCancellations = eventsData.cellCancellations || [];
            this.cellJustifications = eventsData.cellJustifications || [];

            // Carrega exceptions para todos os eventos (cache local via bulk route)
            this._eventExceptions = {};
            try {
                const allExs = await this.apiFetch('/events/exceptions/all');
                allExs.forEach(ex => {
                    if (!this._eventExceptions[ex.eventId]) this._eventExceptions[ex.eventId] = [];
                    this._eventExceptions[ex.eventId].push(ex);
                });
            } catch (e) { console.error('Erro bulk exceptions:', e); }

            this.pastoralNotes = await this.apiFetch('/dash/notes');
            this.visits = await this.apiFetch('/dash/visits');
            this.attendance = await this.apiFetch('/cells/attendance/all');

            if (this.currentUser) {
                const refreshedUser = this.users.find(u => u.id === this.currentUser.id);
                if (refreshedUser) {
                    this.currentUser = { ...this.currentUser, ...refreshedUser };
                    if (typeof this.currentUser.secondaryRoles === 'string') {
                        this.currentUser.secondaryRoles = JSON.parse(this.currentUser.secondaryRoles || '[]');
                    } else if (!Array.isArray(this.currentUser.secondaryRoles)) {
                        this.currentUser.secondaryRoles = [];
                    }
                    localStorage.setItem('crm_user', JSON.stringify(this.currentUser));
                }
                this.notifications = await this.apiFetch(`/dash/notifications?userId=${this.currentUser.id}`);
            }

            if (this.systemSettings?.ebdEnabled) {
                try {
                    const [classes, attendance, offerings] = await Promise.all([
                        this.apiFetch('/ebd/classes').catch(() => []),
                        this.apiFetch('/ebd/attendance/all').catch(() => []),
                        this.apiFetch('/ebd/offerings/all').catch(() => [])
                    ]);
                    this.ebdClasses = Array.isArray(classes) ? classes : [];
                    this.ebdAttendance = Array.isArray(attendance) ? attendance : [];
                    this.ebdOfferings = Array.isArray(offerings) ? offerings : [];
                } catch (e) {
                    this.ebdClasses = [];
                    this.ebdAttendance = [];
                    this.ebdOfferings = [];
                }
            }

            if (this.systemSettings?.financialEnabled) {
                try {
                    const [accounts, funds, chart] = await Promise.all([
                        this.apiFetch('/finance/accounts').catch(() => []),
                        this.apiFetch('/finance/funds').catch(() => []),
                        this.apiFetch('/finance/chart').catch(() => [])
                    ]);
                    this.financeAccounts = Array.isArray(accounts) ? accounts : [];
                    this.financeFunds = Array.isArray(funds) ? funds : [];
                    this.financeChartOfAccounts = Array.isArray(chart) ? chart : [];
                } catch (e) {
                    this.financeAccounts = [];
                    this.financeFunds = [];
                    this.financeChartOfAccounts = [];
                }
            }

            // Dispatch custom event to notify UI that data is loaded
            window.dispatchEvent(new Event('store-data-loaded'));
        } catch (e) {
            console.error('Falha ao carregar dados da API:', e);
        }
    }

    // Auth
    async login(username, password, remember = false) {
        try {
            const orgSlug = this.currentOrganization?.slug;
            const res = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, orgSlug })
            });

            if (!res.ok) {
                try { this._lastLoginError = await res.json(); } catch { this._lastLoginError = null; }
                return null;
            }

            const data = await res.json();
            this.token = data.token;
            this.currentUser = data.user;
            if (typeof this.currentUser.secondaryRoles === 'string') {
                this.currentUser.secondaryRoles = JSON.parse(this.currentUser.secondaryRoles || '[]');
            } else if (!Array.isArray(this.currentUser.secondaryRoles)) {
                this.currentUser.secondaryRoles = [];
            }

            if (data.user.organization) {
                this.currentOrganization = data.user.organization;
                this.systemSettings = data.user.organization;
                await this.applySystemSettings();
            }

            const storage = remember ? localStorage : sessionStorage;
            storage.setItem('crm_token', data.token);
            storage.setItem('crm_user', JSON.stringify(data.user));
            if (data.user.organizationId) {
                storage.setItem('crm_org_id', data.user.organizationId);
            }

            await this.loadInitialData();
            return this.currentUser;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    logout() {
        this.currentUser = null;
        this.token = null;
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        sessionStorage.clear(); // Limpa tudo, incluindo tokens de impersonação
        window.location.hash = '/login';
        setTimeout(() => window.location.reload(), 100);
    }

    async resetSystem() {
        if (!this.currentUser || this.currentUser.role !== 'ADMIN') return;
        try {
            await this.apiFetch('/settings/reset', { method: 'POST' });
            this.logout();
        } catch (e) {
            console.error('Failed to reset system', e);
        }
    }

    isLoggedIn() { return !!this.currentUser && !!this.token; }
    hasRole(...r) { return this.currentUser && r.includes(this.currentUser.role); }
    hasSecondaryRole(...roles) {
        const sr = this.currentUser?.secondaryRoles;
        const arr = Array.isArray(sr) ? sr : (typeof sr === 'string' ? JSON.parse(sr || '[]') : []);
        return roles.some(r => arr.includes(r));
    }

    // Finance — Accounts
    async fetchFinanceAccounts() {
        this.financeAccounts = await this.apiFetch('/finance/accounts').catch(() => []);
    }
    // Finance — Funds
    async fetchFinanceFunds() {
        this.financeFunds = await this.apiFetch('/finance/funds').catch(() => []);
    }
    // Finance — Chart of Accounts
    async fetchFinanceChart() {
        this.financeChartOfAccounts = await this.apiFetch('/finance/chart').catch(() => []);
    }
    async addFinanceChartCategory(data) {
        const res = await this.apiFetch('/finance/chart', { method: 'POST', body: JSON.stringify(data) });
        await this.fetchFinanceChart();
        return res;
    }
    async updateFinanceChartCategory(id, data) {
        const res = await this.apiFetch(`/finance/chart/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        await this.fetchFinanceChart();
        return res;
    }
    async toggleFinanceChartCategory(id) {
        const res = await this.apiFetch(`/finance/chart/${id}/toggle`, { method: 'PATCH' });
        await this.fetchFinanceChart();
        return res;
    }

    save() {
        console.warn('store.save() is deprecated. Please use specific async updating methods like updateForm().');
    }

    // Users
    getUser(id) { return this.users.find(u => u.id === id); }
    async addUser(u) {
        const res = await this.apiFetch('/users', { method: 'POST', body: JSON.stringify(u) });
        this.users.push(res);
        return res;
    }
    async updateUser(id, d) {
        const res = await this.apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(d) });
        const idx = this.users.findIndex(x => x.id === id);
        if (idx !== -1) this.users[idx] = res;
        if (this.currentUser?.id === id) { this.currentUser = res; localStorage.setItem('crm_user', JSON.stringify(res)); }
        return res;
    }
    async updateEmail(email) {
        return this.updateUser(this.currentUser.id, { email });
    }
    async deleteUser(id) {
        await this.apiFetch(`/users/${id}`, { method: 'DELETE' });
        this.users = this.users.filter(u => u.id !== id);
    }
    async changePassword(userId, oldPassword, newPassword) {
        const res = await fetch(`${this.apiBase}/users/${userId}/change-password`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Erro ao alterar senha');
        }

        return await res.json();
    }

    // People
    getPerson(id) { return this.people.find(p => p.id === id); }
    async addPerson(p) {
        const res = await this.apiFetch('/people', { method: 'POST', body: JSON.stringify(p) });
        this.people.push(res);
        return res;
    }
    async updatePerson(id, d) {
        const res = await this.apiFetch(`/people/${id}`, { method: 'PUT', body: JSON.stringify(d) });
        const idx = this.people.findIndex(x => x.id === id);
        if (idx !== -1) this.people[idx] = res;
        return res;
    }
    async completeConsolidation(id) {
        return this.updatePerson(id, { consolidationStatus: 'COMPLETED' });
    }
    async updatePersonExtraData(id, extraData) {
        return this.updatePerson(id, { extraData: JSON.stringify(extraData) });
    }
    async deletePerson(id) {
        await this.apiFetch(`/people/${id}`, { method: 'DELETE' });
        this.people = this.people.filter(x => x.id !== id);
    }

    // Cells
    getVisibleCells() { return this.hasRole('ADMIN', 'SUPERVISOR') ? this.cells : this.hasRole('LIDER_GERACAO') ? this.cells.filter(c => c.generationId === this.currentUser?.generationId) : this.cells.filter(c => c.leaderId === this.currentUser?.id || c.viceLeaderId === this.currentUser?.id); }
    getCell(id) { return this.cells.find(c => c.id === id); }
    getCellMembers(cid) { return this.people.filter(p => p.cellId === cid && !['Inativo', 'Afastado', 'Mudou-se'].includes(p.status)); }
    getCellAllMembers(cid) { return this.people.filter(p => p.cellId === cid); } // todos, incluindo inativos

    async getMilestones(personId) {
        try { return await this.apiFetch(`/people/${personId}/milestones`); } catch (e) { return []; }
    }
    async addManualMilestone(personId, data) {
        return await this.apiFetch(`/people/${personId}/milestones`, { method: 'POST', body: JSON.stringify(data) });
    }
    async deleteMilestone(personId, milestoneId) {
        return await this.apiFetch(`/people/${personId}/milestones/${milestoneId}`, { method: 'DELETE' });
    }
    async fetchActivityLogs(filters = {}) {
        const q = new URLSearchParams();
        if (filters.action) q.set('action', filters.action);
        if (filters.resource) q.set('resource', filters.resource);
        if (filters.from) q.set('from', filters.from);
        if (filters.to) q.set('to', filters.to);
        if (filters.limit) q.set('limit', filters.limit);
        try { return await this.apiFetch(`/logs?${q.toString()}`); } catch (e) { return []; }
    }
    async clearActivityLogs() {
        return await this.apiFetch('/logs', { method: 'DELETE' });
    }
    async addCell(c) {
        const res = await this.apiFetch('/cells', { method: 'POST', body: JSON.stringify(c) });
        this.cells.push(res);
        this.people = await this.apiFetch('/people'); // Sync assignments
        return res;
    }
    async updateCell(id, d) {
        const res = await this.apiFetch(`/cells/${id}`, { method: 'PUT', body: JSON.stringify(d) });
        const idx = this.cells.findIndex(x => x.id === id);
        if (idx !== -1) this.cells[idx] = res;
        this.people = await this.apiFetch('/people'); // Sync assignments
        return res;
    }
    async deleteCell(id) {
        await this.apiFetch(`/cells/${id}`, { method: 'DELETE' });
        this.cells = this.cells.filter(c => c.id !== id);
        this.people.forEach(p => { if (p.cellId === id) p.cellId = null });
    }

    // EBD — Classes
    async fetchEbdClasses() {
        this.ebdClasses = await this.apiFetch('/ebd/classes') || [];
    }
    async addEbdClass(data) {
        const created = await this.apiFetch('/ebd/classes', { method: 'POST', body: JSON.stringify(data) });
        if (created?.id) {
            // Busca professores do store.users para exibição imediata
            const professor = created.professorId ? (this.users || []).find(u => u.id === created.professorId) || null : null;
            const segundoProfessor = created.segundoProfessorId ? (this.users || []).find(u => u.id === created.segundoProfessorId) || null : null;
            const terceiroProfessor = created.terceiroProfessorId ? (this.users || []).find(u => u.id === created.terceiroProfessorId) || null : null;
            this.ebdClasses = [...this.ebdClasses, { ...created, professor, segundoProfessor, terceiroProfessor, _count: { students: 0 } }];
        }
        return created;
    }
    async updateEbdClass(id, data) {
        const updated = await this.apiFetch(`/ebd/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        if (updated?.id) {
            const professor = updated.professorId ? (this.users || []).find(u => u.id === updated.professorId) || null : null;
            const segundoProfessor = updated.segundoProfessorId ? (this.users || []).find(u => u.id === updated.segundoProfessorId) || null : null;
            const terceiroProfessor = updated.terceiroProfessorId ? (this.users || []).find(u => u.id === updated.terceiroProfessorId) || null : null;
            const existing = this.ebdClasses.find(c => c.id === id);
            this.ebdClasses = this.ebdClasses.map(c => c.id === id
                ? { ...updated, professor, segundoProfessor, terceiroProfessor, _count: existing?._count || { students: 0 } }
                : c);
        }
        return updated;
    }

    // EBD — Alunos
    async getEbdStudents(classId) {
        return await this.apiFetch(`/ebd/classes/${classId}/students`) || [];
    }
    async enrollEbdStudent(classId, personId) {
        const result = await this.apiFetch(`/ebd/classes/${classId}/students`, { method: 'POST', body: JSON.stringify({ personId }) });
        // Atualiza contagem no store local
        this.ebdClasses = this.ebdClasses.map(c => c.id === classId
            ? { ...c, _count: { ...c._count, students: (c._count?.students || 0) + 1 } }
            : c);
        return result;
    }
    async removeEbdStudent(classId, studentId) {
        const result = await this.apiFetch(`/ebd/classes/${classId}/students/${studentId}`, { method: 'DELETE' });
        // Atualiza contagem no store local
        this.ebdClasses = this.ebdClasses.map(c => c.id === classId
            ? { ...c, _count: { ...c._count, students: Math.max(0, (c._count?.students || 1) - 1) } }
            : c);
        return result;
    }

    // EBD — Chamada
    async getEbdAttendance(classId) {
        return await this.apiFetch(`/ebd/classes/${classId}/attendance`) || [];
    }
    async saveEbdAttendance(classId, data) {
        return await this.apiFetch(`/ebd/classes/${classId}/attendance`, { method: 'POST', body: JSON.stringify(data) });
    }

    // EBD — Ofertas
    async getEbdOfferings(classId) {
        return await this.apiFetch(`/ebd/classes/${classId}/offerings`) || [];
    }
    async addEbdOffering(classId, data) {
        return await this.apiFetch(`/ebd/classes/${classId}/offerings`, { method: 'POST', body: JSON.stringify(data) });
    }

    // Generations
    async addGeneration(g) {
        const res = await this.apiFetch('/generations', { method: 'POST', body: JSON.stringify(g) });
        this.generations.push(res);
        return res;
    }
    async updateGeneration(id, d) {
        const res = await this.apiFetch(`/generations/${id}`, { method: 'PUT', body: JSON.stringify(d) });
        const idx = this.generations.findIndex(x => x.id === id);
        if (idx !== -1) {
            this.generations[idx] = res;
        }
        return res;
    }
    async deleteGeneration(id) {
        await this.apiFetch(`/generations/${id}`, { method: 'DELETE' });
        this.generations = this.generations.filter(x => x.id !== id);
    }

    // Visits
    getVisitsForPerson(pid) { return this.visits.filter(v => v.personId === pid).sort((a, b) => b.date.localeCompare(a.date)); }
    async addVisit(v) {
        v.authorId = this.currentUser.id;
        const res = await this.apiFetch('/dash/visits', { method: 'POST', body: JSON.stringify(v) });
        this.visits.unshift(res);
        this.loadInitialData(); // Para atualizar person status
        return res;
    }

    // Notes
    getNotesForPerson(pid) { return this.pastoralNotes.filter(n => n.personId === pid).sort((a, b) => b.date.localeCompare(a.date)); }
    async addNote(n) {
        n.authorId = this.currentUser.id;
        const res = await this.apiFetch('/dash/notes', { method: 'POST', body: JSON.stringify(n) });
        this.pastoralNotes.unshift(res);
        return res;
    }
    async deleteNote(id) {
        await this.apiFetch(`/dash/notes/${id}`, { method: 'DELETE' });
        this.pastoralNotes = this.pastoralNotes.filter(n => n.id !== id);
    }

    // Attendance
    async loadAttendanceForCell(cid) {
        try {
            return await this.apiFetch(`/cells/${cid}/attendance`);
        } catch (e) { return []; }
    }
    // Simplification para frontend sem grandes mudanças
    getAttendanceForCell(cid) { return this.attendance.filter(a => a.cellId === cid); }
    getAttendanceForPerson(pid) { return this.attendance.filter(a => a.records?.some(r => r.personId === pid)); }
    async addAttendance(a) {
        await this.apiFetch(`/cells/${a.cellId}/attendance`, { method: 'POST', body: JSON.stringify(a) });
    }

    // Calendar Events & Exceptions
    getEvents() { return this.events || []; }
    // Events
    async addEvent(e) {
        const res = await this.apiFetch('/events', { method: 'POST', body: JSON.stringify(e) });
        this.events.push(res);
        return res;
    }
    async updateEvent(id, updates) {
        const res = await this.apiFetch(`/events/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
        const idx = this.events.findIndex(x => x.id === id);
        if (idx !== -1) this.events[idx] = res;
        return res;
    }
    async deleteEvent(id) {
        await this.apiFetch(`/events/${id}`, { method: 'DELETE' });
        this.events = this.events.filter(e => e.id !== id);
    }

    evaluateRecurrence(e, targetDateStr) {
        if (!e.recurrence || e.recurrence === 'none') return e.date === targetDateStr;
        const evDate = new Date(e.date + 'T12:00:00');
        const targetDate = new Date(targetDateStr + 'T12:00:00');
        if (targetDate < evDate) return false;

        if (e.recurrence === 'weekly') {
            return evDate.getDay() === targetDate.getDay();
        } else if (e.recurrence === 'monthly-date') {
            return evDate.getDate() === targetDate.getDate();
        } else if (e.recurrence === 'monthly-weekday') {
            if (evDate.getDay() !== targetDate.getDay()) return false;
            const getOccurrence = (d) => Math.floor((d.getDate() - 1) / 7);
            return getOccurrence(evDate) === getOccurrence(targetDate);
        } else if (e.recurrence === 'yearly') {
            return evDate.getDate() === targetDate.getDate() && evDate.getMonth() === targetDate.getMonth();
        }
        return false;
    }

    getEventsForDate(dateStr) {
        const dayEvents = [];
        const dayOfWeekIndex = new Date(dateStr + 'T12:00:00').getDay();
        const dayNamesMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
        const dayName = dayNamesMap[dayOfWeekIndex];
        const isAdminSuper = this.hasRole('ADMIN', 'SUPERVISOR');

        // 1. Birthdays
        let bdays = [...this.people, ...this.users].filter(p => p.birthdate && p.birthdate.slice(5) === dateStr.slice(5));
        if (!isAdminSuper) {
            const myCellIds = this.getVisibleCells().map(c => c.id);
            bdays = bdays.filter(p => myCellIds.includes(p.cellId) || p.id === this.currentUser?.id);
        }
        bdays.forEach(p => dayEvents.push({ type: 'birthday', sortVal: -1, title: `Aniversário: ${p.name}`, person: p }));

        // 2. Cells
        this.getVisibleCells().forEach(c => {
            if (c.meetingDay && c.meetingDay.toLowerCase().startsWith(dayName.toLowerCase().slice(0, 3))) {
                const isCanceled = this.isCellCanceledOnDate(c.id, dateStr) || this.isCellCanceledOnDate('all', dateStr);
                const isJustified = this.getCellJustifications(c.id).find(j => j.date === dateStr);

                let sortVal = -2;
                if (c.meetingTime) {
                    const [h, m] = c.meetingTime.split(':').map(Number);
                    if (!isNaN(h) && !isNaN(m)) sortVal = h + (m / 60) - 0.0001;
                }

                dayEvents.push({
                    type: 'cell',
                    sortVal,
                    title: c.name,
                    time: c.meetingTime,
                    cellId: c.id,
                    isCanceled,
                    isJustified,
                    isRealized: c.__attendanceCache?.includes(dateStr)
                });
            }
        });

        // 3. Global Events
        this.getEvents().forEach(e => {
            if (this.evaluateRecurrence(e, dateStr)) {
                const ex = this.getEventException(e.id, dateStr);
                if (ex && ex.canceled) return;
                const title = ex && ex.newTitle ? ex.newTitle : e.title;
                const isAllDay = !e.startTime;

                let sortVal = 0;
                if (!isAllDay) {
                    const [h, m] = e.startTime.split(':').map(Number);
                    sortVal = h + (m / 60);
                }

                dayEvents.push({
                    type: 'event',
                    sortVal,
                    title,
                    time: e.startTime,
                    color: e.color || 'blue',
                    icon: e.icon || (e.category === 'geral' ? '🌐' : '🏘️'),
                    description: e.description,
                    category: e.category,
                    eventId: e.id,
                    recurrence: e.recurrence
                });
            }
        });

        return dayEvents.sort((a, b) => a.sortVal - b.sortVal);
    }

    getWeeklySchedule() {
        const schedule = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const events = this.getEventsForDate(dateStr);
            schedule.push({ date: dateStr, events });
        }
        return schedule;
    }
    getEventException(eventId, date) {
        // Cache de exceptions carregado pelo loadEvents ou setEventException
        if (!this._eventExceptions) return null;
        return (this._eventExceptions[eventId] || []).find(ex => ex.date === date) || null;
    }
    async setEventException(eventId, date, canceled, newTitle) {
        await this.apiFetch(`/events/${eventId}/exceptions`, {
            method: 'POST',
            body: JSON.stringify({ date, canceled, newTitle })
        });
        // Atualiza cache local
        if (!this._eventExceptions) this._eventExceptions = {};
        if (!this._eventExceptions[eventId]) this._eventExceptions[eventId] = [];
        const existing = this._eventExceptions[eventId].find(ex => ex.date === date);
        if (existing) {
            existing.canceled = canceled;
            existing.newTitle = newTitle;
        } else {
            this._eventExceptions[eventId].push({ eventId, date, canceled, newTitle });
        }
    }

    async toggleCellCancellation(cellId, date, authorId) {
        try {
            const res = await this.apiFetch(`/cells/${cellId}/cancel`, {
                method: 'POST',
                body: JSON.stringify({ date, authorId })
            });
            if (res.canceled) {
                this.cellCancellations.push({ cellId, date, authorId });
            } else {
                this.cellCancellations = this.cellCancellations.filter(c => !(c.cellId === cellId && c.date === date));
            }
        } catch (e) {
            console.error('Error toggling cancellation', e);
        }
    }
    isCellCanceledOnDate(cellId, date) {
        if (!this.cellCancellations) return false;
        return this.cellCancellations.some(c => c.cellId === cellId && c.date === date);
    }
    async justifyCellAbsence(cellId, date, reason, authorId) {
        try {
            const j = await this.apiFetch(`/cells/${cellId}/justify`, {
                method: 'POST',
                body: JSON.stringify({ date, reason, authorId })
            });
            this.cellJustifications.push(j);
            return j;
        } catch (e) {
            console.error('Error justifying absence', e);
            throw e;
        }
    }
    getCellJustifications(cellId) {
        return this.cellJustifications.filter(j => j.cellId === cellId);
    }

    // Tracks (Spiritual & Retreats)
    async addTrack(t) {
        const res = await this.apiFetch('/dash/tracks', { method: 'POST', body: JSON.stringify(t) });
        this.tracks.push(res);
        return res;
    }
    async updateTrack(id, d) {
        const res = await this.apiFetch(`/dash/tracks/${id}`, { method: 'PUT', body: JSON.stringify(d) });
        const idx = this.tracks.findIndex(x => x.id === id);
        if (idx !== -1) this.tracks[idx] = res;
        return res;
    }
    async deleteTrack(id) {
        await this.apiFetch(`/dash/tracks/${id}`, { method: 'DELETE' });
        this.tracks = this.tracks.filter(t => t.id !== id);
    }

    // Forms
    getForm(id) { return this.forms.find(f => f.id === id); }
    async addForm(f) {
        const res = await this.apiFetch('/forms', { method: 'POST', body: JSON.stringify(f) });
        this.forms.push(res);
        return res;
    }
    async updateForm(id, d) {
        const res = await this.apiFetch(`/forms/${id}`, { method: 'PUT', body: JSON.stringify(d) });
        const idx = this.forms.findIndex(x => x.id === id);
        if (idx !== -1) this.forms[idx] = res;
        return res;
    }
    async deleteForm(id) {
        await this.apiFetch(`/forms/${id}`, { method: 'DELETE' });
        this.forms = this.forms.filter(f => f.id !== id);
    }

    // Triage
    async addTriage(t) {
        const res = await this.apiFetch('/forms/triage/new', { method: 'POST', body: JSON.stringify(t) });
        this.triageQueue.unshift(res);
        return res;
    }
    async updateTriage(id, status, payload = null) {
        const bodyObj = { status };
        if (payload) bodyObj.payload = payload;
        const res = await this.apiFetch(`/forms/triage/${id}`, { method: 'PUT', body: JSON.stringify(bodyObj) });
        const idx = this.triageQueue.findIndex(x => x.id === id);
        if (idx !== -1) this.triageQueue[idx] = res;
        return res;
    }
    async deleteTriage(id) {
        await this.apiFetch(`/forms/triage/${id}`, { method: 'DELETE' });
        this.triageQueue = this.triageQueue.filter(t => t.id !== id);
    }

    // Notifications (Usando a base de cache local que montamos)
    getNotifications() { return this.notifications; }

    async markNotificationsAsRead() {
        if (!this.currentUser) return;
        try {
            await this.apiFetch('/dash/notifications/read', {
                method: 'PUT',
                body: JSON.stringify({ userId: this.currentUser.id })
            });
            this.notifications = [];
        } catch (e) {
            console.error('Failed to mark notifications read', e);
        }
    }

    markNotifRead(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.apiFetch(`/dash/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
    }
    markAllNotifsRead() { return this.markNotificationsAsRead(); }

    // Metrics
    async fetchMetrics() {
        try {
            let url = '/dash/metrics';
            if (!this.hasRole('ADMIN', 'SUPERVISOR') && this.currentUser) {
                url += `?userId=${this.currentUser.id}`;
            }
            const m = await this.apiFetch(url);
            // Sincroniza a config retornada pelo metrics no store
            if (m?.config) this.config = m.config;
            return m;
        } catch (e) { return null; }
    }

    // System Config
    async fetchConfig() {
        try {
            const res = await this.apiFetch('/dash/config');
            this.config = res.dashboardActions || {};
            return this.config;
        } catch (e) { return {}; }
    }

    async saveConfig(dashboardActions) {
        if (!this.hasRole('ADMIN')) throw new Error('Apenas administradores');
        const res = await this.apiFetch('/dash/config', {
            method: 'PUT',
            body: JSON.stringify({ dashboardActions, role: this.currentUser.role })
        });
        this.config = res.dashboardActions || dashboardActions;
        return this.config;
    }

    // Backup & Restore
    async downloadBackup() {
        if (!this.token) throw new Error('Not authenticated');
        const res = await fetch(`${this.apiBase}/admin/backup`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!res.ok) throw new Error('Falha ao gerar backup');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-igreja-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    async restoreBackup(data) {
        return this.apiFetch('/admin/restore', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
}

export const store = new Store();
