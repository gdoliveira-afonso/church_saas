import { store } from '../store.js';
import { header, toast, bottomNav, openModal, closeModal } from '../components/ui.js';

function fmtBRL(v) { return 'R$ ' + (Number(v||0) / 100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }

function maskCurrency(input) {
  input.addEventListener('input', () => {
    let digits = input.value.replace(/\D/g, '');
    if (!digits) { input.value = ''; return; }
    let cents = parseInt(digits, 10);
    input.value = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
}

function parseCurrency(input) {
  const raw = input.value.replace(/\./g, '').replace(',', '.');
  return Math.round(parseFloat(raw || '0') * 100);
}
function fmtDate(d) { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonthISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; }

const DON_TYPE_LABEL  = { DIZIMO: 'Dízimo', OFERTA: 'Oferta', OFERTA_ESPECIAL: 'Oferta Especial', PRIMICIA: 'Primícia', OUTRO: 'Contribuição' };
const DON_TYPE_COLOR  = { DIZIMO: 'bg-blue-50 text-blue-700', OFERTA: 'bg-emerald-50 text-emerald-700', OFERTA_ESPECIAL: 'bg-purple-50 text-purple-700', PRIMICIA: 'bg-amber-50 text-amber-700', OUTRO: 'bg-slate-100 text-slate-600' };
const PAY_METHOD_LABEL = { DINHEIRO: 'Dinheiro', PIX: 'Pix', TRANSFERENCIA: 'Transferência', CARTAO_DEBITO: 'Cartão Débito', CARTAO_CREDITO: 'Cartão Crédito', CHEQUE: 'Cheque', OUTRO: 'Outro' };

export async function financeDonationsView() {
  const app = document.getElementById('app');
  const canManage = store.hasRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN') || store.hasSecondaryRole('AGENTE_FINANCEIRO');

  let activeTab = 'individual';
  let donations = []; let batches = [];
  let page = 1; let totalPages = 1;
  let filterType = '', filterPerson = '', filterFrom = firstOfMonthISO(), filterTo = todayISO();

  async function loadDonations() {
    try {
      const q = new URLSearchParams({ page, limit: '30' });
      if (filterType)   q.set('type', filterType);
      if (filterPerson) q.set('personId', filterPerson);
      if (filterFrom)   q.set('from', filterFrom);
      if (filterTo)     q.set('to', filterTo);
      const res = await store.apiFetch(`/finance/donations?${q}`);
      donations  = res.data || [];
      totalPages = res.totalPages || 1;
    } catch (e) { toast('Erro ao carregar doações', 'error'); donations = []; }
  }

  async function loadBatches() {
    try { batches = await store.apiFetch('/finance/donations/batches'); }
    catch (e) { batches = []; }
  }

  function render() {
    const people = store.people || [];

    app.innerHTML = `
    ${header('Doações & Dízimos', true)}

    <!-- Tabs -->
    <div class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 sticky top-14 z-10 shrink-0">
      <div class="flex gap-4">
        <button class="don-tab py-3 text-sm font-semibold border-b-2 transition ${activeTab==='individual'?'text-primary border-primary':'text-slate-400 border-transparent hover:text-slate-600'}" data-tab="individual">Individual</button>
        <button class="don-tab py-3 text-sm font-semibold border-b-2 transition ${activeTab==='lotes'?'text-primary border-primary':'text-slate-400 border-transparent hover:text-slate-600'}" data-tab="lotes">Por Lote</button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 md:px-6 py-5 max-w-5xl mx-auto w-full pb-20 space-y-4">

      ${activeTab === 'individual' ? `
      <!-- Filtros -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-3 flex flex-wrap gap-2">
        <select id="f-type" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-w-[130px]">
          <option value="">Todos os Tipos</option>
          ${Object.entries(DON_TYPE_LABEL).map(([k,v]) => `<option value="${k}" ${filterType===k?'selected':''}>${v}</option>`).join('')}
        </select>
        <select id="f-person" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-w-[150px]">
          <option value="">Todos os Membros</option>
          ${people.sort((a,b)=>a.name.localeCompare(b.name)).map(p => `<option value="${p.id}" ${filterPerson===p.id?'selected':''}>${p.name}</option>`).join('')}
        </select>
        <input id="f-from" type="date" value="${filterFrom}" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        <input id="f-to" type="date" value="${filterTo}" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        <button id="btn-filter" class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition">Filtrar</button>
      </div>

      <!-- Tabela -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-900">
              <tr class="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">
                <th class="px-4 py-3">Data</th>
                <th class="px-4 py-3">Tipo</th>
                <th class="px-4 py-3">Membro</th>
                <th class="px-4 py-3 text-right">Valor</th>
                <th class="px-4 py-3">Pagamento</th>
                <th class="px-4 py-3">Registrado por</th>
              </tr>
            </thead>
            <tbody>
              ${donations.length ? donations.map(d => `
              <tr class="border-t border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition">
                <td class="px-4 py-2.5 text-slate-500 dark:text-slate-400">${fmtDate(d.date)}</td>
                <td class="px-4 py-2.5"><span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${DON_TYPE_COLOR[d.type] || 'bg-slate-100 text-slate-600'}">${DON_TYPE_LABEL[d.type] || d.type}</span></td>
                <td class="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">${d.person?.name || '<span class="text-slate-400">Anônimo</span>'}</td>
                <td class="px-4 py-2.5 text-right font-bold text-emerald-600">${fmtBRL(d.amount)}</td>
                <td class="px-4 py-2.5 text-slate-500 dark:text-slate-400">${PAY_METHOD_LABEL[d.paymentMethod] || d.paymentMethod || '—'}</td>
                <td class="px-4 py-2.5 text-slate-400 dark:text-slate-500">${d.registeredBy?.name || '—'}</td>
              </tr>`).join('') : `
              <tr><td colspan="6" class="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                <span class="material-symbols-outlined text-4xl block mb-2 opacity-30">volunteer_activism</span>
                Nenhuma doação encontrada no período
              </td></tr>`}
            </tbody>
          </table>
        </div>
        ${totalPages > 1 ? `
        <div class="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
          <button id="btn-prev" ${page<=1?'disabled':''} class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition">← Anterior</button>
          <span class="text-xs text-slate-400 dark:text-slate-500">Página ${page} de ${totalPages}</span>
          <button id="btn-next" ${page>=totalPages?'disabled':''} class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Próximo →</button>
        </div>` : ''}
      </div>` : `

      <!-- Lotes -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-900">
              <tr class="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">
                <th class="px-4 py-3">Data do Lote</th>
                <th class="px-4 py-3 text-right">Total</th>
                <th class="px-4 py-3 text-center">Qtd</th>
                <th class="px-4 py-3">Registrado por</th>
              </tr>
            </thead>
            <tbody>
              ${batches.length ? batches.map(b => `
              <tr class="border-t border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition cursor-pointer" onclick="">
                <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">${fmtDate(b.date)}</td>
                <td class="px-4 py-3 text-right font-bold text-emerald-600">${fmtBRL(b.totalAmount)}</td>
                <td class="px-4 py-3 text-center text-slate-600 dark:text-slate-300">${b._count?.donations ?? 0}</td>
                <td class="px-4 py-3 text-slate-400 dark:text-slate-500">${b.createdBy?.name || '—'}</td>
              </tr>`).join('') : `
              <tr><td colspan="4" class="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                <span class="material-symbols-outlined text-4xl block mb-2 opacity-30">list_alt</span>
                Nenhum lote registrado
              </td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`}

    </div>
    ${canManage ? `
    <div id="don-fab-group" class="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-30 flex flex-col items-end gap-2">
      <div id="don-fab-options" class="hidden flex-col items-end gap-2 transition-all">
        <button id="btn-float-add-batch" class="flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-full shadow-lg text-xs font-semibold hover:scale-105 active:scale-95 transition whitespace-nowrap"><span class="material-symbols-outlined text-base">list_alt</span>Lote</button>
        <button id="btn-float-add-don" class="flex items-center gap-2 bg-primary text-white px-3 py-2 rounded-full shadow-lg text-xs font-semibold hover:scale-105 active:scale-95 transition whitespace-nowrap"><span class="material-symbols-outlined text-base">add</span>Individual</button>
      </div>
      <button id="btn-fab-don-toggle" class="w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition"><span class="material-symbols-outlined text-2xl">add</span></button>
    </div>` : ''}
    ${bottomNav('finance')}`;

    bindEvents();
  }

  function bindEvents() {
    document.querySelectorAll('.don-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        activeTab = btn.dataset.tab;
        if (activeTab === 'lotes') await loadBatches();
        render();
      });
    });

    document.getElementById('btn-filter')?.addEventListener('click', async () => {
      filterType   = document.getElementById('f-type')?.value   || '';
      filterPerson = document.getElementById('f-person')?.value || '';
      filterFrom   = document.getElementById('f-from')?.value   || '';
      filterTo     = document.getElementById('f-to')?.value     || '';
      page = 1;
      await loadDonations();
      render();
    });

    document.getElementById('btn-prev')?.addEventListener('click', async () => { page--; await loadDonations(); render(); });
    document.getElementById('btn-next')?.addEventListener('click', async () => { page++; await loadDonations(); render(); });

    document.getElementById('btn-new-don')?.addEventListener('click', () => openDonationModal());
    document.getElementById('btn-new-batch')?.addEventListener('click', () => openBatchModal());
    // Speed-dial FAB
    const fabToggle = document.getElementById('btn-fab-don-toggle');
    const fabOptions = document.getElementById('don-fab-options');
    fabToggle?.addEventListener('click', () => {
      const open = !fabOptions.classList.contains('hidden');
      fabOptions.classList.toggle('hidden', open);
      fabOptions.style.display = open ? '' : 'flex';
      fabToggle.querySelector('span').textContent = open ? 'add' : 'close';
    });
    document.getElementById('btn-float-add-don')?.addEventListener('click', () => {
      fabOptions.classList.add('hidden'); fabOptions.style.display = '';
      fabToggle.querySelector('span').textContent = 'add'; openDonationModal();
    });
    document.getElementById('btn-float-add-batch')?.addEventListener('click', () => {
      fabOptions.classList.add('hidden'); fabOptions.style.display = '';
      fabToggle.querySelector('span').textContent = 'add'; openBatchModal();
    });
  }

  function openDonationModal() {
    const accounts = store.financeAccounts || [];
    const people   = store.people || [];
    openModal(`
    <div class="p-5 space-y-4 max-w-md w-full">
      <h3 class="text-base font-bold text-slate-800">Nova Doação / Dízimo</h3>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Tipo *</label>
          <select id="don-type" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
            ${Object.entries(DON_TYPE_LABEL).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Data *</label>
          <input id="don-date" type="date" value="${todayISO()}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Valor *</label>
          <input id="don-amount" type="text" inputmode="numeric" placeholder="0,00" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Forma de Pagamento</label>
          <select id="don-pay" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
            ${Object.entries(PAY_METHOD_LABEL).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Conta Destino *</label>
        <select id="don-account" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Selecione...</option>
          ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Membro (opcional)</label>
        <select id="don-person" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Anônimo / Geral</option>
          ${people.sort((a,b)=>a.name.localeCompare(b.name)).map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Descrição</label>
        <input id="don-desc" type="text" placeholder="Descrição (opcional)" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="closeModal()" class="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
        <button id="btn-save-don" class="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition">Salvar</button>
      </div>
    </div>`);

    maskCurrency(document.getElementById('don-amount'));

    document.getElementById('btn-save-don').addEventListener('click', async () => {
      const amount = parseCurrency(document.getElementById('don-amount'));
      const accountId   = document.getElementById('don-account')?.value;
      const type        = document.getElementById('don-type')?.value;
      const date        = document.getElementById('don-date')?.value;
      if (!amount || amount <= 0) { toast('Informe o valor', 'error'); return; }
      if (!accountId) { toast('Selecione a conta destino', 'error'); return; }
      const body = {
        type, date, amount, accountId,
        personId:      document.getElementById('don-person')?.value     || undefined,
        notes:         document.getElementById('don-desc')?.value       || undefined,
        paymentMethod: document.getElementById('don-pay')?.value        || 'DINHEIRO',
      };
      const btn = document.getElementById('btn-save-don');
      btn.disabled = true; btn.textContent = 'Salvando...';
      try {
        await store.apiFetch('/finance/donations', { method: 'POST', body: JSON.stringify(body) });
        toast('Doação registrada!');
        closeModal();
        page = 1;
        await loadDonations();
        render();
      } catch (e) {
        toast(e.message || 'Erro ao salvar doação', 'error');
        btn.disabled = false; btn.textContent = 'Salvar';
      }
    });
  }

  function openBatchModal() {
    const accounts = store.financeAccounts || [];
    let items = [{ type: 'DIZIMO', amount: '', paymentMethod: 'DINHEIRO', personId: '', description: '' }];
    const people = store.people || [];

    function itemsHtml() {
      return items.map((it, idx) => `
      <div class="batch-item p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500">Item ${idx+1}</span>
          ${items.length > 1 ? `<button type="button" data-rm="${idx}" class="btn-rm-item text-xs text-red-400 hover:text-red-600 transition">Remover</button>` : ''}
        </div>
        <div class="grid grid-cols-2 gap-2">
          <select data-field="type" data-idx="${idx}" class="batch-field px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none">
            ${Object.entries(DON_TYPE_LABEL).map(([k,v]) => `<option value="${k}" ${it.type===k?'selected':''}>${v}</option>`).join('')}
          </select>
          <input data-field="amount" data-idx="${idx}" type="text" inputmode="numeric" value="${it.amount}" placeholder="0,00" class="batch-field batch-amount px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none"/>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <select data-field="personId" data-idx="${idx}" class="batch-field px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none">
            <option value="">Anônimo</option>
            ${people.sort((a,b)=>a.name.localeCompare(b.name)).map(p => `<option value="${p.id}" ${it.personId===p.id?'selected':''}>${p.name}</option>`).join('')}
          </select>
          <select data-field="paymentMethod" data-idx="${idx}" class="batch-field px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none">
            ${Object.entries(PAY_METHOD_LABEL).map(([k,v]) => `<option value="${k}" ${it.paymentMethod===k?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>`).join('');
    }

    function parseBatchAmount(str) {
      const raw = (str || '').replace(/\./g, '').replace(',', '.');
      return Math.round(parseFloat(raw || '0') * 100);
    }

    function total() { return items.reduce((s, it) => s + parseBatchAmount(it.amount), 0); }

    function rebind() {
      document.querySelectorAll('.batch-amount').forEach(el => {
        maskCurrency(el);
      });
      document.querySelectorAll('.batch-field').forEach(el => {
        el.addEventListener('change', e => {
          const idx = parseInt(e.target.dataset.idx);
          const field = e.target.dataset.field;
          items[idx][field] = e.target.value;
          document.getElementById('batch-total').textContent = fmtBRL(total());
        });
        el.addEventListener('input', e => {
          const idx = parseInt(e.target.dataset.idx);
          const field = e.target.dataset.field;
          items[idx][field] = e.target.value;
          document.getElementById('batch-total').textContent = fmtBRL(total());
        });
      });
      document.querySelectorAll('.btn-rm-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.rm);
          items.splice(idx, 1);
          document.getElementById('batch-items').innerHTML = itemsHtml();
          document.getElementById('batch-total').textContent = fmtBRL(total());
          rebind();
        });
      });
      document.getElementById('btn-add-item')?.addEventListener('click', () => {
        items.push({ type: 'DIZIMO', amount: '', paymentMethod: 'DINHEIRO', personId: '', description: '' });
        document.getElementById('batch-items').innerHTML = itemsHtml();
        document.getElementById('batch-total').textContent = fmtBRL(total());
        rebind();
      });
    }

    openModal(`
    <div class="p-5 space-y-4 max-w-lg w-full max-h-[80vh] overflow-y-auto">
      <h3 class="text-base font-bold text-slate-800">Novo Lote de Doações</h3>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Data do Lote *</label>
          <input id="batch-date" type="date" value="${todayISO()}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Conta Destino *</label>
          <select id="batch-account" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Selecione...</option>
            ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="batch-items" class="space-y-2">${itemsHtml()}</div>
      <button id="btn-add-item" type="button" class="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-primary hover:text-primary transition">
        <span class="material-symbols-outlined text-base">add</span>Adicionar item
      </button>
      <div class="flex items-center justify-between bg-emerald-50 rounded-lg px-4 py-3">
        <span class="text-sm font-semibold text-slate-700">Total do Lote:</span>
        <span id="batch-total" class="text-base font-extrabold text-emerald-600">${fmtBRL(0)}</span>
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="closeModal()" class="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
        <button id="btn-save-batch" class="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition">Salvar Lote</button>
      </div>
    </div>`);

    rebind();

    document.getElementById('btn-save-batch').addEventListener('click', async () => {
      const batchDate = document.getElementById('batch-date')?.value;
      const accountId = document.getElementById('batch-account')?.value;
      if (!batchDate) { toast('Informe a data do lote', 'error'); return; }
      if (!accountId) { toast('Selecione a conta destino', 'error'); return; }
      const validItems = items.filter(it => parseBatchAmount(it.amount) > 0);
      if (!validItems.length) { toast('Adicione pelo menos um item com valor', 'error'); return; }

      const btn = document.getElementById('btn-save-batch');
      btn.disabled = true; btn.textContent = 'Salvando...';
      try {
        // Create batch first, then add individual donations
        const batch = await store.apiFetch('/finance/donations/batches', {
          method: 'POST',
          body: JSON.stringify({ name: `Lote ${batchDate}`, date: batchDate })
        });
        for (const it of validItems) {
          await store.apiFetch('/finance/donations', {
            method: 'POST',
            body: JSON.stringify({
              type: it.type,
              amount: parseBatchAmount(it.amount),
              date: batchDate,
              accountId,
              batchId: batch.id,
              paymentMethod: it.paymentMethod || 'DINHEIRO',
              personId: it.personId || undefined,
            })
          });
        }
        toast(`Lote de ${validItems.length} item(s) registrado!`);
        closeModal();
        activeTab = 'lotes';
        await loadBatches();
        render();
      } catch (e) {
        toast(e.message || 'Erro ao salvar lote', 'error');
        btn.disabled = false; btn.textContent = 'Salvar Lote';
      }
    });
  }

  // Loading state
  app.innerHTML = `
  ${header('Doações & Dízimos', true)}
  <div class="flex-1 flex items-center justify-center">
    <span class="material-symbols-outlined text-4xl text-slate-300 animate-spin">refresh</span>
  </div>
  ${bottomNav('finance')}`;

  await loadDonations();
  render();
}
