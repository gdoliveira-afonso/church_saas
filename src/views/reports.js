import { store } from '../store.js';
import { header, toast, bottomNav } from '../components/ui.js';

export function reportsView() {
  const app = document.getElementById('app');
  const currentY = new Date().getFullYear();
  let filterY = currentY;
  let filterM = new Date().getMonth(); // 0 a 11, ou -1 para Ano Inteiro
  let filterCell = '';
  // Se for LIDER_GERACAO, pré-filtra pela própria geração e não permite mudar
  let filterGeneration = store.hasRole('LIDER_GERACAO') ? store.currentUser?.generationId : '';
  let filterStatus = '';
  let search = '';
  let visibleCols = {};

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
      endDate = new Date(filterY, filterM + 1, 0, 23, 59, 59); // Ultimo dia do mês
    }

    let people = [...store.people];
    if (store.hasRole('LIDER_GERACAO')) filterGeneration = store.currentUser?.generationId;
    if (filterGeneration) {
      const genCellIds = new Set(store.cells.filter(c => c.generationId === filterGeneration).map(c => c.id));
      people = people.filter(p => p.cellId && genCellIds.has(p.cellId));
    }
    if (filterCell) people = people.filter(p => p.cellId === filterCell);
    if (filterStatus) people = people.filter(p => p.status === filterStatus);
    if (search) { const s = search.toLowerCase(); people = people.filter(p => p.name?.toLowerCase().includes(s)); }

    const total = people.length;
    // O array de "inPeriod" agora significa membros CRIADOS naquele mês/ano específico 
    const inPeriod = people.filter(p => {
      const d = new Date(p.createdAt);
      return d >= startDate && d <= endDate;
    });
    const novosConvertidos = inPeriod.filter(p => p.status === 'Novo Convertido').length;
    const reconciliacoes = inPeriod.filter(p => p.status === 'Reconciliação').length;
    const visitantes = inPeriod.filter(p => p.status === 'Visitante').length;
    // Inativos — estão na célula mas não contam como membros ativos
    const INACTIVE_STATUSES = ['Inativo', 'Afastado', 'Mudou-se'];
    const inativos = people.filter(p => p.status === 'Inativo').length;
    const afastados = people.filter(p => p.status === 'Afastado').length;
    const mudouSe = people.filter(p => p.status === 'Mudou-se').length;
    const findTrackId = (name) => store.tracks.find(t => t.name.toLowerCase().includes(name.toLowerCase()))?.id;
    const tBatismo = findTrackId('Batismo nas Águas');
    const tBatismoES = findTrackId('Batismo com o Espírito Santo');
    const tEscola = findTrackId('Escola de Líderes');
    const tEncontro = findTrackId('Encontro com Deus');

    const batismoAguas = people.filter(p => p.tracksData?.[tBatismo]).length;
    const batismoES = people.filter(p => p.tracksData?.[tBatismoES]).length;
    const escola = people.filter(p => p.tracksData?.[tEscola]).length;
    const encontro = people.filter(p => p.tracksData?.[tEncontro]).length;

    const pids = new Set(people.map(p => p.id));
    const allVisits = store.visits.filter(v => pids.has(v.personId));
    // Visitas REALIZADAS naquele mês/ano específico
    const visitsInPeriod = allVisits.filter(v => {
      const d = new Date(v.date);
      return d >= startDate && d <= endDate;
    });
    const consolidacoes = visitsInPeriod.filter(v => v.type === 'Visita de Consolidação').length;
    const acompanhamentos = visitsInPeriod.filter(v => v.type === 'Visita de Acompanhamento').length;

    const ago60 = new Date(); ago60.setDate(ago60.getDate() - 60);
    const noVisitPeople = people
      .filter(p => p.status !== 'Líder' && p.status !== 'Vice-Líder')
      .filter(p => {
        const pv = store.getVisitsForPerson(p.id);
        if (!pv.length) return false;
        const lastV = Math.max(...pv.map(v => new Date(v.date).getTime()));
        return lastV < ago60.getTime();
      });
    const noVisit = noVisitPeople.length;
    const noVisitDetails = noVisitPeople.map(p => ({ name: p.name, phone: p.phone, status: p.status }));

    const zeroVisitsPeople = people.filter(p => p.status !== 'Líder' && p.status !== 'Vice-Líder' && store.getVisitsForPerson(p.id).length === 0);
    const zeroVisits = zeroVisitsPeople.length;
    const zeroVisitsDetails = zeroVisitsPeople.map(p => ({ name: p.name, phone: p.phone, status: p.status }));

    let activeCellsList = filterGeneration ? store.cells.filter(c => c.generationId === filterGeneration) : store.cells;
    if (filterCell) activeCellsList = activeCellsList.filter(c => c.id === filterCell);
    const activeCells = activeCellsList.length;
    const avgMembers = activeCells ? Math.round(people.filter(p => p.cellId).length / activeCells) : 0;

    // Frequência REALIZADA naquele mês/ano específico 
    // IMPORTANTE: Ignorar registros que são apenas métricas (sem records de presença)
    let visibleCells = filterGeneration ? store.cells.filter(c => c.generationId === filterGeneration) : store.cells;
    if (filterCell) visibleCells = visibleCells.filter(c => c.id === filterCell);
    const visibleCellIds = new Set(visibleCells.map(c => c.id));
    const attWithRecords = store.attendance.filter(a => a.records && a.records.length > 0 && visibleCellIds.has(a.cellId));
    const attInPeriod = attWithRecords.filter(a => {
      const d = new Date(a.date);
      return d >= startDate && d <= endDate;
    });
    const totalAttRec = attInPeriod.reduce((s, a) => s + (a.records?.length || 0), 0);
    const presentRec = attInPeriod.reduce((s, a) => s + (a.records?.filter(r => r.status === 'present').length || 0), 0);
    const freqPct = totalAttRec ? Math.round(presentRec / totalAttRec * 100) : 0;

    // Calcular Totais das Métricas Customizadas (Custom Fields)
    const customFieldTotals = {};
    const cfConfig = (store.systemSettings?.cellCustomFields || '').split(',').map(s => s.trim()).filter(Boolean);
    cfConfig.forEach(cf => { customFieldTotals[cf] = 0; });

    store.attendance.filter(a => {
      const d = new Date(a.date);
      return d >= startDate && d <= endDate && visibleCellIds.has(a.cellId);
    }).forEach(a => {
      if (a.customFields) {
        try {
          const parsed = JSON.parse(a.customFields);
          Object.entries(parsed).forEach(([key, val]) => {
            if (cfConfig.includes(key)) {
              customFieldTotals[key] = (customFieldTotals[key] || 0) + (parseInt(val) || 0);
            }
          });
        } catch (e) { }
      }
    });

    const periodLabel = getPeriodLabel();

    // Dynamic Tracks Counts
    const trackCounts = {};
    const tracks = store.tracks || [];
    tracks.forEach(t => {
      trackCounts[t.id] = people.filter(p => p.tracksData && p.tracksData[t.id]).length;
    });

    return {
      people, total, inPeriod, novosConvertidos, reconciliacoes, visitantes,
      inativos, afastados, mudouSe,
      visitsInPeriod, consolidacoes, acompanhamentos, noVisit, noVisitDetails, zeroVisits, zeroVisitsDetails, activeCells, avgMembers, freqPct, presentRec,
      totalAttRec, periodLabel, startDate, endDate, allVisits, trackCounts, customFieldTotals
    };
  }

  function render() {
    const d = computeData();
    const statuses = [...new Set(store.people.map(p => p.status).filter(Boolean))];
    const tracks = store.tracks || [];

    const currentY = new Date().getFullYear();
    const arrYears = [];
    for (let i = currentY; i >= currentY - 5; i--) arrYears.push(i);

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    app.innerHTML = `
    ${header('Relatórios', true)}
    <div class="flex-1 overflow-y-auto w-full overflow-x-hidden pb-24" id="report-content">
      <div class="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-10 py-5 space-y-5">

        <!-- Filters Bar -->
        <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-extrabold flex items-center gap-2"><span class="material-symbols-outlined text-primary">analytics</span>Painel de Relatórios</h2>
              <p class="text-[11px] text-slate-400 mt-0.5">${d.periodLabel} • ${d.total} membros${filterCell ? ' • Célula filtrada' : ''}${filterStatus ? ' • ' + filterStatus : ''}</p>
            </div>
          </div>

          <div class="flex flex-col md:flex-row gap-2">
            <!-- Novo Seletor de Datas -->
            <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <!-- Mês -->
              <select id="f-month" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px] appearance-auto">
                <option value="-1" ${filterM === -1 ? 'selected' : ''}>Ano Inteiro</option>
                ${months.map((m, idx) => `<option value="${idx}" ${filterM === idx ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
              <!-- Ano -->
              <select id="f-year" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 min-w-[100px] appearance-auto">
                ${arrYears.map(y => `<option value="${y}" ${filterY === y ? 'selected' : ''}>${y}</option>`).join('')}
              </select>
            </div>

            <div class="w-full md:w-px md:h-9 bg-slate-200 mx-1 hidden md:block"></div>
            <div class="relative flex-1">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-lg">search</span>
              <input id="f-search" type="text" value="${search}" placeholder="Buscar por nome..." class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
            </div>
            <select id="f-gen" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px] ${store.hasRole('LIDER_GERACAO') ? 'hidden' : ''}">
              <option value="">Todas as gerações</option>
              ${(store.generations || []).map(g => `<option value="${g.id}" ${filterGeneration === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
            </select>
            ${store.hasRole('LIDER_GERACAO') ? `<div class="px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 text-primary text-sm font-bold flex items-center gap-2 min-w-[140px]"><span class="material-symbols-outlined text-sm">groups</span>${store.generations.find(g => g.id === store.currentUser?.generationId)?.name || 'Minha Geração'}</div>` : ''}
            <select id="f-cell" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px]">
              <option value="">Todas as células</option>
              ${store.getVisibleCells().filter(c => !filterGeneration || c.generationId === filterGeneration).map(c => `<option value="${c.id}" ${filterCell === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
            <select id="f-status" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px]">
              <option value="">Todos os status</option>
              ${statuses.map(s => `<option value="${s}" ${filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- KPI Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          ${kpi('favorite', 'Convertidos', d.novosConvertidos, 'emerald')}
          ${kpi('handshake', 'Reconciliações', d.reconciliacoes, 'purple')}
          ${kpi('groups', 'Visitantes', d.visitantes, 'blue')}
          ${kpi('home_health', 'Visitas', d.visitsInPeriod.length, 'amber')}
          ${kpi('diversity_1', 'Consolidações', d.consolidacoes, 'teal')}
          ${kpi('follow_the_signs', 'Acompanham.', d.acompanhamentos, 'cyan')}
        </div>

        <!-- Inativos / Saída -->
        ${(d.inativos + d.afastados + d.mudouSe) > 0 ? `
        <div class="grid grid-cols-3 gap-2.5">
          ${kpi('person_off', 'Inativos', d.inativos, 'gray')}
          ${kpi('person_remove', 'Afastados', d.afastados, 'orange')}
          ${kpi('moving', 'Mudou-se', d.mudouSe, 'slate')}
        </div>` : ''}

        <!-- Custom Metrics KPI Grid (Optional row if metrics exist) -->
        ${Object.keys(d.customFieldTotals).length > 0 ? `
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          ${Object.entries(d.customFieldTotals).map(([label, val]) => kpi('monitoring', label, val, 'slate')).join('')}
        </div>` : ''}

        <!-- Charts Row -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <!-- Spiritual Health -->
          <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 class="text-sm font-bold flex items-center gap-2 mb-4"><span class="material-symbols-outlined text-primary text-lg">monitoring</span>Saúde Espiritual & Retiros<span class="text-[10px] text-slate-400 font-normal ml-auto">${d.total} membros</span></h3>
            <div class="space-y-3">
              ${tracks.length ? tracks.map(t => progressBar(t.name, d.trackCounts[t.id] || 0, d.total, t.color)).join('') : '<p class="text-sm text-slate-400 mt-2">Nenhuma trilha configurada.</p>'}
            </div>
          </div>

          <!-- Frequency & Cells -->
          <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 class="text-sm font-bold flex items-center gap-2 mb-4"><span class="material-symbols-outlined text-primary text-lg">groups</span>Frequência & Células</h3>
            <div class="grid grid-cols-2 gap-3">
              <div class="text-center p-4 bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-primary/5 dark:to-primary/20 rounded-xl border border-blue-100/50 dark:border-blue-800/50">
                <p class="text-3xl font-extrabold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">${d.freqPct}%</p>
                <p class="text-[10px] text-slate-600 dark:text-slate-300 mt-1 font-bold">Frequência Média</p>
                <p class="text-[9px] text-slate-400">${d.presentRec}/${d.totalAttRec} presenças</p>
              </div>
              <div class="text-center p-4 bg-gradient-to-br from-purple-50 dark:from-purple-900/20 to-purple-100/30 dark:to-purple-800/20 rounded-xl border border-purple-100/50 dark:border-purple-800/50">
                <p class="text-3xl font-extrabold text-purple-600 dark:text-purple-400">${d.activeCells}</p>
                <p class="text-[10px] text-slate-600 dark:text-slate-300 mt-1 font-bold">Células Ativas</p>
                <p class="text-[9px] text-slate-400">~${d.avgMembers} membros/célula</p>
              </div>
              <div class="text-center p-4 bg-gradient-to-br from-amber-50 dark:from-amber-900/20 to-amber-100/30 dark:to-amber-800/20 rounded-xl border border-amber-100/50 dark:border-amber-800/50">
                <p class="text-3xl font-extrabold text-amber-500 dark:text-amber-400">${d.noVisit}</p>
                <p class="text-[10px] text-slate-600 dark:text-slate-300 mt-1 font-bold">Sem Visita &gt; 60 dias</p>
                <p class="text-[9px] text-slate-400">precisam de atenção</p>
              </div>
              <div class="text-center p-4 bg-gradient-to-br from-red-50 dark:from-red-900/20 to-red-100/30 dark:to-red-800/20 rounded-xl border border-red-100/50 dark:border-red-800/50">
                <p class="text-3xl font-extrabold text-red-500 dark:text-red-400">${d.zeroVisits}</p>
                <p class="text-[10px] text-slate-600 dark:text-slate-300 mt-1 font-bold">Zero Visitas</p>
                <p class="text-[9px] text-slate-400">nunca visitados</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Detailed Table -->
        <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h3 class="text-sm font-bold flex items-center gap-2"><span class="material-symbols-outlined text-primary text-lg">table_chart</span>Relatório Detalhado</h3>
            <div class="flex flex-wrap gap-1.5 w-full sm:w-auto">
              ${[['members', 'person', 'Membros'], ['cells', 'diversity_3', 'Células'], ['visits', 'home_health', 'Visitas'], ['attendance', 'event_available', 'Chamadas'], ['metrics', 'leaderboard', 'Métricas'], ['person_attendance', 'account_circle', 'Freq. Membros'], ['consolidation', 'route', 'Consolidação'], ['inativos', 'person_off', 'Inativos']].map(([v, ic, l]) =>
      `<button class="report-tab flex-1 sm:flex-none justify-center flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition ${v === 'members' ? 'bg-primary text-white' : v === 'inativos' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}" data-tab="${v}"><span class="material-symbols-outlined text-sm hidden sm:block">${ic}</span>${l}</button>`
    ).join('')}
            </div>
          </div>
          <div id="col-settings-container" class="mb-4 hidden"></div>
          <div id="report-table" class="overflow-x-auto max-h-[600px] overflow-y-auto pr-1"></div>
        </div>

        <!-- Export -->
        <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 class="text-sm font-bold flex items-center gap-2 mb-4"><span class="material-symbols-outlined text-primary text-lg">download</span>Exportar Relatório</h3>
          <div class="space-y-3 max-w-lg mx-auto">
            <button id="exp-pdf" class="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white py-3.5 rounded-xl text-sm font-bold hover:from-red-600 hover:to-red-700 active:scale-[.98] transition-all shadow-md shadow-red-200/50"><span class="material-symbols-outlined text-lg">picture_as_pdf</span>Gerar Relatório PDF</button>
            <div class="grid grid-cols-3 gap-2">
              <button id="exp-xlsx-members" class="flex flex-col items-center justify-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 py-3 rounded-xl text-[11px] font-bold hover:bg-emerald-100 active:scale-[.98] transition"><span class="material-symbols-outlined text-base">group</span>Membros .xlsx</button>
              <button id="exp-xlsx-cells" class="flex flex-col items-center justify-center gap-1 bg-purple-50 border border-purple-200 text-purple-700 py-3 rounded-xl text-[11px] font-bold hover:bg-purple-100 active:scale-[.98] transition"><span class="material-symbols-outlined text-base">diversity_3</span>Células .xlsx</button>
              <button id="exp-xlsx-visits" class="flex flex-col items-center justify-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 py-3 rounded-xl text-[11px] font-bold hover:bg-amber-100 active:scale-[.98] transition"><span class="material-symbols-outlined text-base">home_health</span>Visitas .xlsx</button>
            </div>
          </div>
        </div>

      </div>
    </div>
    ${bottomNav('reports')}`;

    bindEvents(d);
  }

  function bindEvents(d) {
    // Novos Bindings de Data
    document.getElementById('f-month')?.addEventListener('change', e => {
      filterM = parseInt(e.target.value);
      render();
    });
    document.getElementById('f-year')?.addEventListener('change', e => {
      filterY = parseInt(e.target.value);
      render();
    });

    // Filters
    document.getElementById('f-search')?.addEventListener('input', e => {
      search = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const inp = document.getElementById('f-search');
      if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
    });
    document.getElementById('f-gen')?.addEventListener('change', e => {
      filterGeneration = e.target.value;
      filterCell = ''; // Reset cell filter when generation changes
      render();
    });
    document.getElementById('f-cell')?.addEventListener('change', e => { filterCell = e.target.value; render(); });
    document.getElementById('f-status')?.addEventListener('change', e => { filterStatus = e.target.value; render(); });

    // Report tabs
    let currentTab = 'members';
    function showTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.report-tab').forEach(b => {
        b.classList.toggle('bg-primary', b.dataset.tab === tab);
        b.classList.toggle('text-white', b.dataset.tab === tab);
        b.classList.toggle('bg-slate-100', b.dataset.tab !== tab);
        b.classList.toggle('text-slate-500', b.dataset.tab !== tab);
      });
      const rt = document.getElementById('report-table');
      const csc = document.getElementById('col-settings-container');

      if (tab === 'members') {
        if (csc) { csc.innerHTML = renderColSettings(visibleCols); csc.classList.remove('hidden'); }
        rt.innerHTML = membersTable(d.people, visibleCols);
        document.querySelectorAll('.col-toggle').forEach(chk => {
          chk.addEventListener('change', e => {
            visibleCols[e.target.dataset.col] = e.target.checked;
            rt.innerHTML = membersTable(d.people, visibleCols);
          });
        });
      } else {
        if (csc) { csc.innerHTML = ''; csc.classList.add('hidden'); }
        if (tab === 'cells') rt.innerHTML = cellsTable();
        else if (tab === 'visits') rt.innerHTML = visitsTable(d.visitsInPeriod);
        else if (tab === 'attendance') rt.innerHTML = attendanceTable(d.startDate, d.endDate, false); // false = hide metrics
        else if (tab === 'metrics') rt.innerHTML = attendanceTable(d.startDate, d.endDate, true); // true = show only metrics
        else if (tab === 'person_attendance') rt.innerHTML = personAttendanceTable(d.people, d.startDate, d.endDate);
        else if (tab === 'consolidation') rt.innerHTML = consolidationTable(d.people);
        else if (tab === 'inativos') rt.innerHTML = inactiveMembersTable();
      }
    }
    document.querySelectorAll('.report-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    showTab('members');

    // PDF export
    document.getElementById('exp-pdf')?.addEventListener('click', () => exportPDF(d, currentTab, visibleCols));

    // Excel exports
    document.getElementById('exp-xlsx-members')?.addEventListener('click', () => exportMembersExcel(d.people));
    document.getElementById('exp-xlsx-cells')?.addEventListener('click', () => exportCellsExcel());
    document.getElementById('exp-xlsx-visits')?.addEventListener('click', () => exportVisitsExcel(d.visitsInPeriod));
  }

  render();

  // ── TABLE BUILDERS ──
  function membersTable(people, visibleCols = {}) {
    const tracks = store.tracks || [];
    return `<table class="w-full text-left text-xs">
    <thead><tr class="sticky top-0 bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider z-10">
      <th class="px-3 py-2.5 rounded-l-lg">Nome</th>
      ${visibleCols.status !== false ? '<th class="px-3 py-2.5">Status</th>' : ''}
      ${visibleCols.cell !== false ? '<th class="px-3 py-2.5">Célula</th>' : ''}
      ${visibleCols.phone !== false ? '<th class="px-3 py-2.5">Telefone</th>' : ''}
      ${tracks.filter(t => visibleCols[t.id] !== false).map(t => `<th class="px-3 py-2.5 text-center" title="${t.name}">${t.name}</th>`).join('')}
      ${visibleCols.visits !== false ? '<th class="px-3 py-2.5 text-center rounded-r-lg">Visitas</th>' : ''}
    </tr></thead>
    <tbody>${people.length ? people.map(p => {
      const c = p.cellId ? store.getCell(p.cellId) : null;
      const vc = store.getVisitsForPerson(p.id).length;
      return `<tr class="border-b border-slate-50 hover:bg-blue-50/30 transition">
        <td class="px-3 py-2.5 font-semibold">${p.name}</td>
        ${visibleCols.status !== false ? `<td class="px-3 py-2.5">${statusBadge(p.status)}</td>` : ''}
        ${visibleCols.cell !== false ? `<td class="px-3 py-2.5 text-slate-500">${c?.name || '—'}</td>` : ''}
        ${visibleCols.phone !== false ? `<td class="px-3 py-2.5 text-slate-500">${p.phone || '—'}</td>` : ''}
        ${tracks.filter(t => visibleCols[t.id] !== false).map(t => `<td class="px-3 py-2.5 text-center">${dot(p.tracksData && p.tracksData[t.id])}</td>`).join('')}
        ${visibleCols.visits !== false ? `<td class="px-3 py-2.5 text-center font-bold">${vc}</td>` : ''}
      </tr>`;
    }).join('') : `<tr><td colspan="10" class="text-center text-slate-400 py-8">Nenhum membro encontrado</td></tr>`}</tbody>
  </table>`;
  }

  function cellsTable() {
    return `<table class="w-full text-left text-xs">
    <thead><tr class="sticky top-0 bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider z-10">
      <th class="px-3 py-2.5 rounded-l-lg">Célula</th><th class="px-3 py-2.5">Líder</th><th class="px-3 py-2.5 text-center">Membros</th>
      <th class="px-3 py-2.5">Dia</th><th class="px-3 py-2.5 text-center text-emerald-600">Encont. Realizados</th>
      <th class="px-3 py-2.5 text-center text-amber-600">Justificados</th>
      <th class="px-3 py-2.5 text-center text-slate-500 rounded-r-lg">Cancelados (Admin)</th>
    </tr></thead>
    <tbody>${store.getVisibleCells().filter(c => !filterGeneration || c.generationId === filterGeneration).length ? store.getVisibleCells().filter(c => !filterGeneration || c.generationId === filterGeneration).map(c => {
      const members = store.getCellMembers(c.id);
      const leader = c.leaderId ? (store.getUser(c.leaderId) || store.getPerson(c.leaderId)) : null;
      // IMPORTANTE: Contar apenas atendimentos que tiveram registros de presença (records)
      const attCount = store.getAttendanceForCell(c.id).filter(a => a.records && a.records.length > 0).length;
      const justifications = store.getCellJustifications(c.id).length;
      const cancellations = store.cellCancellations ? store.cellCancellations.filter(can => can.cellId === c.id).length : 0;
      return `<tr class="border-b border-slate-50 hover:bg-blue-50/30 transition">
        <td class="px-3 py-2.5 font-semibold">${c.name}</td>
        <td class="px-3 py-2.5 text-slate-500">${leader?.name || '—'}</td>
        <td class="px-3 py-2.5 text-center font-bold">${members.length}</td>
        <td class="px-3 py-2.5 text-slate-500">${c.meetingDay || '—'}</td>
        <td class="px-3 py-2.5 text-center font-bold text-emerald-600">${attCount}</td>
        <td class="px-3 py-2.5 text-center text-amber-600 font-bold">${justifications}</td>
        <td class="px-3 py-2.5 text-center text-slate-500 font-medium">${cancellations}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="8" class="text-center text-slate-400 py-8">Nenhuma célula</td></tr>'}</tbody>
  </table>`;
  }

  function visitsTable(visits) {
    const visibleCellIds = new Set((filterGeneration ? store.cells.filter(c => c.generationId === filterGeneration) : store.cells).map(c => c.id));
    const filteredVisits = visits.filter(v => {
      const person = store.getPerson(v.personId);
      return !filterGeneration || (person && visibleCellIds.has(person.cellId));
    });
    const sorted = [...filteredVisits].sort((a, b) => b.date.localeCompare(a.date));
    return `<table class="w-full text-left text-xs">
    <thead><tr class="sticky top-0 bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider z-10">
      <th class="px-3 py-2.5 rounded-l-lg">Data</th><th class="px-3 py-2.5">Pessoa</th><th class="px-3 py-2.5">Tipo</th>
      <th class="px-3 py-2.5">Resultado</th><th class="px-3 py-2.5 rounded-r-lg">Observação</th>
    </tr></thead>
    <tbody>${sorted.length ? sorted.map(v => {
      const person = store.getPerson(v.personId);
      return `<tr class="border-b border-slate-50 hover:bg-blue-50/30 transition">
        <td class="px-3 py-2.5 text-slate-500 whitespace-nowrap">${v.date}</td>
        <td class="px-3 py-2.5 font-semibold">${person?.name || '—'}</td>
        <td class="px-3 py-2.5"><span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">${v.type || 'Visita'}</span></td>
        <td class="px-3 py-2.5 text-slate-500">${v.result || '—'}</td>
        <td class="px-3 py-2.5 text-slate-500 max-w-[200px] truncate">${v.observation || '—'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="5" class="text-center text-slate-400 py-8">Nenhuma visita neste período</td></tr>'}</tbody>
  </table>`;
  }

  function attendanceTable(startDate, endDate, showOnlyMetrics = false) {
    const visibleCellIds = new Set((filterGeneration ? store.cells.filter(c => c.generationId === filterGeneration) : store.cells).map(c => c.id));
    let records = store.attendance.filter(a => {
      const d = new Date(a.date);
      return d >= startDate && d <= endDate && visibleCellIds.has(a.cellId);
    }).sort((a, b) => b.date.localeCompare(a.date));

    if (showOnlyMetrics) {
      // Apenas registros que TEM customFields
      records = records.filter(a => a.customFields && a.customFields !== '{}');
    } else {
      // Apenas registros que TEM presença (records)
      records = records.filter(a => a.records && a.records.length > 0);
    }

    const customFieldsConfig = (store.systemSettings?.cellCustomFields || '').split(',').map(s => s.trim()).filter(Boolean);
    let customFieldsHeaders = '';
    if (showOnlyMetrics && customFieldsConfig.length > 0) {
      customFieldsHeaders = customFieldsConfig.map(cf => `<th class="px-3 py-2.5 text-center">${cf}</th>`).join('');
    }

    return `<table class="w-full text-left text-xs">
    <thead><tr class="sticky top-0 bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider z-10">
      <th class="px-3 py-2.5 rounded-l-lg">Data</th><th class="px-3 py-2.5">Célula</th>
      ${!showOnlyMetrics ? `
      <th class="px-3 py-2.5 text-center">Presentes</th>
      <th class="px-3 py-2.5 text-center">Ausentes</th>
      <th class="px-3 py-2.5 text-center">% Presença</th>` : ''}
      ${customFieldsHeaders}
      <th class="rounded-r-lg"></th>
    </tr></thead>
    <tbody>${records.length ? records.map(a => {
      const cell = store.getCell(a.cellId);
      const present = a.records?.filter(r => r.status === 'present').length || 0;
      const absent = (a.records?.length || 0) - present;
      const pct = a.records?.length ? Math.round(present / a.records.length * 100) : 0;

      let parsedCustomFields = {};
      if (a.customFields) {
        try { parsedCustomFields = JSON.parse(a.customFields); } catch (e) { }
      }

      let customFieldsCells = '';
      if (showOnlyMetrics && customFieldsConfig.length > 0) {
        customFieldsCells = customFieldsConfig.map(cf => `<td class="px-3 py-2.5 text-center font-medium">${parsedCustomFields[cf] || '-'}</td>`).join('');
      }

      return `<tr class="border-b border-slate-50 hover:bg-blue-50/30 transition">
        <td class="px-3 py-2.5 text-slate-500 whitespace-nowrap">${a.date}</td>
        <td class="px-3 py-2.5 font-semibold">${cell?.name || '—'}</td>
        ${!showOnlyMetrics ? `
        <td class="px-3 py-2.5 text-center text-emerald-600 font-bold">${present}</td>
        <td class="px-3 py-2.5 text-center text-red-500 font-bold">${absent}</td>
        <td class="px-3 py-2.5 text-center"><span class="text-[9px] font-bold px-2 py-0.5 rounded-full ${pct >= 70 ? 'bg-emerald-50 text-emerald-700' : pct >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}">${pct}%</span></td>` : ''}
        ${customFieldsCells}
        <td></td>
      </tr>`;
    }).join('') : `<tr><td colspan="${5 + customFieldsConfig.length}" class="text-center text-slate-400 py-8">Nenhum registro encontrado</td></tr>`}</tbody>
  </table>`;
  }

  function personAttendanceTable(people, startDate, endDate) {
    const visibleCellIds = new Set((filterGeneration ? store.cells.filter(c => c.generationId === filterGeneration) : store.cells).map(c => c.id));
    const attInPeriod = store.attendance.filter(a => {
      const d = new Date(a.date);
      return d >= startDate && d <= endDate && visibleCellIds.has(a.cellId);
    });
    const stats = people.map(p => {
      let present = 0; let absent = 0; let total = 0;
      attInPeriod.forEach(a => {
        const rec = a.records?.find(r => r.personId === p.id);
        if (rec) {
          total++;
          if (rec.status === 'present') present++;
          else if (rec.status === 'absent') absent++;
        }
      });
      return { ...p, present, absent, total };
    }).sort((a, b) => b.total - a.total || b.present - a.present);

    return `<table class="w-full text-left text-xs">
    <thead><tr class="sticky top-0 bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider z-10">
      <th class="px-3 py-2.5 rounded-l-lg">Membro</th><th class="px-3 py-2.5">Célula</th>
      <th class="px-3 py-2.5 text-center">Presenças</th><th class="px-3 py-2.5 text-center">Faltas</th>
      <th class="px-3 py-2.5 text-center rounded-r-lg">% Frequência</th>
    </tr></thead>
    <tbody>${stats.length ? stats.map(s => {
      const cell = store.getCell(s.cellId);
      const pct = s.total ? Math.round(s.present / s.total * 100) : 0;
      return `<tr class="border-b border-slate-50 hover:bg-blue-50/30 transition">
        <td class="px-3 py-2.5 font-semibold whitespace-nowrap">${s.name}</td>
        <td class="px-3 py-2.5 text-slate-500">${cell?.name || '—'}</td>
        <td class="px-3 py-2.5 text-center text-emerald-600 font-bold">${s.present}</td>
        <td class="px-3 py-2.5 text-center text-red-500 font-bold">${s.absent}</td>
        <td class="px-3 py-2.5 text-center"><span class="text-[9px] font-bold px-2 py-0.5 rounded-full ${s.total === 0 ? 'bg-slate-100 text-slate-500' : pct >= 70 ? 'bg-emerald-50 text-emerald-700' : pct >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}">${s.total === 0 ? '-' : pct + '%'}</span></td>
      </tr>`;
    }).join('') : '<tr><td colspan="5" class="text-center text-slate-400 py-8">Nenhum membro encontrado</td></tr>'}</tbody>
  </table>`;
  }

  function consolidationTable(people) {
    const newConverts = people.filter(p => p.status === 'Novo Convertido');
    return `<table class="w-full text-left text-xs">
    <thead><tr class="sticky top-0 bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider z-10">
      <th class="px-3 py-2.5 rounded-l-lg">Nome</th><th class="px-3 py-2.5">Célula</th>
      <th class="px-3 py-2.5 text-center">Status de Consolidação</th><th class="px-3 py-2.5 text-center">Dias Faltantes</th>
      <th class="px-3 py-2.5 text-center rounded-r-lg">Visitas Recebidas</th>
    </tr></thead>
    <tbody>${newConverts.length ? newConverts.map(p => {
      const c = p.cellId ? store.getCell(p.cellId) : null;
      let sBadge = '<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Pendente</span>';
      let daysDiff = '-';
      if (p.consolidation) {
        if (p.consolidation.status === 'COMPLETED') {
          sBadge = '<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Finalizada</span>';
          daysDiff = '0';
        } else {
          const d = Math.floor((new Date() - new Date(p.consolidation.startDate)) / 86400000);
          daysDiff = d > 15 ? `<span class="text-red-600 font-bold">${d} dias</span>` : `<span class="text-amber-600 font-bold">${d} dias</span>`;
          sBadge = p.consolidation.status === 'IN_PROGRESS'
            ? '<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Em Andamento</span>'
            : '<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Pendente</span>';
        }
      }
      const consVisits = store.getVisitsForPerson(p.id).filter(v => v.type === 'Visita de Consolidação').length;
      return `<tr class="border-b border-slate-50 hover:bg-blue-50/30 transition cursor-pointer" onclick="location.hash='/profile?id=${p.id}'">
        <td class="px-3 py-2.5 font-semibold whitespace-nowrap text-primary hover:underline">${p.name}</td>
        <td class="px-3 py-2.5 text-slate-500">${c?.name || '—'}</td>
        <td class="px-3 py-2.5 text-center">${sBadge}</td>
        <td class="px-3 py-2.5 text-center">${daysDiff}</td>
        <td class="px-3 py-2.5 text-center font-bold">${consVisits}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="5" class="text-center text-slate-400 py-8">Nenhum novo convertido encontrado</td></tr>'}</tbody>
  </table>`;
  }

  function inactiveMembersTable() {
    const INACTIVE_STATUSES = ['Inativo', 'Afastado', 'Mudou-se'];
    const statusColors = { 'Inativo': ['gray', 'person_off'], 'Afastado': ['orange', 'person_remove'], 'Mudou-se': ['slate', 'moving'] };

    const activeCellsIds = new Set((filterGeneration ? store.cells.filter(c => c.generationId === filterGeneration) : store.cells).map(c => c.id));
    const inactive = store.people
      .filter(p => INACTIVE_STATUSES.includes(p.status))
      .filter(p => !filterGeneration || (p.cellId && activeCellsIds.has(p.cellId)))
      .sort((a, b) => INACTIVE_STATUSES.indexOf(a.status) - INACTIVE_STATUSES.indexOf(b.status) || a.name.localeCompare(b.name));

    const counts = INACTIVE_STATUSES.map(s => ({ s, n: inactive.filter(p => p.status === s).length }));

    if (!inactive.length) {
      return `<div class="flex flex-col items-center py-12 text-slate-400">
      <span class="material-symbols-outlined text-4xl mb-2">how_to_reg</span>
      <p class="text-sm font-medium">Nenhum membro inativo, afastado ou que se mudou.</p>
    </div>`;
    }

    const summaryCards = counts.map(({ s, n }) => {
      const [c, ic] = statusColors[s];
      return `<div class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-${c}-50 border border-${c}-100">
      <span class="material-symbols-outlined text-${c}-500 text-base">${ic}</span>
      <span class="text-sm font-bold text-${c}-700">${n}</span>
      <span class="text-xs text-${c}-600">${s}</span>
    </div>`;
    }).join('');

    return `
  <div class="flex flex-wrap gap-2 mb-4">${summaryCards}</div>
  <table class="w-full text-left text-xs">
    <thead><tr class="sticky top-0 bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider z-10">
      <th class="px-3 py-2.5 rounded-l-lg">Nome</th>
      <th class="px-3 py-2.5">Status</th>
      <th class="px-3 py-2.5">Célula</th>
      <th class="px-3 py-2.5">Telefone</th>
      <th class="px-3 py-2.5 rounded-r-lg">Visitas</th>
    </tr></thead>
    <tbody>${inactive.map(p => {
      const c = p.cellId ? store.getCell(p.cellId) : null;
      const vc = store.getVisitsForPerson(p.id).length;
      const [col] = statusColors[p.status] || ['slate', 'person'];
      return `<tr class="border-b border-slate-50 hover:bg-slate-50/60 transition cursor-pointer" onclick="location.hash='/profile?id=${p.id}'">
        <td class="px-3 py-2.5 font-semibold text-primary hover:underline whitespace-nowrap">${p.name}</td>
        <td class="px-3 py-2.5"><span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-${col}-50 text-${col}-700">${p.status}</span></td>
        <td class="px-3 py-2.5 text-slate-500">${c?.name || '<span class="text-slate-300">Sem célula</span>'}</td>
        <td class="px-3 py-2.5 text-slate-500">${p.phone || '—'}</td>
        <td class="px-3 py-2.5 text-center font-bold text-slate-500">${vc}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
  }

  // ── HELPERS ──
  function resolveColor(c) {
    const map = {
      'emerald': '#10b981',
      'indigo': '#6366f1',
      'violet': '#8b5cf6',
      'rose': '#f43f5e',
      'amber': '#f59e0b',
      'sky': '#0ea5e9',
      'primary': '#135bec'
    };
    return map[c] || c;
  }

  function kpi(icon, label, value, color) {
    const c = resolveColor(color);
    return `<div class="bg-white rounded-xl p-3 border border-slate-100 shadow-sm hover:shadow-md hover:border-${color}-200 transition-all group min-w-0">
    <div class="w-7 h-7 rounded-lg bg-${color}-50 flex items-center justify-center mb-2 shrink-0"><span class="material-symbols-outlined text-${color}-500 text-base">${icon}</span></div>
    <p class="text-xl font-extrabold leading-none truncate">${value}</p>
    <p class="text-[9px] font-semibold text-slate-500 mt-1 truncate" title="${label}">${label}</p>
  </div>`;
  }

  function progressBar(label, count, total, color) {
    const pct = total ? Math.round(count / total * 100) : 0;
    const c = resolveColor(color);
    return `<div>
    <div class="flex justify-between items-center mb-1">
      <span class="text-xs font-medium text-slate-700">${label}</span>
      <span class="text-xs font-bold" style="color:${c}">${pct}% <span class="text-slate-400 font-normal">(${count}/${total})</span></span>
    </div>
    <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div class="h-full rounded-full transition-all duration-700" style="width:${pct}%;background:${c}"></div>
    </div>
  </div>`;
  }

  function statusBadge(status) {
    const colors = {
      'Novo Convertido': 'emerald', 'Reconciliação': 'purple',
      'Visitante': 'blue', 'Membro': 'primary',
      'Inativo': 'gray', 'Afastado': 'orange', 'Mudou-se': 'slate'
    };
    const c = colors[status] || 'slate';
    return `<span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-${c}-50 text-${c}-700">${status || '—'}</span>`;
  }

  function dot(val) {
    return val ? '<span class="inline-flex w-5 h-5 rounded-full bg-emerald-100 items-center justify-center"><span class="material-symbols-outlined text-emerald-600" style="font-size:12px">check</span></span>'
      : '<span class="inline-flex w-5 h-5 rounded-full bg-red-50 items-center justify-center"><span class="material-symbols-outlined text-red-400" style="font-size:12px">close</span></span>';
  }

  // ── EXCEL EXPORT ──
  function exportMembersExcel(people) {
    const data = people.map(p => {
      const c = p.cellId ? store.getCell(p.cellId) : null;
      const findTrackId = (name) => store.tracks.find(t => t.name.toLowerCase().includes(name.toLowerCase()))?.id;
      const tBatismo = findTrackId('Batismo nas Águas');
      const tBatismoES = findTrackId('Batismo com o Espírito Santo');
      const tEscola = findTrackId('Escola de Líderes');
      const tEncontro = findTrackId('Encontro com Deus');

      return {
        'Nome': p.name, 'Status': p.status || '', 'Telefone': p.phone || '', 'Email': p.email || '',
        'Célula': c?.name || '',
        'Batismo Águas': p.tracksData?.[tBatismo] ? 'Sim' : 'Não',
        'Esp. Santo': p.tracksData?.[tBatismoES] ? 'Sim' : 'Não',
        'Escola de Líderes': p.tracksData?.[tEscola] ? 'Sim' : 'Não',
        'Encontro com Deus': p.tracksData?.[tEncontro] ? 'Sim' : 'Não',
        'Visitas': store.getVisitsForPerson(p.id).length
      };
    });
    downloadExcel(data, 'Membros', 'membros');
  }

  function exportVisitsExcel(visits) {
    const data = visits.sort((a, b) => b.date.localeCompare(a.date)).map(v => {
      const person = store.getPerson(v.personId);
      return { 'Data': v.date, 'Pessoa': person?.name || '', 'Tipo': v.type || '', 'Resultado': v.result || '', 'Observação': v.observation || '' };
    });
    downloadExcel(data, 'Visitas', 'visitas');
  }

  function exportCellsExcel() {
    const data = store.getVisibleCells().map(c => {
      const leader = c.leaderId ? (store.getUser(c.leaderId) || store.getPerson(c.leaderId)) : null;
      const attCount = store.getAttendanceForCell(c.id).length;
      const justifications = store.getCellJustifications(c.id).length;
      const cancellations = store.cellCancellations ? store.cellCancellations.filter(can => can.cellId === c.id).length : 0;
      return { 'Célula': c.name, 'Líder': leader?.name || '', 'Membros': store.getCellMembers(c.id).length, 'Dia': c.meetingDay || '', 'Realizadas': attCount, 'Justificadas': justifications, 'Canceladas': cancellations };
    });
    downloadExcel(data, 'Células', 'celulas');
  }

  function downloadExcel(data, sheetName, fileName) {
    if (typeof XLSX === 'undefined') { toast('Biblioteca Excel não carregada', 'warning'); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const colWidths = Object.keys(data[0] || {}).map(k => ({ wch: Math.max(k.length + 2, ...data.map(r => String(r[k] || '').length + 2)) }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await store.downloadBlob(blob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast('Arquivo Excel exportado!');
  }

  // ── PDF EXPORT ──
  function exportPDF(d) {
    if (!store.hasRole('ADMIN', 'SUPERVISOR', 'LIDER_GERACAO')) { toast('Sem permissão para exportar.', 'error'); return; }

    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');

    modalContent.innerHTML = `
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-extrabold text-slate-900 flex items-center gap-2"><span class="material-symbols-outlined text-primary">picture_as_pdf</span> Gerar Relatório PDF</h3>
        <button id="close-pdf-modal" type="button" class="text-slate-400 hover:text-slate-600 transition"><span class="material-symbols-outlined">close</span></button>
      </div>

      <div class="space-y-4 mb-6">
        <label class="block text-sm font-semibold text-slate-700">Selecione o modelo do relatório:</label>
        
        <div class="grid grid-cols-1 gap-3">
          <label class="flex items-start gap-3 p-4 border border-blue-200 bg-blue-50/50 rounded-xl cursor-pointer transition hover:bg-blue-50 group">
            <input type="radio" name="reportType" value="executive" class="mt-1 w-4 h-4 text-primary accent-primary" checked>
            <div>
              <p class="text-sm font-bold text-slate-900">Relatório Executivo <span class="badge badge-blue ml-1 bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold inline-block">Recomendado</span></p>
              <p class="text-[11px] text-slate-500 mt-1">Visão gerencial em 1 ou 2 páginas. Inclui KPIs, células, saúde espiritual e insights robóticos.</p>
            </div>
          </label>

          <label class="flex items-start gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer transition hover:bg-slate-50">
            <input type="radio" name="reportType" value="analytical" class="mt-1 w-4 h-4 text-primary accent-primary">
            <div>
              <p class="text-sm font-bold text-slate-900">Analítico Completo</p>
              <p class="text-[11px] text-slate-500 mt-1">O pacote completo com o resumo executivo mais todas as tabelas detalhadas impressas.</p>
            </div>
          </label>

          <label class="flex items-start gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer transition hover:bg-slate-50">
            <input type="radio" name="reportType" value="members" class="mt-1 w-4 h-4 text-primary accent-primary">
            <div>
              <p class="text-sm font-bold text-slate-900">Lista de Membros</p>
              <p class="text-[11px] text-slate-500 mt-1">Tabela de membros e status espiritual das colunas ativas.</p>
            </div>
          </label>

          <label class="flex items-start gap-3 p-4 border border-slate-200 rounded-xl transition ${filterCell ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-slate-50'}">
            <input type="radio" name="reportType" value="cells" class="mt-1 w-4 h-4 text-primary accent-primary" ${filterCell ? 'disabled' : ''}>
            <div>
              <p class="text-sm font-bold text-slate-900">Desempenho das Células ${filterCell ? '<span class="text-[9px] text-amber-600 ml-1">(Indisponível para célula individual)</span>' : ''}</p>
              <p class="text-[11px] text-slate-500 mt-1">Líderes, reuniões, assiduidade e números limpos.</p>
            </div>
          </label>

          <label class="flex items-start gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer transition hover:bg-slate-50">
            <input type="radio" name="reportType" value="visits" class="mt-1 w-4 h-4 text-primary accent-primary">
            <div>
              <p class="text-sm font-bold text-slate-900">Histórico de Visitas</p>
              <p class="text-[11px] text-slate-500 mt-1">Linha do tempo das ocorrências, resultados e anotações.</p>
            </div>
          </label>

          <label class="flex items-start gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer transition hover:bg-slate-50">
            <input type="radio" name="reportType" value="metrics" class="mt-1 w-4 h-4 text-primary accent-primary">
            <div>
              <p class="text-sm font-bold text-slate-900">Relatório de Métricas Customizadas</p>
              <p class="text-[11px] text-slate-500 mt-1">Resumo e histórico de indicadores numéricos (custom fields) enviados pelas células.</p>
            </div>
          </label>

          <label class="flex items-start gap-3 p-4 border border-gray-200 bg-gray-50/50 rounded-xl cursor-pointer transition hover:bg-gray-50">
            <input type="radio" name="reportType" value="inativos" class="mt-1 w-4 h-4 text-primary accent-primary">
            <div>
              <p class="text-sm font-bold text-slate-900">Inativos / Afastados / Mudou-se</p>
              <p class="text-[11px] text-slate-500 mt-1">Lista completa de membros com status de saída ou afastamento — Inativo, Afastado e Mudou-se.</p>
            </div>
          </label>
        </div>
      </div>

      <div class="flex gap-3">
        <button id="cancel-pdf" type="button" class="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition">Cancelar</button>
        <button id="confirm-pdf" type="button" class="flex-1 py-3 text-sm font-bold text-white bg-primary hover:bg-blue-700 rounded-xl shadow-md transition flex items-center justify-center gap-2">Baixar Relatório</button>
      </div>
    </div>
  `;
    modalOverlay.classList.remove('hidden');

    const close = () => modalOverlay.classList.add('hidden');
    document.getElementById('close-pdf-modal').onclick = close;
    document.getElementById('cancel-pdf').onclick = close;

    document.getElementById('confirm-pdf').onclick = async () => {
      const selectedType = document.querySelector('input[name="reportType"]:checked').value;
      const btn = document.getElementById('confirm-pdf');
      btn.innerHTML = '<span class="spinner w-4 h-4 !m-0 border-2 border-white/20 border-t-white"></span> Processando...';
      btn.disabled = true;

      try {
        const payload = preparePdfPayload(d);
        const res = await fetch('/api/reports/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${store.token}`
          },
          body: JSON.stringify({ type: selectedType, payload })
        });

        if (!res.ok) throw new Error('Falha na geração');

        const blob = await res.blob();
        await store.downloadBlob(blob, `report_${selectedType}_${new Date().toISOString().split('T')[0]}.pdf`);

        toast('Relatório baixado!');
        close();
      } catch (e) {
        toast('Erro ao gerar relatório', 'error');
        btn.innerHTML = 'Baixar Relatório';
        btn.disabled = false;
      }
    };
  }

  function preparePdfPayload(d) {
    const s = store.systemSettings || {};

    const cellsTableData = store.getVisibleCells()
      .filter(c => !filterGeneration || c.generationId === filterGeneration)
      .filter(c => !filterCell || c.id === filterCell)
      .map(c => {
        const leader = c.leaderId ? (store.getUser(c.leaderId) || store.getPerson(c.leaderId)) : null;
        const atts = store.getAttendanceForCell(c.id).filter(a => {
          const adate = new Date(a.date);
          return adate >= d.startDate && adate <= d.endDate && a.records && a.records.length > 0;
        });
        let present = 0, total = 0;
        atts.forEach(a => {
          const p = a.records.filter(r => r.status === 'present').length;
          present += p;
          total += a.records.length;
        });
        const gen = c.generationId ? store.generations.find(g => g.id === c.generationId) : null;
        return {
          name: c.name,
          leader: leader?.name,
          generationName: gen?.name || '—',
          day: c.meetingDay,
          memberCount: store.getCellMembers(c.id).length,
          freqPct: total ? Math.round(present / total * 100) : 0,
          realizadas: atts.length,
          justificadas: store.getCellJustifications(c.id).length
        };
      });

    const showGenCol = !filterGeneration && !filterCell;
    if (showGenCol) {
      cellsTableData.sort((a, b) => a.generationName.localeCompare(b.generationName) || a.name.localeCompare(b.name));
    }

    const mappedPeople = d.people.map(p => {
      const c = p.cellId ? store.getCell(p.cellId) : null;
      return {
        name: p.name,
        status: p.status,
        cellName: c?.name,
        phone: p.phone,
        tracksData: p.tracksData,
        visitsCount: store.getVisitsForPerson(p.id).length
      }
    });

    return {
      logoUrl: s.logoUrl,
      appName: s.appName || s.congregationName || 'CRM Celular',
      congregationName: s.congregationName || '',
      congregationAddress: s.congregationAddress || '',
      pastorName: s.pastorName || '',
      nucleus: s.nucleus || '',
      periodLabel: d.periodLabel,
      total: d.total,
      novosConvertidos: d.novosConvertidos,
      reconciliacoes: d.reconciliacoes,
      visitantes: d.visitantes,
      visitsInPeriod: d.visitsInPeriod.map(v => ({
        date: v.date,
        personName: store.getPerson(v.personId)?.name,
        type: v.type,
        result: v.result,
        observation: v.observation
      })),
      consolidacoes: d.consolidacoes,
      acompanhamentos: d.acompanhamentos,
      freqPct: d.freqPct,
      activeCells: d.activeCells,
      noVisit: d.noVisit,
      noVisitDetails: d.noVisitDetails,
      zeroVisits: d.zeroVisits,
      zeroVisitsDetails: d.zeroVisitsDetails,
      avgMembers: d.avgMembers,
      tracks: store.tracks,
      trackCounts: d.trackCounts,
      people: mappedPeople,
      cellsTableData: cellsTableData,
      showGenerationCol: showGenCol,
      customFieldTotals: d.customFieldTotals || {},
      customFieldsConfig: (store.systemSettings?.cellCustomFields || '').split(',').map(s => s.trim()).filter(Boolean),
      metricsHistory: store.attendance.filter(a => {
        const adate = new Date(a.date);
        const cell = store.getCell(a.cellId);
        const matchesGen = !filterGeneration || (cell && cell.generationId === filterGeneration);
        const matchesCell = !filterCell || a.cellId === filterCell;
        return adate >= d.startDate && adate <= d.endDate && a.customFields && a.customFields !== '{}' && matchesGen && matchesCell;
      }).sort((a, b) => b.date.localeCompare(a.date)).map(a => {
        const cell = store.getCell(a.cellId);
        const leader = cell?.leaderId ? (store.getUser(cell.leaderId) || store.getPerson(cell.leaderId)) : null;
        let parsed = {};
        try { parsed = JSON.parse(a.customFields); } catch (e) { }
        return {
          date: a.date,
          cellName: cell?.name || '—',
          leaderName: leader?.name || '—',
          metrics: parsed
        };
      }),
      inativoPeople: store.people
        .filter(p => ['Inativo', 'Afastado', 'Mudou-se'].includes(p.status))
        .filter(p => {
          const cell = p.cellId ? store.getCell(p.cellId) : null;
          const matchesGen = !filterGeneration || (cell && cell.generationId === filterGeneration);
          const matchesCell = !filterCell || p.cellId === filterCell;
          return matchesGen && matchesCell;
        })
        .sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name))
        .map(p => {
          const c = p.cellId ? store.getCell(p.cellId) : null;
          return { name: p.name, status: p.status, cellName: c?.name || null, phone: p.phone || null };
        }),
      visibleCols: visibleCols
    };
  }

  function renderColSettings(visibleCols) {
    const tracks = store.tracks || [];
    const cols = [
      { id: 'status', label: 'Status' },
      { id: 'cell', label: 'Célula' },
      { id: 'phone', label: 'Telefone' },
      ...tracks.map(t => ({ id: t.id, label: t.name })),
      { id: 'visits', label: 'Visitas' }
    ];
    return `<div class="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center flex-wrap gap-2 sm:gap-4 transition-all">
    <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0"><span class="material-symbols-outlined text-[14px]">checklist</span> Colunas Visíveis:</span>
    <div class="flex flex-wrap gap-2">
      ${cols.map(c => `<label class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer bg-white border border-slate-200 hover:border-primary/50 px-2 py-1 rounded-lg select-none transition">
        <input type="checkbox" class="col-toggle accent-primary w-3.5 h-3.5" data-col="${c.id}" ${visibleCols[c.id] !== false ? 'checked' : ''}>
        ${c.label}
      </label>`).join('')}
    </div>
  </div>`;
  }
}
