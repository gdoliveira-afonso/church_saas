import { store } from '../store.js';
import { header, toast, bottomNav } from '../components/ui.js';

export function ebdReportsView() {
    const app = document.getElementById('app');
    const currentY = new Date().getFullYear();
    let filterY = currentY;
    let filterM = new Date().getMonth(); // 0 a 11, ou -1 para Ano Inteiro
    let filterClass = '';
    let search = '';

    if (!store.systemSettings?.ebdEnabled) {
        toast('Módulo EBD está desativado.', 'error');
        window.location.hash = '/dashboard';
        return;
    }
    if (!store.hasRole('ADMIN', 'SUPERVISOR')) {
        toast('Acesso restrito', 'error');
        window.location.hash = '/dashboard';
        return;
    }

    const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    function getPeriodLabel() {
        if (filterM === -1) return `Ano de ${filterY}`;
        return `${MONTHS[filterM]} de ${filterY}`;
    }

    // Filtra lista por data ("YYYY-MM-DD")
    function matchesPeriod(dateStr) {
        if (!dateStr) return false;
        const [y, m] = dateStr.split('-').map(Number);
        if (filterM === -1) return y === filterY;
        return y === filterY && m - 1 === filterM;
    }

    function computeData() {
        // store.ebdAttendance: [{ id, ebdClassId, data, ebdClass:{id,name}, records:[{presente, student:{personId, person:{id,name}}}] }]
        // store.ebdOfferings:  [{ id, ebdClassId, data, valor, ebdClass:{id,name}, registradoPor:{name} }]
        // store.ebdClasses:    [{ id, name, faixaEtaria, sala, professorId, professor:{name}, _count:{students} }]

        let visibleClasses = store.ebdClasses || [];
        if (filterClass) visibleClasses = visibleClasses.filter(c => c.id === filterClass);
        const visibleClassIds = new Set(visibleClasses.map(c => c.id));

        // Chamadas no período das classes visíveis
        const attInPeriod = (store.ebdAttendance || []).filter(a =>
            visibleClassIds.has(a.ebdClassId) && matchesPeriod(a.data)
        );

        // Ofertas no período das classes visíveis
        const offInPeriod = (store.ebdOfferings || []).filter(o =>
            visibleClassIds.has(o.ebdClassId) && matchesPeriod(o.data)
        );

        // KPIs gerais
        const totalAlunos = visibleClasses.reduce((s, c) => s + (c._count?.students || 0), 0);

        let totalPresent = 0, totalRecords = 0;
        attInPeriod.forEach(a => {
            (a.records || []).forEach(r => {
                totalRecords++;
                if (r.presente) totalPresent++;
            });
        });
        const freqPct = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
        const totalOfferings = offInPeriod.reduce((s, o) => s + (parseFloat(o.valor) || 0), 0);

        // Dados por classe (para tabela)
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
            if (!classMap[o.ebdClassId]) return;
            classMap[o.ebdClassId].offerings += parseFloat(o.valor) || 0;
        });
        const classData = Object.values(classMap);

        // Dados por aluno (para exportação)
        const personMap = {};
        attInPeriod.forEach(a => {
            const className = a.ebdClass?.name || '';
            (a.records || []).forEach(r => {
                const person = r.student?.person;
                if (!person) return;
                if (!personMap[person.id]) {
                    personMap[person.id] = { id: person.id, name: person.name, classe: className, total: 0, present: 0 };
                }
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

    function render() {
        const d = computeData();
        const arrYears = [];
        for (let i = currentY + 1; i >= currentY - 4; i--) arrYears.push(i);

        app.innerHTML = `
        ${header('Relatórios EBD', true)}
        <div class="flex-1 overflow-y-auto w-full overflow-x-hidden">
            <div class="max-w-5xl mx-auto w-full px-4 md:px-6 lg:px-10 py-5 space-y-5">

                <!-- Filtros -->
                <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div class="flex items-center justify-between mb-3">
                        <div>
                            <h2 class="text-base font-extrabold flex items-center gap-2">
                                <span class="material-symbols-outlined text-primary">analytics</span>Painel EBD
                            </h2>
                            <p class="text-[11px] text-slate-400 mt-0.5">${d.periodLabel} • ${d.visibleClasses.length} classe(s)</p>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <div class="relative">
                            <select id="f-month" class="pl-3 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                <option value="-1" ${filterM === -1 ? 'selected' : ''}>Ano Inteiro</option>
                                ${MONTHS.map((m, idx) => `<option value="${idx}" ${filterM === idx ? 'selected' : ''}>${m}</option>`).join('')}
                            </select>
                            <span class="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">expand_more</span>
                        </div>
                        <div class="relative">
                            <select id="f-year" class="pl-3 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                ${arrYears.map(y => `<option value="${y}" ${filterY === y ? 'selected' : ''}>${y}</option>`).join('')}
                            </select>
                            <span class="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">expand_more</span>
                        </div>
                        <div class="relative">
                            <select id="f-class" class="pl-3 pr-7 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                <option value="">Todas as Classes</option>
                                ${(store.ebdClasses || []).map(c => `<option value="${c.id}" ${filterClass === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                            </select>
                            <span class="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">expand_more</span>
                        </div>
                        <div class="relative flex-1 min-w-[160px]">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-lg">search</span>
                            <input id="f-search" type="text" value="${search}" placeholder="Buscar aluno..." class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
                        </div>
                    </div>
                </div>

                <!-- KPIs -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-blue-500">school</span>
                        </div>
                        <div>
                            <p class="text-xl font-extrabold text-slate-800">${d.totalAlunos}</p>
                            <p class="text-[11px] text-slate-500">Alunos Matr.</p>
                        </div>
                    </div>
                    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-purple-500">local_library</span>
                        </div>
                        <div>
                            <p class="text-xl font-extrabold text-slate-800">${d.totalAulas}</p>
                            <p class="text-[11px] text-slate-500">Aulas no Período</p>
                        </div>
                    </div>
                    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full ${d.freqPct >= 70 ? 'bg-emerald-50' : d.freqPct >= 50 ? 'bg-amber-50' : 'bg-red-50'} flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined ${d.freqPct >= 70 ? 'text-emerald-500' : d.freqPct >= 50 ? 'text-amber-500' : 'text-red-500'}">how_to_reg</span>
                        </div>
                        <div>
                            <p class="text-xl font-extrabold text-slate-800">${d.freqPct}%</p>
                            <p class="text-[11px] text-slate-500">Freq. Média</p>
                        </div>
                    </div>
                    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-emerald-500">volunteer_activism</span>
                        </div>
                        <div>
                            <p class="text-xl font-extrabold text-slate-800">R$ ${d.totalOfferings.toFixed(2).replace('.', ',')}</p>
                            <p class="text-[11px] text-slate-500">Total Ofertas</p>
                        </div>
                    </div>
                </div>

                <!-- Tabela por Classe -->
                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <h3 class="text-sm font-bold flex items-center gap-2 mb-4">
                        <span class="material-symbols-outlined text-primary text-lg">table_chart</span>Detalhes por Classe
                    </h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                            <thead>
                                <tr class="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                                    <th class="px-3 py-2.5 rounded-l-lg">Classe</th>
                                    <th class="px-3 py-2.5">Professor</th>
                                    <th class="px-3 py-2.5 text-center">Alunos</th>
                                    <th class="px-3 py-2.5 text-center">Aulas</th>
                                    <th class="px-3 py-2.5 text-center">% Presença</th>
                                    <th class="px-3 py-2.5 text-center rounded-r-lg">Ofertas</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${d.classData.length ? d.classData.map(c => {
                                    const pct = c.totalRec > 0 ? Math.round((c.present / c.totalRec) * 100) : 0;
                                    const profName = c.professor?.name || '—';
                                    return `<tr class="border-b border-slate-50 hover:bg-slate-50 transition">
                                        <td class="px-3 py-2.5 font-semibold text-primary">${c.name}</td>
                                        <td class="px-3 py-2.5 text-slate-500">${profName}</td>
                                        <td class="px-3 py-2.5 text-center font-bold">${c._count?.students || 0}</td>
                                        <td class="px-3 py-2.5 text-center text-slate-500">${c.aulas}</td>
                                        <td class="px-3 py-2.5 text-center">
                                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${pct >= 70 ? 'bg-emerald-50 text-emerald-700' : pct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}">${pct}%</span>
                                        </td>
                                        <td class="px-3 py-2.5 text-center text-emerald-600 font-medium">R$ ${c.offerings.toFixed(2).replace('.', ',')}</td>
                                    </tr>`;
                                }).join('') : '<tr><td colspan="6" class="text-center text-slate-400 py-8">Nenhuma classe encontrada no período</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Exportar -->
                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
                    <div class="flex-1">
                        <h3 class="text-sm font-bold flex items-center gap-2">
                            <span class="material-symbols-outlined text-emerald-600 text-lg">download</span>Exportar Planilha Excel
                        </h3>
                        <p class="text-xs text-slate-500 mt-1">Relatório completo: resumo por classe + frequência individual por aluno.</p>
                    </div>
                    <button id="exp-excel" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition active:scale-95 shadow-sm">
                        <span class="material-symbols-outlined text-lg">grid_on</span>Exportar .xlsx
                    </button>
                </div>

            </div>
        </div>
        ${bottomNav('ebd')}`;

        bindEvents(d);
    }

    function bindEvents(d) {
        document.getElementById('f-month')?.addEventListener('change', e => { filterM = parseInt(e.target.value); render(); });
        document.getElementById('f-year')?.addEventListener('change', e => { filterY = parseInt(e.target.value); render(); });
        document.getElementById('f-class')?.addEventListener('change', e => { filterClass = e.target.value; render(); });
        document.getElementById('f-search')?.addEventListener('input', e => {
            search = e.target.value;
            const pos = e.target.selectionStart;
            render();
            const inp = document.getElementById('f-search');
            if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
        });
        document.getElementById('exp-excel')?.addEventListener('click', () => exportExcel(d));
    }

    function exportExcel(d) {
        if (typeof window.XLSX === 'undefined') { toast('Biblioteca Excel não carregada', 'warning'); return; }

        // Aba 1: Resumo por Classe
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

        // Aba 2: Frequência por Aluno
        const alunoRows = d.studentsArr.map(p => {
            const pct = p.total > 0 ? Math.round((p.present / p.total) * 100) : 0;
            return {
                'Aluno': p.name,
                'Classe': p.classe,
                'Aulas': p.total,
                'Presenças': p.present,
                'Frequência (%)': `${pct}%`
            };
        }).sort((a, b) => parseInt(b['Frequência (%)']) - parseInt(a['Frequência (%)']));

        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(classeRows), 'Resumo_Classes');
        window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(alunoRows), 'Alunos_Frequencia');

        const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Relatorio_EBD_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        toast('Relatório exportado!');
    }

    render();
}
