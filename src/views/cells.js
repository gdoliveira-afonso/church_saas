import { store } from '../store.js';
import { header, bottomNav, avatar, toast, openModal, closeModal } from '../components/ui.js';

export function cellsView(params) {
  const app = document.getElementById('app');

  const org = store.currentOrganization;
  const isDemo = org?.plan === 'demo';
  const cellCount = (store.cells || []).length;
  const demoLimitReached = isDemo && cellCount >= 2;

  const canAddCell = store.hasRole('ADMIN', 'SUPERVISOR') && !demoLimitReached;

  app.innerHTML = `
  ${header('Células', false)}
  ${demoLimitReached ? `
  <div class="bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-center gap-3">
    <span class="material-symbols-outlined text-orange-500 text-xl shrink-0">warning</span>
    <div class="min-w-0">
      <p class="text-sm font-bold text-orange-800">Limite do plano Demo atingido (${cellCount}/2 células)</p>
      <p class="text-xs text-orange-600">Para criar mais células, peça ao administrador SaaS para fazer o upgrade do plano.</p>
    </div>
  </div>` : ''}
  <div class="bg-white px-4 md:px-6 py-3 border-b border-slate-100 flex flex-col md:flex-row gap-2">
    <div class="relative flex-1">
      <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
      <input id="search-cells" class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Buscar célula por nome…"/>
    </div>
    ${store.hasRole('ADMIN', 'SUPERVISOR') ? `
    <div class="relative md:w-56">
      <select id="gen-filter" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none">
        <option value="">Todas as Gerações</option>
        ${(store.generations || []).map(g => `<option value="${g.id}" ${params?.generationId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
      </select>
      <span class="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
    </div>` : ''}
  </div>
  <div id="cells-list" class="flex-1 overflow-y-auto px-4 md:px-6 py-4 bg-slate-50/30 pb-24"></div>
  ${canAddCell ? `<button id="btn-float-add-cell" class="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition"><span class="material-symbols-outlined text-2xl">add</span></button>` : ''}
  ${bottomNav('cells')}`;


  const go = () => {
    const q = document.getElementById('search-cells')?.value.toLowerCase() || '';
    const gf = document.getElementById('gen-filter')?.value || '';
    let cc = store.getVisibleCells();

    if (q) cc = cc.filter(c => c.name.toLowerCase().includes(q));
    if (gf) cc = cc.filter(c => c.generationId === gf);

    document.getElementById('cells-list').innerHTML = cc.length ? `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">${cc.map(c => {
      const leader = store.users.find(u => u.id === c.leaderId); const vice = c.viceLeaderId ? store.users.find(u => u.id === c.viceLeaderId) : null; const mem = store.getCellMembers(c.id);
      return `<a href="#/cell?id=${c.id}" class="block bg-white rounded-xl p-4 border border-slate-100 hover:border-primary/30 hover:shadow-sm transition group">
      <div class="flex items-center gap-3 mb-3"><div class="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600"><span class="material-symbols-outlined">diversity_3</span></div><div class="flex-1"><h3 class="text-sm font-bold">${c.name}</h3><p class="text-[11px] text-slate-500">${c.meetingDay || ''} ${c.meetingTime ? 'às ' + c.meetingTime : ''}</p></div><span class="material-symbols-outlined text-slate-300 group-hover:text-primary text-lg">chevron_right</span></div>
      <div class="flex flex-col text-[11px] text-slate-500 mb-2 space-y-0.5"><span>Líder: ${leader?.name || 'N/A'}</span>${vice ? `<span>Vice: ${vice.name}</span>` : ''}<span>Membros: ${mem.length}</span></div>
    </a>`}).join('')}</div>` : `<div class="flex flex-col items-center justify-center py-16"><span class="material-symbols-outlined text-5xl text-slate-200 mb-3">group_off</span><p class="text-sm text-slate-400">Nenhuma célula encontrada</p>${store.hasRole('ADMIN', 'SUPERVISOR') ? `<button id="btn-empty-add" class="mt-3 text-sm text-primary font-semibold">+ Criar primeira célula</button>` : ''}</div>`;

    document.getElementById('btn-empty-add')?.addEventListener('click', () => cellForm());
  };

  go();
  document.getElementById('search-cells').oninput = go;
  const genFilt = document.getElementById('gen-filter');
  if (genFilt) genFilt.onchange = go;

  const addBtn = document.getElementById('btn-float-add-cell');
  if (addBtn) addBtn.onclick = () => cellForm();
}

function cellForm(cellId) {
  const c = cellId ? store.getCell(cellId) : null;
  openModal(`<div class="p-6"><div class="flex justify-between items-center mb-5"><h3 class="text-base font-bold">${c ? 'Editar' : 'Nova'} Célula</h3><button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400 text-xl">close</span></button></div>
  <form id="cell-form" class="space-y-3">
    <div><label class="text-xs font-semibold text-slate-600 mb-1 block">Nome</label><input id="cf-name" value="${c?.name || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Célula Zona Sul"/></div>
    <div><label class="text-xs font-semibold text-slate-600 mb-1 block">Dia da Semana</label><select id="cf-day" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
      <option value="">Selecionar dia...</option>
      ${['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map(d => `<option value="${d}" ${c?.meetingDay === d ? 'selected' : ''}>${d}</option>`).join('')}
    </select></div>
    <div><label class="text-xs font-semibold text-slate-600 mb-1 block">Horário</label><input id="cf-time" type="time" value="${c?.meetingTime || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/></div>
    <div><label class="text-xs font-semibold text-slate-600 mb-1 block">Endereço</label><input id="cf-addr" value="${c?.address || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none" placeholder="Rua..."/></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="text-xs font-semibold text-slate-600 mb-1 block">Líder</label>
      <select id="cf-leader" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
        <option value="">Selecionar...</option>${store.users.map(u => `<option value="${u.id}" ${c?.leaderId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
      </select></div>
      <div><label class="text-xs font-semibold text-slate-600 mb-1 block">Vice-Líder (Opcional)</label>
      <select id="cf-vice-leader" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
        <option value="">Nenhum...</option>${store.users.map(u => `<option value="${u.id}" ${c?.viceLeaderId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
      </select></div>
    </div>
    <div><label class="text-xs font-semibold text-slate-600 mb-1 block">Geração (Opcional)</label>
      <select id="cf-generation" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
        <option value="">Nenhuma / Não se aplica</option>
        ${(store.generations || []).map(g => `<option value="${g.id}" ${c?.generationId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
      </select>
    </div>
    <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition mt-2">${c ? 'Salvar' : 'Criar Célula'}</button>
    ${c ? `<button type="button" id="btn-del-cell" class="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg text-sm font-semibold hover:bg-red-100">Excluir Célula</button>` : ''}
  </form></div>`);
  document.getElementById('cell-form').onsubmit = async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML; btn.innerHTML = 'Salvando...'; btn.disabled = true;

    const data = { name: document.getElementById('cf-name').value.trim(), meetingDay: document.getElementById('cf-day').value, meetingTime: document.getElementById('cf-time').value, address: document.getElementById('cf-addr').value, leaderId: document.getElementById('cf-leader').value, viceLeaderId: document.getElementById('cf-vice-leader').value || null, generationId: document.getElementById('cf-generation').value || null, region: '' };
    if (!data.name) { toast('Nome obrigatório', 'error'); btn.innerHTML = orig; btn.disabled = false; return }

    try {
      if (c) { await store.updateCell(cellId, data); toast('Célula atualizada!') } else { await store.addCell(data); toast('Célula criada!') }
      closeModal(); cellsView();
    } catch (err) {
      btn.innerHTML = orig; btn.disabled = false;
      // Plano demo atingiu limite — mostrar popup sem deslogar
      if (err.status === 402 || err.data?.limitReached) {
        openModal(`
          <div class="p-6 text-center">
            <div class="w-16 h-16 rounded-2xl bg-orange-100 text-orange-500 flex items-center justify-center mx-auto mb-4">
              <span class="material-symbols-outlined text-3xl">lock</span>
            </div>
            <h2 class="text-xl font-black text-slate-900 mb-1">Limite do Plano Demo</h2>
            <p class="text-sm text-slate-500 mb-4">
              O plano <strong>Demo</strong> permite no máximo <strong>2 células</strong>.<br>
              Para criar mais células, solicite ao administrador SaaS o upgrade para o plano <strong>Normal</strong>.
            </p>
            <div class="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-5">
              <p class="text-xs text-orange-700 font-medium">Suas células existentes e todos os dados continuam funcionando normalmente.</p>
            </div>
            <button onclick="closeModal()" class="w-full bg-primary text-white py-3 rounded-xl text-sm font-bold hover:opacity-90 transition">Entendido</button>
          </div>`);
      } else {
        toast(err.message || 'Servidor indisponível', 'error');
      }
    }

  };
  document.getElementById('btn-del-cell')?.addEventListener('click', async (e) => {
    if (confirm('Excluir esta célula?')) {
      const btn = e.target;
      const orig = btn.innerHTML; btn.innerHTML = 'Excluindo...'; btn.disabled = true;
      try {
        await store.deleteCell(cellId); toast('Célula excluída'); closeModal(); cellsView()
      } catch (err) { toast('Erro ao excluir', 'error'); btn.innerHTML = orig; btn.disabled = false; }
    }
  });
}

export async function cellDetailView(params) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="flex-1 flex flex-col items-center justify-center bg-slate-50/50"><div class="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div><p class="text-sm text-slate-500 font-medium">Carregando detalhes da célula...</p></div>';

  const c = store.getCell(params?.id);
  if (!c) { app.innerHTML = '<div class="flex-1 flex items-center justify-center text-slate-400">Célula não encontrada</div>'; return }

  if (!store.hasRole('ADMIN', 'SUPERVISOR') && c.leaderId !== store.currentUser?.id && c.viceLeaderId !== store.currentUser?.id && !(store.currentUser?.role === 'LIDER_GERACAO' && c.generationId === store.currentUser?.generationId)) {
    app.innerHTML = '<div class="flex-1 flex items-center justify-center text-slate-400">Você não tem permissão para visualizar esta célula.</div>'; return;
  }

  const mem = store.getCellMembers(c.id); const leader = store.users.find(u => u.id === c.leaderId);
  const att = store.getAttendanceForCell(c.id);

  // Always fetch fresh fields from dedicated endpoint (bypasses Prisma client issue)
  const rawFields = await store.getCellFields();
  const customFieldsConfig = (rawFields || '').split(',').map(s => s.trim()).filter(Boolean);


  let customFieldsHtml = '';
  if (customFieldsConfig.length > 0) {
    customFieldsHtml = `
      <div class="bg-white rounded-xl p-5 border border-slate-100 shadow-sm mb-5">
        <h3 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><span class="material-symbols-outlined text-primary">analytics</span> Lançar Novas Métricas</h3>
        
        <div class="mb-4">
          <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Data de Referência</label>
          <input type="date" id="metrics-date" value="${new Date().toISOString().split('T')[0]}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"/>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="metrics-custom-fields-container">
        ${customFieldsConfig.map((cf) => `
          <div>
            <label class="text-[11px] font-semibold text-slate-500 mb-1 block">${cf}</label>
            <input type="number" min="0" data-cf-name="${cf}" placeholder="0" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700" />
          </div>`).join('')}
        </div>
        
        <button id="btn-save-metrics" class="w-full mt-6 bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition shadow-sm flex justify-center items-center gap-2"><span class="material-symbols-outlined text-lg">save</span> Salvar Lançamento</button>
      </div>

      <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Histórico de Lançamentos</h3>
      <div id="recent-metrics-container">
         ${att.filter(a => a.customFields).slice(0, 10).map(a => {
      let parsed = {}; try { parsed = JSON.parse(a.customFields) } catch (e) { }
      if (Object.keys(parsed).length === 0) return '';
      return `<div class="bg-white border border-slate-100 p-4 rounded-xl mb-3 shadow-sm">
             <div class="flex justify-between items-center mb-3"><span class="text-xs font-bold text-slate-500">Data: ${a.date.split('-').reverse().join('/')}</span></div>
             <div class="grid grid-cols-2 gap-3">
               ${Object.entries(parsed).map(([k, v]) => `<div class="bg-slate-50 rounded-lg py-2 px-3 text-[11px] flex justify-between items-center"><span class="text-slate-500">${k}</span><span class="font-bold text-slate-800 text-sm">${v}</span></div>`).join('')}
             </div>
           </div>`;
    }).join('')}
         ${!att.some(a => a.customFields) ? '<p class="text-[11px] text-slate-400 text-center py-4">Nenhum lançamento feito ainda.</p>' : ''}
      </div>
    `;
  } else {
    customFieldsHtml = `<div class="text-sm text-slate-400 text-center py-8">Nenhuma métrica customizada configurada. Peça ao administrador para configurar em Configurações > Métricas & Campos.</div>`
  }

  app.innerHTML = `
  ${header(c.name, true, store.hasRole('ADMIN', 'SUPERVISOR') ? `<button id="btn-edit-cell" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"><span class="material-symbols-outlined text-lg">edit</span></button>` : '')}
  
  <div class="bg-white border-b border-slate-200 sticky top-14 z-10 px-4 md:px-6 flex gap-6 overflow-x-auto no-scrollbar">
    <button class="cell-tab active whitespace-nowrap py-3.5 text-sm font-bold text-primary border-b-2 border-primary transition-colors" data-target="tab-info">Informações da Célula</button>
    <button class="cell-tab whitespace-nowrap py-3.5 text-sm font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent transition-colors" data-target="tab-metrics">Métricas / Lançamentos</button>
  </div>

  <div class="flex-1 overflow-y-auto bg-slate-50/30 pb-24">
    <div id="tab-info" class="tab-content block">
      <div class="px-4 md:px-6 py-4 bg-white border-b border-slate-100 space-y-1.5 shadow-sm">
        ${c.address ? `<p class="flex items-center gap-2 text-sm text-slate-600"><span class="material-symbols-outlined text-[16px]">location_on</span>${c.address}</p>` : ''}
        <p class="flex items-center gap-2 text-sm text-slate-600"><span class="material-symbols-outlined text-[16px]">calendar_today</span>${c.meetingDay || '-'} ${c.meetingTime ? 'às ' + c.meetingTime : ''}</p>
        <div class="flex items-center gap-2 text-sm text-slate-600"><span class="material-symbols-outlined text-[16px]">person</span>Líder: ${leader?.name || 'N/A'}</div>
        ${c.viceLeaderId ? `<div class="flex items-center gap-2 text-sm text-slate-600"><span class="material-symbols-outlined text-[16px]">person_outline</span>Vice: ${store.users.find(u => u.id === c.viceLeaderId)?.name || 'N/A'}</div>` : ''}
      </div>
      <div class="px-4 md:px-6 py-4"><h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Membros Atuais (${mem.length})</h3>
        <div class="md:grid md:grid-cols-2 md:gap-3 space-y-2 md:space-y-0 mb-6">${mem.map(m => `<a href="#/profile?id=${m.id}" class="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-primary/30 transition shadow-sm cursor-pointer">${avatar(m.name, 'h-9 w-9')}<div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate text-slate-800">${m.name}</p><p class="text-[11px] text-slate-500">${m.status}</p></div><span class="material-symbols-outlined text-slate-300 text-lg group-hover:text-primary">chevron_right</span></a>`).join('')}
        ${!mem.length ? '<p class="text-[12px] text-slate-400 text-center py-6 bg-slate-50 border border-dashed rounded-xl">Nenhum membro nesta célula, vá em Pessoas e adicione membros à esta celula.</p>' : ''}
        </div>
        <div class="mb-6"><a href="#/attendance?cellId=${c.id}" class="flex items-center justify-center gap-2 w-full bg-primary text-white py-3.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition shadow-sm hover:-translate-y-0.5"><span class="material-symbols-outlined text-lg">checklist</span>Registrar Presença do Encontro</a></div>
        ${att.filter(a => a.records && a.records.length > 0).length ? `<div class="pb-10"><h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Últimos Encontros</h3>${att.filter(a => a.records && a.records.length > 0).slice(0, 3).map(a => `<div class="p-4 bg-white rounded-xl border border-slate-100 mb-3 shadow-sm"><div class="flex justify-between items-center text-sm mb-2"><span class="font-bold text-slate-700">${a.date.split('-').reverse().join('/')}</span><span class="text-primary font-bold bg-primary/10 px-2.5 py-1 rounded-lg">${a.records.filter(r => r.status === 'present').length}/${a.records.length} presenças</span></div>${a.notes ? `<p class="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2 rounded">${a.notes}</p>` : ''}</div>`).join('')}</div>` : ''}
      </div>
    </div>

    <div id="tab-metrics" class="tab-content hidden pb-10">
      <div class="px-4 md:px-6 py-6 max-w-2xl mx-auto">
        ${customFieldsHtml}
      </div>
    </div>
  </div>`;

  // Tab functionality
  document.querySelectorAll('.cell-tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.cell-tab').forEach(x => { x.classList.remove('active', 'text-primary', 'border-primary', 'font-bold'); x.classList.add('text-slate-500', 'font-medium', 'border-transparent'); });
    t.classList.remove('text-slate-500', 'font-medium', 'border-transparent'); t.classList.add('active', 'text-primary', 'border-primary', 'font-bold');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden', 'opacity-0'));

    const target = document.getElementById(t.dataset.target);
    target.classList.remove('hidden');
    setTimeout(() => target.classList.remove('opacity-0'), 10);
  });

  const editBtn = document.getElementById('btn-edit-cell');
  if (editBtn) editBtn.onclick = () => cellForm(c.id);

  const saveMetricsBtn = document.getElementById('btn-save-metrics');
  if (saveMetricsBtn) {
    saveMetricsBtn.onclick = async (e) => {
      const btn = e.currentTarget;
      const metricsDate = document.getElementById('metrics-date').value;
      if (!metricsDate) return toast('Selecione a data de referência.', 'warning');

      const orig = btn.innerHTML; btn.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">sync</span> Salvando...'; btn.disabled = true;

      const customFieldsPayload = {};
      document.querySelectorAll('#metrics-custom-fields-container input[type="number"]').forEach(inp => {
        const val = parseInt(inp.value, 10);
        if (!isNaN(val) && val > 0) {
          customFieldsPayload[inp.dataset.cfName] = val;
        }
      });

      if (Object.keys(customFieldsPayload).length === 0) {
        toast('Preencha ao menos uma métrica com valor maior que 0.', 'warning');
        btn.innerHTML = orig; btn.disabled = false;
        return;
      }

      try {
        await store.addAttendance({
          cellId: c.id, date: metricsDate,
          customFields: JSON.stringify(customFieldsPayload)
        });
        toast('Métricas lançadas com sucesso!');

        // Refresh local cache via API call instead of page hash reload if cache gets stale
        location.reload();
      } catch (err) { toast('Erro de conexão ao salvar métricas', 'error'); btn.innerHTML = orig; btn.disabled = false; }
    };
  }
}
