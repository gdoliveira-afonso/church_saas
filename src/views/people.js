import { store } from '../store.js';
import { header, bottomNav, avatar, badge, riskDot, statusColor, toast, openModal, closeModal } from '../components/ui.js';

export function peopleView() {
  const app = document.getElementById('app');
  app.innerHTML = `
  ${header('Diretório de Pessoas', false)}
  <div class="bg-white border-b border-slate-100 px-4 md:px-6 py-3 flex flex-col md:flex-row gap-2">
      <div class="relative flex-1">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
        <input id="search" class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Buscar por nome…"/>
      </div>
      <div class="flex gap-2">
        ${store.systemSettings?.cellsEnabled !== false ? `
        <div class="relative flex-1 md:w-48">
          <select id="cell-filter" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none">
            <option value="">Todas as Células</option>
            ${store.getVisibleCells().map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
          <span class="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
        </div>` : ''}
        <div class="relative md:w-40">
          <select id="sort" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none">
            <option value="alpha">A-Z (Nome)</option>
            <option value="alpha-desc">Z-A (Nome)</option>
            <option value="recent">Mais Recentes</option>
          </select>
          <span class="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">sort_by_alpha</span>
        </div>
      </div>
    </div>
    <div class="flex gap-2 px-4 md:px-6 pb-2 overflow-x-auto no-scrollbar">
      ${['all', 'leaders-vices', 'not-baptized', 'no-school', 'no-encounter', 'no-visit', ...(store.systemSettings?.cellsEnabled !== false ? ['no-cell'] : [])].map((f, i) => {
    const labels = { all: 'Todos', 'leaders-vices': 'Líderes/Vices', 'not-baptized': 'Não Batizados', 'no-school': 'Sem Escola', 'no-encounter': 'Sem Encontro', 'no-visit': 'Sem Visita', 'no-cell': 'Sem Célula' };
    return `<button class="chip whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border transition ${i === 0 ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}" data-f="${f}">${labels[f]}</button>`;
  }).join('')}
    </div>
    <div class="px-4 md:px-6 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center"><span id="count" class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">0 membros</span></div>
  </header>
  <div class="flex-1 overflow-y-auto" id="list"></div>
  ${store.hasRole('ADMIN', 'SUPERVISOR') ? `
    <button onclick="location.hash='/people/new'" class="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition"><span class="material-symbols-outlined text-2xl">add</span></button>
    <button id="btn-import-csv" class="fixed bottom-20 md:bottom-8 right-20 md:right-24 w-10 h-10 bg-white border border-slate-200 text-slate-500 rounded-full shadow flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition" title="Importar CSV"><span class="material-symbols-outlined text-lg">upload_file</span></button>
  ` : ''}
  ${bottomNav('people')}`;

  let filter = 'all';
  const go = () => {
    const q = document.getElementById('search')?.value.toLowerCase() || '';
    const cf = document.getElementById('cell-filter')?.value || '';
    let pp = [...store.people];

    // Restrict view based on role
    if (!store.hasRole('ADMIN', 'SUPERVISOR')) {
      const myVisibleCellIds = store.getVisibleCells().map(c => c.id);
      pp = pp.filter(p => myVisibleCellIds.includes(p.cellId) || p.id === store.currentUser?.id);
    }

    const findTrackId = (name) => store.tracks.find(t => t.name.toLowerCase().includes(name.toLowerCase()))?.id;
    const tBatismo = findTrackId('Batismo nas Águas');
    const tEscola = findTrackId('Escola de Líderes');
    const tEncontro = findTrackId('Encontro com Deus');

    if (q) pp = pp.filter(p => p.name.toLowerCase().includes(q));
    if (cf) pp = pp.filter(p => p.cellId === cf);
    if (filter === 'leaders-vices') pp = pp.filter(p => p.status === 'Líder' || p.status === 'Vice-Líder');
    if (filter === 'not-baptized') pp = pp.filter(p => !p.tracksData?.[tBatismo]);
    if (filter === 'no-school') pp = pp.filter(p => !p.tracksData?.[tEscola]);
    if (filter === 'no-encounter') pp = pp.filter(p => !p.tracksData?.[tEncontro]);
    if (filter === 'no-visit') pp = pp.filter(p => p.status !== 'Líder' && !store.getVisitsForPerson(p.id).length);
    if (filter === 'no-cell') pp = pp.filter(p => !p.cellId);

    const sort = document.getElementById('sort')?.value || 'alpha';
    if (sort === 'alpha') pp.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'alpha-desc') pp.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === 'recent') pp.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    document.getElementById('count').textContent = `${pp.length} membros`;
    document.getElementById('list').innerHTML = pp.length ? `<div class="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:p-4">${pp.map(p => {
      const cell = p.cellId ? store.getCell(p.cellId) : null;
      return `<a href="#/profile?id=${p.id}" class="flex items-center gap-3 px-4 md:px-4 py-3 border-b md:border md:rounded-xl border-slate-100 hover:bg-slate-50 transition cursor-pointer group">
        <div class="relative">${avatar(p.name)}<span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 ${p.riskLevel === 'high' ? 'bg-red-500' : p.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-emerald-500'} border-2 border-white rounded-full"></span></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2"><p class="text-sm font-semibold truncate">${p.name}</p>${badge(p.status, statusColor(p.status))}</div>
          ${store.systemSettings?.cellsEnabled !== false ? `<p class="text-[11px] text-slate-500 truncate mt-0.5">${cell ? cell.name : 'Sem Célula'}</p>` : ''}
          <div class="flex gap-1.5 mt-1">
            ${store.tracks.map(t => {
        const done = p.tracksData && p.tracksData[t.id];
        return `<span class="material-symbols-outlined text-[14px] ${done ? `text-${t.color}-500 filled` : 'text-slate-300'}" title="${t.name}">${t.icon}</span>`;
      }).join('')}
          </div>
        </div>
        <span class="material-symbols-outlined text-slate-300 group-hover:text-primary text-lg">chevron_right</span>
      </a>`}).join('')}</div>` : `<div class="flex flex-col items-center justify-center py-16"><span class="material-symbols-outlined text-5xl text-slate-200 mb-3">person_off</span><p class="text-sm text-slate-400">Nenhuma pessoa encontrada</p></div>`;
  };
  go();
  document.getElementById('search').oninput = go;
  if(document.getElementById('cell-filter')) document.getElementById('cell-filter').onchange = go;
  document.getElementById('sort').onchange = go;
  document.querySelectorAll('.chip').forEach(b => b.onclick = () => {
    document.querySelectorAll('.chip').forEach(x => { x.classList.remove('bg-primary', 'text-white', 'border-primary'); x.classList.add('bg-white', 'text-slate-500', 'border-slate-200') });
    b.classList.add('bg-primary', 'text-white', 'border-primary'); b.classList.remove('bg-white', 'text-slate-500', 'border-slate-200');
    filter = b.dataset.f; go();
  });

  // CSV Import modal
  document.getElementById('btn-import-csv')?.addEventListener('click', () => {
    openModal(`
      <div class="p-5">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-base font-bold flex items-center gap-2"><span class="material-symbols-outlined text-primary">upload_file</span>Importar Membros via CSV</h3>
          <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600"><span class="material-symbols-outlined">close</span></button>
        </div>
        <p class="text-xs text-slate-500 mb-3">O arquivo CSV deve ter cabeçalho com as colunas: <strong>Nome</strong> (obrigatório), Status, Telefone, Email, Endereço.</p>
        <a href="data:text/csv;charset=utf-8,Nome,Status,Telefone,Email,Endere%C3%A7o%0AMaria%20Silva,Membro,(11)99999-9999,maria@email.com," download="modelo_importacao.csv" class="inline-flex items-center gap-1 text-xs text-primary underline mb-4"><span class="material-symbols-outlined text-sm">download</span>Baixar modelo CSV</a>
        <input type="file" id="csv-file-input" accept=".csv,text/csv" class="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-blue-700 mb-4 cursor-pointer"/>
        <div id="csv-preview" class="hidden"></div>
        <div class="flex gap-2 mt-4">
          <button onclick="closeModal()" class="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition">Cancelar</button>
          <button id="btn-confirm-import" class="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-700 transition hidden">Importar</button>
        </div>
      </div>
    `);

    let parsedRows = [];

    document.getElementById('csv-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { toast('CSV inválido ou vazio', 'error'); return; }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        parsedRows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
          return obj;
        }).filter(r => (r['Nome'] || r['name'] || '').trim());

        const preview = document.getElementById('csv-preview');
        preview.innerHTML = `
          <div class="bg-slate-50 rounded-lg p-3 mb-2 border border-slate-200">
            <p class="text-xs font-semibold text-slate-700 mb-2">${parsedRows.length} linha(s) encontrada(s). Prévia:</p>
            <div class="overflow-x-auto max-h-40">
              <table class="text-[11px] w-full">
                <thead><tr class="text-slate-400 uppercase">${headers.map(h => `<th class="px-2 py-1 text-left">${h}</th>`).join('')}</tr></thead>
                <tbody>${parsedRows.slice(0, 5).map(r => `<tr class="border-t border-slate-100">${headers.map(h => `<td class="px-2 py-1 text-slate-600">${r[h] || '—'}</td>`).join('')}</tr>`).join('')}</tbody>
              </table>
              ${parsedRows.length > 5 ? `<p class="text-[10px] text-slate-400 mt-1">...e mais ${parsedRows.length - 5} linha(s)</p>` : ''}
            </div>
          </div>`;
        preview.classList.remove('hidden');
        document.getElementById('btn-confirm-import').classList.remove('hidden');
      };
      reader.readAsText(file, 'UTF-8');
    });

    document.getElementById('btn-confirm-import').addEventListener('click', async () => {
      const btn = document.getElementById('btn-confirm-import');
      btn.disabled = true;
      btn.textContent = 'Importando...';
      try {
        const res = await store.apiFetch('/people/import', { method: 'POST', body: JSON.stringify({ rows: parsedRows }) });
        closeModal();
        toast(`${res.created} membros importados com sucesso!`);
        if (res.errors?.length) toast(`${res.errors.length} erro(s) na importação`, 'warning');
        store.people = await store.apiFetch('/people');
        go();
      } catch (e) {
        toast('Erro ao importar', 'error');
        btn.disabled = false;
        btn.textContent = 'Importar';
      }
    });
  });
}

// ── Add/Edit Person ──
export function personFormView(params) {
  const app = document.getElementById('app');
  const isEdit = !!params?.id && params.id !== 'new';
  const p = isEdit ? store.getPerson(params.id) : null;

  const isTrackVisible = (track, person) => {
    if (!track.targetMetadata) return true;
    try {
      const target = JSON.parse(track.targetMetadata);
      if (target.everyone) return true;

      const personStatus = person?.status || document.getElementById('inp-status')?.value;
      if (target.statuses && target.statuses.length > 0) {
        if (target.statuses.includes(personStatus)) return true;
      }

      if (target.generations && target.generations.length > 0) {
        const cellId = person?.cellId || document.getElementById('inp-cell')?.value;
        const cell = cellId ? store.getCell(cellId) : null;
        const genId = cell?.generationId || person?.generationId;
        if (genId && target.generations.includes(genId)) return true;
      }

      return false;
    } catch (e) { return true; }
  };
  const title = isEdit ? 'Editar Membro' : 'Cadastrar Membro';

  app.innerHTML = `
  ${header(title, true)}
    <div class="flex-1 overflow-y-auto px-4 md:px-6 lg:px-10 py-5 md:max-w-2xl md:mx-auto w-full">
      <form id="person-form" class="space-y-4">
        ${field('Nome', 'inp-name', p?.name || '')}
        ${field('Telefone', 'inp-phone', p?.phone || '', 'tel')}
        ${field('Data de Nascimento', 'inp-birth', p?.birthdate || '', 'date')}
        ${field('Endereço', 'inp-addr', p?.address || '')}
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Status</label>
          <select id="inp-status" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
            ${(() => {
      const opts = ['Visitante', 'Novo Convertido', 'Membro', 'Reconciliação'];
      const inactiveOpts = ['Inativo', 'Afastado', 'Mudou-se'];
      const isTeamMember = store.users.some(u => u.name.toLowerCase() === p?.name?.toLowerCase());
      if (p?.status === 'Líder' || isTeamMember) opts.push('Líder');
      if (p?.status === 'Vice-Líder' || isTeamMember) opts.push('Vice-Líder');
      if (p?.status && !opts.includes(p.status) && !inactiveOpts.includes(p.status)) opts.push(p.status);
      return `<optgroup label="Ativos">${[...new Set(opts)].map(s => `<option ${p?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</optgroup>
              <optgroup label="Inativos / Saída">${inactiveOpts.map(s => `<option ${p?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</optgroup>`;
    })()}
          </select>
        </div>
        ${store.systemSettings?.cellsEnabled !== false ? `
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Célula</label>
          <select id="inp-cell" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Sem célula</option>
            ${store.getVisibleCells().map(c => `<option value="${c.id}" ${p?.cellId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
          ${(p?.status === 'Líder' || p?.status === 'Vice-Líder') ? `<p class="text-[10px] text-slate-400 mt-1">Célula de participação (independente da célula que lidera).</p>` : ''}
        </div>` : '<input type="hidden" id="inp-cell" value=""/>'}
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-2 block">Marcos Espirituais & Retiros</label>
          <div class="grid grid-cols-2 lg:grid-cols-3 gap-2" id="tracks-container">
            ${store.tracks.filter(t => isTrackVisible(t, p)).map(t => {
      const isChecked = p?.tracksData ? p.tracksData[t.id] : false;
      return `<label class="flex items-center gap-2.5 px-3 py-3 rounded-xl border border-slate-200 bg-white hover:border-${t.color}-300 hover:bg-${t.color}-50/30 transition cursor-pointer has-[:checked]:border-${t.color}-400 has-[:checked]:bg-${t.color}-50/50">
              <input type="checkbox" id="chk-${t.id}" ${isChecked ? 'checked' : ''} class="sr-only peer track-checkbox" data-track-id="${t.id}"/>
              <div class="w-8 h-8 rounded-lg bg-${t.color}-100 flex items-center justify-center text-${t.color}-400 peer-checked:bg-${t.color}-500 peer-checked:text-white transition shrink-0"><span class="material-symbols-outlined text-base">${t.icon}</span></div>
              <span class="text-xs font-medium text-slate-600 leading-tight">${t.name}</span>
            </label>`;
    }).join('')}
          </div>
        </div>
        ${isEdit && store.systemSettings?.ebdEnabled ? `<div id="ebd-person-section" class="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-400 text-center animate-pulse">Carregando dados EBD...</div>` : ''}
        <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 active:scale-[.98] transition-all">${isEdit ? 'Salvar Alterações' : 'Cadastrar Pessoa'}</button>
        ${isEdit && store.hasRole('ADMIN', 'SUPERVISOR') ? `<button type="button" id="btn-del-person" class="w-full bg-red-50 text-red-600 border border-red-200 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-100 transition">Excluir Pessoa</button>` : ''}
      </form>
    </div>`;

  // Seção EBD — carrega assincronamente após render
  if (isEdit && store.systemSettings?.ebdEnabled && params?.id) {
    store.apiFetch(`/ebd/person/${params.id}`).then(ebd => {
      const sec = document.getElementById('ebd-person-section');
      if (!sec) return;
      if (!ebd || ebd.enrolled === false) {
        sec.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-slate-400 text-base">menu_book</span>
              <div>
                <p class="text-xs font-semibold text-slate-700">EBD</p>
                <p class="text-[11px] text-slate-400">Não matriculado</p>
              </div>
            </div>
            ${store.hasRole('ADMIN', 'SUPERVISOR') || store.hasSecondaryRole('SUPERINTENDENTE_EBD') ? `<button id="btn-ebd-enroll" class="text-xs font-semibold text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition">Matricular na EBD</button>` : ''}
          </div>`;
        document.getElementById('btn-ebd-enroll')?.addEventListener('click', () => openEbdEnrollModal(params.id));
      } else {
        const pct = ebd.percentual ?? 0;
        const color = pct >= 70 ? 'emerald' : pct >= 50 ? 'amber' : 'red';
        sec.innerHTML = `
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <span class="material-symbols-outlined text-purple-500 text-base">menu_book</span>
              <div class="min-w-0">
                <p class="text-xs font-semibold text-slate-700 truncate">${ebd.class?.name || 'Classe EBD'}</p>
                <p class="text-[11px] text-slate-400">${ebd.totalAulas} aula(s) · <span class="font-semibold text-${color}-600">${pct}% presença</span></p>
              </div>
            </div>
            ${store.hasRole('ADMIN', 'SUPERVISOR') || store.hasSecondaryRole('SUPERINTENDENTE_EBD') ? `<button id="btn-ebd-enroll" class="shrink-0 text-xs font-semibold text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition">Trocar Classe</button>` : ''}
          </div>`;
        document.getElementById('btn-ebd-enroll')?.addEventListener('click', () => openEbdEnrollModal(params.id, ebd.studentId, ebd.class?.id));
      }
    }).catch(() => {
      const sec = document.getElementById('ebd-person-section');
      if (sec) sec.remove();
    });
  }

  function openEbdEnrollModal(personId, currentStudentId, currentClassId) {
    const classes = store.ebdClasses || [];
    if (!classes.length) { toast('Nenhuma classe EBD disponível', 'warning'); return; }
    openModal(`<div class="p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-base font-bold">Matricular na EBD</h3>
        <button onclick="closeModal()" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400 text-xl">close</span></button>
      </div>
      <div class="space-y-2">
        ${classes.map(c => `
          <button class="btn-pick-class w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-primary/40 hover:bg-primary/5 transition text-left" data-class-id="${c.id}">
            <div>
              <p class="text-sm font-semibold text-slate-800">${c.name}</p>
              <p class="text-[11px] text-slate-400">${c.faixaEtaria || ''} · ${c._count?.students || 0} aluno(s)</p>
            </div>
            <span class="material-symbols-outlined text-slate-300 text-lg">chevron_right</span>
          </button>`).join('')}
      </div>
    </div>`);
    document.querySelectorAll('.btn-pick-class').forEach(btn => {
      btn.addEventListener('click', async () => {
        const classId = btn.dataset.classId;
        btn.disabled = true;
        try {
          // Remove da classe ANTIGA com o classId correto
          if (currentStudentId && currentClassId) {
            await store.apiFetch(`/ebd/classes/${currentClassId}/students/${currentStudentId}`, { method: 'DELETE' });
          }
          await store.enrollEbdStudent(classId, personId);
          toast('Matriculado na EBD!');
          closeModal();
          personFormView(params); // Re-render to update EBD section
        } catch (err) {
          toast(err.message || 'Erro ao matricular', 'error');
          btn.disabled = false;
        }
      });
    });
  }

  const phoneInp = document.getElementById('inp-phone');
  if (phoneInp) {
    const formatPhone = (val) => {
      let v = val.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
      v = v.replace(/(\d)(\d{4})$/, '$1-$2');
      return v;
    };
    phoneInp.addEventListener('input', (e) => e.target.value = formatPhone(e.target.value));
    if (phoneInp.value) phoneInp.value = formatPhone(phoneInp.value);
  }

  const updateTracks = () => {
    const container = document.getElementById('tracks-container');
    if (!container) return;
    const currentStatus = document.getElementById('inp-status').value;
    const currentCellId = document.getElementById('inp-cell').value;
    const currentPerson = { ...p, status: currentStatus, cellId: currentCellId };

    container.innerHTML = store.tracks.filter(t => isTrackVisible(t, currentPerson)).map(t => {
      const isChecked = p?.tracksData ? p.tracksData[t.id] : false;
      return `<label class="flex items-center gap-2.5 px-3 py-3 rounded-xl border border-slate-200 bg-white hover:border-${t.color}-300 hover:bg-${t.color}-50/30 transition cursor-pointer has-[:checked]:border-${t.color}-400 has-[:checked]:bg-${t.color}-50/50">
              <input type="checkbox" id="chk-${t.id}" ${isChecked ? 'checked' : ''} class="sr-only peer track-checkbox" data-track-id="${t.id}"/>
              <div class="w-8 h-8 rounded-lg bg-${t.color}-100 flex items-center justify-center text-${t.color}-400 peer-checked:bg-${t.color}-500 peer-checked:text-white transition shrink-0"><span class="material-symbols-outlined text-base">${t.icon}</span></div>
              <span class="text-xs font-medium text-slate-600 leading-tight">${t.name}</span>
            </label>`;
    }).join('');
  };

  document.getElementById('inp-status').onchange = updateTracks;
  document.getElementById('inp-cell').onchange = updateTracks;

  document.getElementById('person-form').onsubmit = async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn.innerHTML;
    btn.innerHTML = 'Salvando...'; btn.disabled = true;

    const tracksPayload = {};
    document.querySelectorAll('.track-checkbox').forEach(chk => {
      if (chk.checked) tracksPayload[chk.dataset.trackId] = true;
    });

    const data = {
      name: document.getElementById('inp-name').value.trim(),
      phone: document.getElementById('inp-phone').value.trim(),
      birthdate: document.getElementById('inp-birth').value,
      address: document.getElementById('inp-addr').value.trim(),
      status: document.getElementById('inp-status').value,
      cellId: document.getElementById('inp-cell').value || null,
      joinedDate: p?.joinedDate || new Date().toISOString().split('T')[0],
      riskLevel: p?.riskLevel || 'low',
      tracksData: tracksPayload,
      discipleship: p?.discipleship || { primeiroContato: { done: true, date: new Date().toISOString().split('T')[0] } },
    };
    if (!data.name) { toast('Preencha o nome', 'error'); btn.innerHTML = origText; btn.disabled = false; return }

    try {
      if (isEdit) { await store.updatePerson(params.id, data); toast('Pessoa atualizada!'); history.back(); }
      else { await store.addPerson(data); toast('Pessoa cadastrada!'); location.hash = '/people'; }
    } catch (err) {
      toast('Servidor indisponível', 'error');
      btn.innerHTML = origText; btn.disabled = false;
    }
  };
  if (isEdit) {
    document.getElementById('btn-del-person')?.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(`<div class="p-6 text-center">
        <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <span class="material-symbols-outlined text-3xl">warning</span>
        </div>
        <h3 class="text-lg font-bold text-slate-800 mb-2">Excluir esta pessoa?</h3>
        <p class="text-sm text-slate-500 mb-6">Esta ação não pode ser desfeita. Todos os dados desta pessoa serão removidos permanentemente.</p>
        <div class="flex gap-3">
          <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition">Cancelar</button>
          <button id="btn-confirm-del-person" class="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition shadow-sm border border-red-700">Excluir</button>
        </div>
      </div>`);

      document.getElementById('btn-confirm-del-person').onclick = async () => {
        const btn = document.getElementById('btn-confirm-del-person');
        btn.innerHTML = 'Excluindo...'; btn.disabled = true;
        try {
          await store.deletePerson(params.id);
          closeModal();
          toast('Pessoa excluída com sucesso');
          location.hash = '/people';
        } catch (e) { toast('Erro ao excluir', 'error'); btn.innerHTML = 'Excluir'; btn.disabled = false; }
      };
    });
  }
}
function field(label, id, val = '', type = 'text') {
  return `<div><label class="text-xs font-semibold text-slate-600 mb-1 block">${label}</label><input id="${id}" type="${type}" value="${val}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition"/></div>`;
}
