import { store } from '../store.js';
import { header, toast, bottomNav } from '../components/ui.js';

export function ebdReportsView() {
    const app = document.getElementById('app');
    const currentY = new Date().getFullYear();
    let filterY = currentY;
    let filterM = new Date().getMonth(); // 0 a 11, ou -1 para Ano Inteiro
    let filterClass = '';
    let search = '';
    
    // Protect route: requires EBD module and Admin/Supervisor
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

    function getPeriodLabel() {
        if (filterM === -1) return `Ano de ${filterY}`;
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${months[filterM]} de ${filterY}`;
    }

    function computeData() {
        let startDate, endDate;
        if (filterM === -1) {
            startDate = new Date(filterY, 0, 1);
            endDate = new Date(filterY, 11, 31, 23, 59, 59);
        } else {
            startDate = new Date(filterY, filterM, 1);
            endDate = new Date(filterY, filterM + 1, 0, 23, 59, 59);
        }
        
        const periodStartStr = startDate.toISOString();
        const periodEndStr = endDate.toISOString();

        // Arrays de dados EBD
        let visibleClasses = store.ebdClasses || [];
        if (filterClass) visibleClasses = visibleClasses.filter(c => c.id === filterClass);
        const visibleClassIds = new Set(visibleClasses.map(c => c.id));
        
        let allEnrollments = store.ebdEnrollments || [];
        let enrollmentsInVisibleClasses = allEnrollments.filter(e => visibleClassIds.has(e.classId));

        let allLogs = store.ebdClassLogs || [];
        let logsInPeriod = allLogs.filter(log => {
            return visibleClassIds.has(log.classId) && log.date >= periodStartStr && log.date <= periodEndStr;
        });
        
        // Chamadas
        let allAttendance = store.ebdAttendance || [];
        let attInPeriod = allAttendance.filter(a => {
            const log = allLogs.find(l => l.id === a.classLogId);
            return log && visibleClassIds.has(log.classId) && log.date >= periodStartStr && log.date <= periodEndStr;
        });
        
        // Calcular Frequência
        const totalLogs = logsInPeriod.length;
        const totalExpectedAtt = enrollmentsInVisibleClasses.length * totalLogs;
        const presentAtt = attInPeriod.filter(a => a.status === 'present').length;
        const freqPct = totalExpectedAtt ? Math.round((presentAtt / totalExpectedAtt) * 100) : 0;
        
        // Calcular Ofertas (Consolidado)
        const totalOfferings = logsInPeriod.reduce((sum, log) => sum + (log.offerings || 0), 0);
        
        // Pessoas com matrícula (para o search)
        let students = [];
        const enrolledPids = new Set(enrollmentsInVisibleClasses.map(e => e.personId));
        students = store.people.filter(p => enrolledPids.has(p.id));
        if (search) { 
            const s = search.toLowerCase(); 
            students = students.filter(p => p.name?.toLowerCase().includes(s)); 
        }

        const activeClasses = visibleClasses.length;
        const periodLabel = getPeriodLabel();

        return {
            visibleClasses, students, enrollmentsInVisibleClasses,
            logsInPeriod, attInPeriod, freqPct, presentAtt, totalExpectedAtt, totalLogs,
            totalOfferings, activeClasses, periodLabel
        };
    }

    function render() {
        const d = computeData();
        const currentY = new Date().getFullYear();
        const arrYears = [];
        for (let i = currentY; i >= currentY - 5; i--) arrYears.push(i);
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        app.innerHTML = `
        ${header('Relatórios EBD', true)}
        <div class="flex-1 overflow-y-auto w-full overflow-x-hidden" id="report-content">
            <div class="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-10 py-5 space-y-5">
                
                <!-- Filters Bar -->
                <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h2 class="text-lg font-extrabold flex items-center gap-2"><span class="material-symbols-outlined text-primary">analytics</span>Painel EBD</h2>
                            <p class="text-[11px] text-slate-400 mt-0.5">${d.periodLabel} • ${d.students.length} alunos</p>
                        </div>
                    </div>

                    <div class="flex flex-col md:flex-row gap-2">
                        <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <select id="f-month" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px] appearance-auto">
                                <option value="-1" ${filterM === -1 ? 'selected' : ''}>Ano Inteiro</option>
                                ${months.map((m, idx) => `<option value="${idx}" ${filterM === idx ? 'selected' : ''}>${m}</option>`).join('')}
                            </select>
                            <select id="f-year" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 min-w-[100px] appearance-auto">
                                ${arrYears.map(y => `<option value="${y}" ${filterY === y ? 'selected' : ''}>${y}</option>`).join('')}
                            </select>
                        </div>
                        
                        <div class="w-full md:w-px md:h-9 bg-slate-200 mx-1 hidden md:block"></div>
                        
                        <div class="relative flex-1">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-lg">search</span>
                            <input id="f-search" type="text" value="${search}" placeholder="Buscar aluno..." class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
                        </div>
                        
                        <select id="f-class" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px]">
                            <option value="">Todas as Classes</option>
                            ${(store.ebdClasses || []).map(c => `<option value="${c.id}" ${filterClass === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- KPI Grid -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-blue-500 text-2xl">school</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-slate-800">${d.students.length}</p>
                            <p class="text-[11px] text-slate-500 font-medium">Alunos Matriculados</p>
                        </div>
                    </div>
                    
                    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-purple-500 text-2xl">local_library</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-slate-800">${d.activeClasses}</p>
                            <p class="text-[11px] text-slate-500 font-medium">Classes Ativas</p>
                        </div>
                    </div>
                    
                    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full ${d.freqPct >= 70 ? 'bg-emerald-50' : (d.freqPct >= 50 ? 'bg-amber-50' : 'bg-red-50')} flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined ${d.freqPct >= 70 ? 'text-emerald-500' : (d.freqPct >= 50 ? 'text-amber-500' : 'text-red-500')} text-2xl">how_to_reg</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-slate-800">${d.freqPct}%</p>
                            <p class="text-[11px] text-slate-500 font-medium">Frequência Média</p>
                        </div>
                    </div>
                    
                    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-emerald-500 text-2xl">volunteer_activism</span>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-slate-800">R$ ${d.totalOfferings.toFixed(2).replace('.', ',')}</p>
                            <p class="text-[11px] text-slate-500 font-medium">Total de Ofertas</p>
                        </div>
                    </div>
                </div>

                <!-- Detailed Table -->
                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <h3 class="text-sm font-bold flex items-center gap-2"><span class="material-symbols-outlined text-primary text-lg">table_chart</span>Detalhes por Classe</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                            <thead>
                                <tr class="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                                    <th class="px-3 py-2.5 rounded-l-lg">Classe</th>
                                    <th class="px-3 py-2.5">Professor</th>
                                    <th class="px-3 py-2.5 text-center">Alunos</th>
                                    <th class="px-3 py-2.5 text-center">Aulas Minis.</th>
                                    <th class="px-3 py-2.5 text-center">% Presença</th>
                                    <th class="px-3 py-2.5 text-center rounded-r-lg">Ofertas</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${d.visibleClasses.length ? d.visibleClasses.map(c => {
                                    const cEnrollments = d.enrollmentsInVisibleClasses.filter(e => e.classId === c.id);
                                    const cLogs = d.logsInPeriod.filter(log => log.classId === c.id);
                                    let cPresent = 0; let cTotal = 0;
                                    
                                    cLogs.forEach(log => {
                                        const cAtt = d.attInPeriod.filter(a => a.classLogId === log.id);
                                        cTotal += cEnrollments.length;
                                        cPresent += cAtt.filter(a => a.status === 'present').length;
                                    });
                                    const cPct = cTotal > 0 ? Math.round((cPresent / cTotal) * 100) : 0;
                                    const cOff = cLogs.reduce((sum, log) => sum + (log.offerings || 0), 0);
                                    
                                    // Pega os professores
                                    const cProfs = (store.ebdProfessors || []).filter(p => p.classId === c.id).map(p => {
                                        const u = store.getUser(p.userId);
                                        return u ? u.name : 'Desconhecido';
                                    }).join(', ');
                                    
                                    return `<tr class="border-b border-slate-50 hover:bg-slate-50 transition">
                                        <td class="px-3 py-2.5 font-semibold text-primary">${c.name}</td>
                                        <td class="px-3 py-2.5 text-slate-500">${cProfs || '—'}</td>
                                        <td class="px-3 py-2.5 text-center font-bold">${cEnrollments.length}</td>
                                        <td class="px-3 py-2.5 text-center text-slate-500">${cLogs.length}</td>
                                        <td class="px-3 py-2.5 text-center"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${cPct >= 70 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">${cPct}%</span></td>
                                        <td class="px-3 py-2.5 text-center text-emerald-600 font-medium">R$ ${cOff.toFixed(2).replace('.', ',')}</td>
                                    </tr>`;
                                }).join('') : '<tr><td colspan="6" class="text-center text-slate-400 py-8">Nenhuma classe encontrada</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Export -->
                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
                    <div class="flex-1">
                        <h3 class="text-sm font-bold flex items-center gap-2"><span class="material-symbols-outlined text-emerald-600 text-lg">download</span>Exportar Planilha Excel</h3>
                        <p class="text-xs text-slate-500 mt-1">Baixe este relatório incluindo métricas completas e frequência detalhada por aluno.</p>
                    </div>
                    <div>
                        <button id="exp-excel" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition active:scale-95 shadow-sm shadow-emerald-200">
                            <span class="material-symbols-outlined text-lg">grid_on</span> Exportar .xlsx
                        </button>
                    </div>
                </div>

            </div>
        </div>
        ${bottomNav('reports')}
        `;

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
        if (typeof XLSX === 'undefined') { toast('Biblioteca Excel não carregada', 'warning'); return; }
        
        // Setup data for Export
        const data = d.visibleClasses.map(c => {
            const cEnrollments = d.enrollmentsInVisibleClasses.filter(e => e.classId === c.id);
            const cLogs = d.logsInPeriod.filter(log => log.classId === c.id);
            let cPresent = 0; let cTotal = 0;
            
            cLogs.forEach(log => {
                const cAtt = d.attInPeriod.filter(a => a.classLogId === log.id);
                cTotal += cEnrollments.length;
                cPresent += cAtt.filter(a => a.status === 'present').length;
            });
            const cPct = cTotal > 0 ? Math.round((cPresent / cTotal) * 100) : 0;
            const cOff = cLogs.reduce((sum, log) => sum + (log.offerings || 0), 0);
            
            const cProfs = (store.ebdProfessors || []).filter(p => p.classId === c.id).map(p => {
                const u = store.getUser(p.userId);
                return u ? u.name : 'Unknown';
            }).join(', ');

            return {
                'Classe': c.name,
                'Currículo': c.curriculum || '',
                'Professores': cProfs,
                'Alunos': cEnrollments.length,
                'Aulas no Período': cLogs.length,
                'Frequência (%)': `${cPct}%`,
                'Ofertas (R$)': cOff.toFixed(2).replace('.', ',')
            };
        });

        // Tabela Secundária (Alunos)
        const studentsData = d.students.map(p => {
            const enrollment = d.enrollmentsInVisibleClasses.find(e => e.personId === p.id);
            if (!enrollment) return null;
            const cClass = store.ebdClasses.find(c => c.id === enrollment.classId);
            const cLogs = d.logsInPeriod.filter(log => log.classId === cClass.id);
            let sPresent = 0;
            cLogs.forEach(log => {
                const att = d.attInPeriod.find(a => a.classLogId === log.id && a.personId === p.id);
                if (att && att.status === 'present') sPresent++;
            });
            const sPct = cLogs.length > 0 ? Math.round((sPresent / cLogs.length) * 100) : 0;

            return {
                'NomeAluno': p.name,
                'Classe Matriculada': cClass ? cClass.name : '',
                'Aulas Ministradas': cLogs.length,
                'Presenças': sPresent,
                'Frequência (%)': `${sPct}%`
            };
        }).filter(Boolean);

        const wb = XLSX.utils.book_new();
        const wsMain = XLSX.utils.json_to_sheet(data);
        const wsSub = XLSX.utils.json_to_sheet(studentsData);
        XLSX.utils.book_append_sheet(wb, wsMain, 'Resumo_Classes');
        XLSX.utils.book_append_sheet(wb, wsSub, 'Alunos_Frequencia');
        
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
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
