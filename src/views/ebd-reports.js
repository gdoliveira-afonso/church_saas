import { store } from '../store.js';
import { header, toast, bottomNav } from '../components/ui.js';

export function ebdReportsView() {
    const app = document.getElementById('app');
    const currentY = new Date().getFullYear();

    if (!store.systemSettings?.ebdEnabled) {
        toast('Módulo EBD está desativado.', 'error');
        window.location.hash = '/dashboard';
        return;
    }
    if (!store.hasRole('ADMIN', 'SUPERVISOR') && !store.hasSecondaryRole('SUPERINTENDENTE_EBD')) {
        toast('Acesso restrito', 'error');
        window.location.hash = '/ebd';
        return;
    }

    // ── Estado ──────────────────────────────────────────────────────────────
    let activeTab    = 'turmas'; // 'turmas' | 'membros'
    let filterY      = currentY;
    let filterM      = new Date().getMonth(); // 0–11 ou -1 = Ano Inteiro
    let filterClass  = '';
    let filterRole   = ''; // '' | 'professor' | 'segundo_professor' | 'aluno'
    let search       = '';
    let visibleCols  = {};
    let allStudents  = null;
    let loadingStudents = false;

    const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    const EBD_COLS = [
        { id: 'perfil',        label: 'Perfil' },
        { id: 'turma',         label: 'Turma / Classe' },
        { id: 'telefone',      label: 'Telefone' },
        { id: 'status_pessoa', label: 'Status Pessoa' },
        { id: 'frequencia',    label: 'Frequência (%)' },
    ];

    function getPeriodLabel() {
        return filterM === -1 ? `Ano de ${filterY}` : `${MONTHS[filterM]} de ${filterY}`;
    }

    function matchesPeriod(dateStr) {
        if (!dateStr) return false;
        const [y, m] = dateStr.split('-').map(Number);
        return filterM === -1 ? y === filterY : y === filterY && m - 1 === filterM;
    }

    // ── Computar dados Turmas ────────────────────────────────────────────────
    function computeTurmasData() {
        let visibleClasses = store.ebdClasses || [];
        if (filterClass) visibleClasses = visibleClasses.filter(c => c.id === filterClass);
        const visibleClassIds = new Set(visibleClasses.map(c => c.id));

        const attInPeriod = (store.ebdAttendance || []).filter(a =>
            visibleClassIds.has(a.ebdClassId) && matchesPeriod(a.data)
        );
        const offInPeriod = (store.ebdOfferings || []).filter(o =>
            visibleClassIds.has(o.ebdClassId) && matchesPeriod(o.data)
        );

        const totalAlunos = visibleClasses.reduce((s, c) => s + (c._count?.students || 0), 0);

        let totalPresent = 0, totalRecords = 0;
        attInPeriod.forEach(a => {
            (a.records || []).forEach(r => { totalRecords++; if (r.presente) totalPresent++; });
        });
        const freqPct = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
        const totalOfferings = offInPeriod.reduce((s, o) => s + (parseFloat(o.valor) || 0), 0);

        const classMap = {};
        visibleClasses.forEach(c => {
            classMap[c.id] = { ...c, aulas: 0, present: 0, totalRec: 0, offerings: 0 };
        });
        attInPeriod.forEach(a => {
            if (!classMap[a.ebdClassId]) return;
            classMap[a.ebdClassId].aulas++;
            (a.records || []).forEach(r => {
                classMap[a.ebdClassId].totalRec++;
                if (r.presente) classMap[a.ebdClassId].present++;
            });
        });
        offInPeriod.forEach(o => {
            if (classMap[o.ebdClassId]) classMap[o.ebdClassId].offerings += parseFloat(o.valor) || 0;
        });
        const classData = Object.values(classMap);

        // Frequência por aluno no período
        const personMap = {};
        attInPeriod.forEach(a => {
            const className = a.ebdClass?.name || '';
            (a.records || []).forEach(r => {
                const person = r.ebdStudent?.person;
                if (!person) return;
                if (!personMap[person.id])
                    personMap[person.id] = { id: person.id, name: person.name, classe: className, total: 0, present: 0 };
                personMap[person.id].total++;
                if (r.presente) personMap[person.id].present++;
            });
        });
        let studentsArr = Object.values(personMap);
        if (search) {
            const s = search.toLowerCase();
            studentsArr = studentsArr.filter(p => p.name?.toLowerCase().includes(s));
        }

        return {
            visibleClasses, classData, studentsArr,
            totalAlunos, freqPct, totalOfferings,
            totalAulas: attInPeriod.length,
            periodLabel: getPeriodLabel()
        };
    }

    // ── Computar dados Membros ───────────────────────────────────────────────
    function computeMembrosData() {
        const classes = store.ebdClasses || [];
        const users   = store.users || [];

        const personFreqMap = {};
        (store.ebdAttendance || []).forEach(att => {
            (att.records || []).forEach(r => {
                const pid = r.ebdStudent?.person?.id;
                if (!pid) return;
                if (!personFreqMap[pid]) personFreqMap[pid] = { total: 0, present: 0 };
                personFreqMap[pid].total++;
                if (r.presente) personFreqMap[pid].present++;
            });
        });

        const rows = [];

        const parseSecRoles = (u) => Array.isArray(u.secondaryRoles)
            ? u.secondaryRoles
            : (() => { try { return JSON.parse(u.secondaryRoles || '[]'); } catch { return []; } })();

        // Professores
        if (!filterRole || filterRole === 'professor') {
            users.forEach(u => {
                if (!parseSecRoles(u).includes('PROFESSOR')) return;
                const classesProf = classes.filter(c => c.professorId === u.id);
                if (filterClass && !classesProf.some(c => c.id === filterClass)) return;
                const classNames = classesProf.length ? classesProf.map(c => c.name).join(', ') : '—';
                rows.push({ name: u.name, role: 'Professor', roleKey: 'professor', classe: classNames, phone: u.phone || '', status: '', freq: null });
            });
        }

        // Segundos Professores
        if (!filterRole || filterRole === 'segundo_professor') {
            users.forEach(u => {
                if (!parseSecRoles(u).includes('SEGUNDO_PROFESSOR')) return;
                const classesProf = classes.filter(c => c.segundoProfessorId === u.id);
                if (filterClass && !classesProf.some(c => c.id === filterClass)) return;
                const classNames = classesProf.length ? classesProf.map(c => c.name).join(', ') : '—';
                rows.push({ name: u.name, role: '2º Professor', roleKey: 'segundo_professor', classe: classNames, phone: u.phone || '', status: '', freq: null });
            });
        }

        // Alunos
        if (!filterRole || filterRole === 'aluno') {
            (allStudents || []).forEach(s => {
                if (filterClass && s.ebdClassId !== filterClass) return;
                const fq = personFreqMap[s.personId] || personFreqMap[s.person?.id];
                const freqPct = fq && fq.total > 0 ? Math.round((fq.present / fq.total) * 100) : null;
                rows.push({
                    name: s.person?.name || '—',
                    role: 'Aluno',
                    roleKey: 'aluno',
                    classe: s.ebdClass?.name || '—',
                    phone: s.person?.phone || '',
                    status: s.person?.status || '',
                    ativo: s.ativo,
                    freq: freqPct,
                    freqPresent: fq?.present ?? null,
                    freqTotal: fq?.total ?? null
                });
            });
        }

        const q = search.toLowerCase();
        const filtered = q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows;
        const roleOrder = { professor: 0, segundo_professor: 1, aluno: 2 };
        filtered.sort((a, b) => (roleOrder[a.roleKey] - roleOrder[b.roleKey]) || a.name.localeCompare(b.name));

        return filtered;
    }

    // ── Helpers visuais ──────────────────────────────────────────────────────
    function kpi(icon, label, value, color) {
        const bg = { blue: 'bg-blue-50 text-blue-500', purple: 'bg-purple-50 text-purple-500', emerald: 'bg-emerald-50 text-emerald-500', amber: 'bg-amber-50 text-amber-500', red: 'bg-red-50 text-red-500' };
        return `<div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
            <div class="w-10 h-10 rounded-full ${bg[color] || 'bg-slate-100 text-slate-500'} flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined">${icon}</span>
            </div>
            <div>
                <p class="text-xl font-extrabold text-slate-800">${value}</p>
                <p class="text-[11px] text-slate-500">${label}</p>
            </div>
        </div>`;
    }

    function renderColSettings() {
        return `<div class="mb-4 flex flex-wrap gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p class="w-full text-[10px] font-bold text-slate-400 uppercase tracking-wider">Colunas visíveis</p>
            ${EBD_COLS.map(col => `
                <label class="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 select-none">
                    <input type="checkbox" class="col-toggle w-3.5 h-3.5 accent-primary" data-col="${col.id}" ${visibleCols[col.id] !== false ? 'checked' : ''} />
                    ${col.label}
                </label>
            `).join('')}
        </div>`;
    }

    // ── Tabela Turmas ────────────────────────────────────────────────────────
    function turmasTable(d) {
        return `<table class="w-full text-left text-xs">
            <thead>
                <tr class="sticky top-0 bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider z-10">
                    <th class="px-3 py-2.5 rounded-l-lg">Classe</th>
                    <th class="px-3 py-2.5">Professor</th>
                    <th class="px-3 py-2.5 text-center">Alunos</th>
                    <th class="px-3 py-2.5 text-center">Aulas</th>
                    <th class="px-3 py-2.5 text-center text-emerald-600">Presenças</th>
                    <th class="px-3 py-2.5 text-center text-red-500">Faltas</th>
                    <th class="px-3 py-2.5 text-center">% Presença</th>
                    <th class="px-3 py-2.5 text-center rounded-r-lg">Ofertas</th>
                </tr>
            </thead>
            <tbody>
                ${d.classData.length ? d.classData.map(c => {
                    const pct = c.totalRec > 0 ? Math.round((c.present / c.totalRec) * 100) : 0;
                    return `<tr class="border-b border-slate-50 hover:bg-blue-50/30 transition cursor-pointer" onclick="location.hash='/ebd/class?id=${c.id}'">
                        <td class="px-3 py-2.5 font-semibold text-primary">${c.name}</td>
                        <td class="px-3 py-2.5 text-slate-500">${c.professor?.name || '—'}</td>
                        <td class="px-3 py-2.5 text-center font-bold">${c._count?.students || 0}</td>
                        <td class="px-3 py-2.5 text-center text-slate-500">${c.aulas}</td>
                        <td class="px-3 py-2.5 text-center font-bold text-emerald-600">${c.present}</td>
                        <td class="px-3 py-2.5 text-center font-bold text-red-500">${c.totalRec - c.present}</td>
                        <td class="px-3 py-2.5 text-center">
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${pct >= 70 ? 'bg-emerald-50 text-emerald-700' : pct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}">${pct}%</span>
                        </td>
                        <td class="px-3 py-2.5 text-center text-emerald-600 font-medium">R$ ${c.offerings.toFixed(2).replace('.', ',')}</td>
                    </tr>`;
                }).join('') : '<tr><td colspan="8" class="text-center text-slate-400 py-8">Nenhuma classe encontrada no período</td></tr>'}
            </tbody>
        </table>`;
    }

    // ── Tabela Membros ───────────────────────────────────────────────────────
    function membrosTable() {
        if (loadingStudents || allStudents === null) {
            return `<div class="flex items-center justify-center py-16 text-slate-400">
                <span class="material-symbols-outlined animate-spin mr-2">refresh</span>Carregando membros...
            </div>`;
        }

        const rows = computeMembrosData();
        const vc = visibleCols;

        const roleBadge = {
            professor:         'bg-blue-50 text-blue-700 ring-blue-600/10',
            segundo_professor: 'bg-indigo-50 text-indigo-700 ring-indigo-600/10',
            aluno:             'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
        };
        const roleLabel = { professor: 'Professor', segundo_professor: '2º Professor', aluno: 'Aluno' };

        const freqBadge = (freq, present, total) => {
            if (freq === null || total === null) return '<span class="text-slate-300">—</span>';
            const absent = total - present;
            const cls = freq >= 70 ? 'bg-emerald-50 text-emerald-700' : freq >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
            return `<div class="flex flex-col items-center gap-0.5">
                <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}">${freq}%</span>
                <span class="text-[9px] text-slate-400"><span class="text-emerald-600 font-semibold">${present}P</span> · <span class="text-red-500 font-semibold">${absent}F</span></span>
            </div>`;
        };

        if (!rows.length) return `<div class="flex flex-col items-center justify-center py-16 text-slate-400">
            <span class="material-symbols-outlined text-5xl mb-3 opacity-30">search_off</span>
            <p class="text-sm">Nenhuma pessoa encontrada com os filtros selecionados</p>
        </div>`;

        return `<table class="w-full text-left text-xs">
            <thead>
                <tr class="sticky top-0 bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider z-10">
                    <th class="px-3 py-2.5 rounded-l-lg">Nome</th>
                    ${vc.perfil !== false ? '<th class="px-3 py-2.5">Perfil</th>' : ''}
                    ${vc.turma !== false ? '<th class="px-3 py-2.5">Turma / Classe</th>' : ''}
                    ${vc.telefone !== false ? '<th class="px-3 py-2.5">Telefone</th>' : ''}
                    ${vc.status_pessoa !== false ? '<th class="px-3 py-2.5">Status</th>' : ''}
                    ${vc.frequencia !== false ? '<th class="px-3 py-2.5 text-center rounded-r-lg">Frequência</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${rows.map(r => `<tr class="border-b border-slate-50 hover:bg-blue-50/30 transition">
                    <td class="px-3 py-2.5 font-semibold text-slate-800">${r.name}</td>
                    ${vc.perfil !== false ? `<td class="px-3 py-2.5">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1 ring-inset ${roleBadge[r.roleKey]}">${roleLabel[r.roleKey]}</span>
                    </td>` : ''}
                    ${vc.turma !== false ? `<td class="px-3 py-2.5 text-slate-500">${r.classe}</td>` : ''}
                    ${vc.telefone !== false ? `<td class="px-3 py-2.5 text-slate-400">${r.phone || '—'}</td>` : ''}
                    ${vc.status_pessoa !== false ? `<td class="px-3 py-2.5 text-slate-400">${r.status || '—'}</td>` : ''}
                    ${vc.frequencia !== false ? `<td class="px-3 py-2.5 text-center">${freqBadge(r.freq, r.freqPresent, r.freqTotal)}</td>` : ''}
                </tr>`).join('')}
            </tbody>
        </table>`;
    }

    // ── Render principal ─────────────────────────────────────────────────────
    function render() {
        const d = computeTurmasData();
        const arrYears = [];
        for (let i = currentY + 1; i >= currentY - 4; i--) arrYears.push(i);

        app.innerHTML = `
        ${header('Relatórios EBD', true)}
        <div class="flex-1 overflow-y-auto w-full overflow-x-hidden" id="report-content">
            <div class="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-10 py-5 space-y-5">

                <!-- Filtros -->
                <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
                    <div>
                        <h2 class="text-lg font-extrabold flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary">analytics</span>Painel EBD
                        </h2>
                        <p class="text-[11px] text-slate-400 mt-0.5">${d.periodLabel} • ${d.visibleClasses.length} classe(s)</p>
                    </div>
                    <div class="flex flex-col md:flex-row gap-2 flex-wrap">
                        <!-- Mês -->
                        <select id="f-month" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px] appearance-auto">
                            <option value="-1" ${filterM === -1 ? 'selected' : ''}>Ano Inteiro</option>
                            ${MONTHS.map((m, idx) => `<option value="${idx}" ${filterM === idx ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                        <!-- Ano -->
                        <select id="f-year" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 min-w-[100px] appearance-auto">
                            ${arrYears.map(y => `<option value="${y}" ${filterY === y ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                        <div class="w-full md:w-px md:h-9 bg-slate-200 mx-1 hidden md:block"></div>
                        <!-- Turma -->
                        <select id="f-class" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]">
                            <option value="">Todas as Turmas</option>
                            ${(store.ebdClasses || []).map(c => `<option value="${c.id}" ${filterClass === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                        <!-- Status / Perfil -->
                        <select id="f-role" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]">
                            <option value="" ${filterRole === '' ? 'selected' : ''}>Todos os Status</option>
                            <option value="professor" ${filterRole === 'professor' ? 'selected' : ''}>Professor</option>
                            <option value="segundo_professor" ${filterRole === 'segundo_professor' ? 'selected' : ''}>2º Professor</option>
                            <option value="aluno" ${filterRole === 'aluno' ? 'selected' : ''}>Aluno</option>
                        </select>
                        <!-- Busca -->
                        <div class="relative flex-1 min-w-[180px]">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-lg">search</span>
                            <input id="f-search" type="text" value="${search}" placeholder="Buscar por nome..." class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
                        </div>
                    </div>
                </div>

                <!-- KPIs -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    ${kpi('school', 'Alunos Matriculados', d.totalAlunos, 'blue')}
                    ${kpi('local_library', 'Aulas no Período', d.totalAulas, 'purple')}
                    ${kpi('how_to_reg', 'Freq. Média', d.freqPct + '%', d.freqPct >= 70 ? 'emerald' : d.freqPct >= 50 ? 'amber' : 'red')}
                    ${kpi('volunteer_activism', 'Total Ofertas', 'R$ ' + d.totalOfferings.toFixed(2).replace('.', ','), 'emerald')}
                </div>

                <!-- Tabela Detalhada -->
                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <h3 class="text-sm font-bold flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary text-lg">table_chart</span>Relatório Detalhado
                        </h3>
                        <div class="flex flex-wrap gap-1.5">
                            <button class="inner-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${activeTab === 'turmas' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}" data-tab="turmas">
                                <span class="material-symbols-outlined text-sm">menu_book</span>Turmas
                            </button>
                            <button class="inner-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${activeTab === 'membros' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}" data-tab="membros">
                                <span class="material-symbols-outlined text-sm">school</span>Membros
                            </button>
                        </div>
                    </div>
                    <div id="col-settings-container" class="${activeTab === 'membros' ? '' : 'hidden'}">
                        ${renderColSettings()}
                    </div>
                    <div id="report-table" class="overflow-x-auto max-h-[600px] overflow-y-auto"></div>
                </div>

                <!-- Export -->
                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <h3 class="text-sm font-bold flex items-center gap-2 mb-4">
                        <span class="material-symbols-outlined text-primary text-lg">download</span>Exportar Relatório
                    </h3>
                    <div class="space-y-3 max-w-lg mx-auto">
                        <button id="exp-pdf" class="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white py-3.5 rounded-xl text-sm font-bold hover:from-red-600 hover:to-red-700 active:scale-[.98] transition-all shadow-md shadow-red-200/50">
                            <span class="material-symbols-outlined text-lg">picture_as_pdf</span>Gerar PDF
                        </button>
                        <button id="exp-excel" class="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-sm font-bold active:scale-[.98] transition-all shadow-sm">
                            <span class="material-symbols-outlined text-lg">grid_on</span>Exportar .xlsx
                        </button>
                    </div>
                </div>

            </div>
        </div>
        ${bottomNav('ebd')}`;

        bindEvents(d);
    }

    // ── Trocar aba interna ───────────────────────────────────────────────────
    function showTab(tab) {
        activeTab = tab;

        document.querySelectorAll('.inner-tab').forEach(b => {
            const active = b.dataset.tab === tab;
            b.classList.toggle('bg-primary', active);
            b.classList.toggle('text-white', active);
            b.classList.toggle('bg-slate-100', !active);
            b.classList.toggle('text-slate-500', !active);
            b.classList.remove('hover:bg-slate-200');
            if (!active) b.classList.add('hover:bg-slate-200');
        });

        const rt  = document.getElementById('report-table');
        const csc = document.getElementById('col-settings-container');

        if (tab === 'turmas') {
            if (csc) csc.classList.add('hidden');
            if (rt) rt.innerHTML = turmasTable(computeTurmasData());
        } else {
            if (csc) { csc.innerHTML = renderColSettings(); csc.classList.remove('hidden'); }
            if (allStudents === null) {
                loadStudents();
            } else {
                if (rt) rt.innerHTML = membrosTable();
                bindColToggles();
            }
        }
    }

    function bindColToggles() {
        document.querySelectorAll('.col-toggle').forEach(cb => {
            cb.addEventListener('change', e => {
                visibleCols[e.target.dataset.col] = e.target.checked;
                const rt = document.getElementById('report-table');
                if (rt) rt.innerHTML = membrosTable();
                bindColToggles();
            });
        });
    }

    // ── Bind de eventos ──────────────────────────────────────────────────────
    function bindEvents(d) {
        document.getElementById('f-month')?.addEventListener('change', e => { filterM = parseInt(e.target.value); render(); });
        document.getElementById('f-year')?.addEventListener('change', e => { filterY = parseInt(e.target.value); render(); });
        document.getElementById('f-class')?.addEventListener('change', e => { filterClass = e.target.value; render(); });
        document.getElementById('f-role')?.addEventListener('change', e => { filterRole = e.target.value; render(); });
        document.getElementById('f-search')?.addEventListener('input', e => {
            search = e.target.value;
            const pos = e.target.selectionStart;
            render();
            const inp = document.getElementById('f-search');
            if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
        });

        document.querySelectorAll('.inner-tab').forEach(btn => {
            btn.addEventListener('click', () => showTab(btn.dataset.tab));
        });

        document.getElementById('exp-pdf')?.addEventListener('click', () =>
            activeTab === 'turmas' ? exportTurmasPdf(d) : exportAlunosPdf()
        );
        document.getElementById('exp-excel')?.addEventListener('click', () =>
            activeTab === 'turmas' ? exportTurmasExcel(d) : exportAlunosExcel()
        );

        // Carrega conteúdo da aba ativa
        showTab(activeTab);
    }

    // ── Carregar alunos ──────────────────────────────────────────────────────
    async function loadStudents() {
        loadingStudents = true;
        const rt = document.getElementById('report-table');
        if (rt) rt.innerHTML = `<div class="flex items-center justify-center py-16 text-slate-400">
            <span class="material-symbols-outlined animate-spin mr-2">refresh</span>Carregando membros...
        </div>`;
        try {
            allStudents = await store.apiFetch('/ebd/students/all');
        } catch (err) {
            toast('Erro ao carregar alunos', 'error');
            allStudents = [];
        } finally {
            loadingStudents = false;
            const csc = document.getElementById('col-settings-container');
            if (csc) { csc.innerHTML = renderColSettings(); csc.classList.remove('hidden'); }
            const rt2 = document.getElementById('report-table');
            if (rt2) rt2.innerHTML = membrosTable();
            bindColToggles();
        }
    }

    // ── Excel Turmas ─────────────────────────────────────────────────────────
    function exportTurmasExcel(d) {
        if (typeof window.XLSX === 'undefined') { toast('Biblioteca Excel não carregada', 'warning'); return; }
        const classeRows = d.classData.map(c => {
            const pct = c.totalRec > 0 ? Math.round((c.present / c.totalRec) * 100) : 0;
            return {
                'Classe': c.name,
                'Professor': c.professor?.name || '',
                'Alunos Matriculados': c._count?.students || 0,
                'Aulas no Período': c.aulas,
                'Presenças': c.present,
                'Total de Chamadas': c.totalRec,
                'Frequência (%)': `${pct}%`,
                'Ofertas (R$)': c.offerings.toFixed(2)
            };
        });
        const alunoRows = d.studentsArr.map(p => {
            const pct = p.total > 0 ? Math.round((p.present / p.total) * 100) : 0;
            return { 'Aluno': p.name, 'Classe': p.classe, 'Aulas': p.total, 'Presenças': p.present, 'Frequência (%)': `${pct}%` };
        }).sort((a, b) => parseInt(b['Frequência (%)']) - parseInt(a['Frequência (%)']));

        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(classeRows), 'Resumo_Classes');
        window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(alunoRows), 'Alunos_Frequencia');
        const blob = new Blob([window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' })],
            { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Relatorio_EBD_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        toast('Relatório exportado!');
    }

    // ── Excel Membros ─────────────────────────────────────────────────────────
    function exportAlunosExcel() {
        if (typeof window.XLSX === 'undefined') { toast('Biblioteca Excel não carregada', 'warning'); return; }
        const rows = computeMembrosData();
        const vc = visibleCols;
        const roleLabel = { professor: 'Professor', segundo_professor: '2º Professor', aluno: 'Aluno' };

        const data = rows.map(r => {
            const obj = { 'Nome': r.name };
            if (vc.perfil !== false)        obj['Perfil']         = roleLabel[r.roleKey] || r.role;
            if (vc.turma !== false)         obj['Turma / Classe'] = r.classe;
            if (vc.telefone !== false)      obj['Telefone']       = r.phone || '';
            if (vc.status_pessoa !== false) obj['Status']         = r.status || '';
            if (vc.frequencia !== false)    obj['Frequência (%)'] = r.freq !== null ? `${r.freq}%` : '—';
            return obj;
        });

        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(data), 'Membros_EBD');
        const blob = new Blob([window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' })],
            { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Membros_EBD_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        toast('Lista exportada!');
    }

    // ── PDF Turmas ────────────────────────────────────────────────────────────
    async function exportTurmasPdf(d) {
        const btn = document.getElementById('exp-pdf');
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">refresh</span> Gerando...';
        btn.disabled = true;
        try {
            const s = store.systemSettings || {};
            const payload = {
                logoUrl: s.logoUrl || null,
                appName: s.appName || s.congregationName || 'CRM Celular',
                congregationName: s.congregationName || '',
                congregationAddress: s.congregationAddress || '',
                pastorName: s.pastorName || '',
                periodLabel: d.periodLabel,
                totalClasses: d.visibleClasses.length,
                totalAlunos: d.totalAlunos,
                totalAulas: d.totalAulas,
                freqPct: d.freqPct,
                totalOfferings: d.totalOfferings,
                classData: d.classData.map(c => ({
                    name: c.name,
                    professor: c.professor ? { name: c.professor.name } : null,
                    _count: c._count,
                    aulas: c.aulas,
                    present: c.present,
                    totalRec: c.totalRec,
                    offerings: c.offerings
                })),
                studentsArr: d.studentsArr
            };
            const res = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.token}` },
                body: JSON.stringify({ type: 'ebd', payload })
            });
            if (!res.ok) throw new Error('Erro ao gerar PDF');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `Relatorio_EBD_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a); a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
            toast('PDF gerado com sucesso!');
        } catch (err) {
            toast(err.message || 'Erro ao gerar PDF', 'error');
        } finally {
            btn.innerHTML = orig; btn.disabled = false;
        }
    }

    // ── PDF Membros ───────────────────────────────────────────────────────────
    async function exportAlunosPdf() {
        const btn = document.getElementById('exp-pdf');
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">refresh</span> Gerando...';
        btn.disabled = true;
        try {
            const s = store.systemSettings || {};
            const rows = computeMembrosData();
            const roleLabel = { professor: 'Professor', segundo_professor: '2º Professor', aluno: 'Aluno' };
            const filterLabel = filterClass
                ? (store.ebdClasses || []).find(c => c.id === filterClass)?.name || 'Turma'
                : 'Todas as Turmas';
            const roleFilterLabel = filterRole
                ? { professor: 'Professores', segundo_professor: '2º Professores', aluno: 'Alunos' }[filterRole]
                : 'Todos os Perfis';
            const payload = {
                logoUrl: s.logoUrl || null,
                appName: s.appName || s.congregationName || 'CRM Celular',
                congregationName: s.congregationName || '',
                congregationAddress: s.congregationAddress || '',
                pastorName: s.pastorName || '',
                periodLabel: `${filterLabel} • ${roleFilterLabel}`,
                totalClasses: (store.ebdClasses || []).length,
                totalAlunos: rows.filter(r => r.roleKey === 'aluno').length,
                visibleCols: { ...visibleCols },
                rows: rows.map(r => ({
                    name: r.name,
                    role: roleLabel[r.roleKey] || r.role,
                    classe: r.classe,
                    phone: r.phone || '',
                    status: r.status || '',
                    freq: r.freq
                }))
            };
            const res = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.token}` },
                body: JSON.stringify({ type: 'ebd_people', payload })
            });
            if (!res.ok) throw new Error('Erro ao gerar PDF');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `Membros_EBD_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a); a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
            toast('PDF gerado com sucesso!');
        } catch (err) {
            toast(err.message || 'Erro ao gerar PDF', 'error');
        } finally {
            btn.innerHTML = orig; btn.disabled = false;
        }
    }

    render();
}
