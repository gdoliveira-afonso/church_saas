import { store } from '../store.js';
import { header, toast, bottomNav, openModal, closeModal } from '../components/ui.js';

function fmtBRL(v) { return 'R$ ' + (Number(v || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

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

function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('pt-BR');
}

function refBadge(ref) {
  const map = {
    MANUAL:   { label: 'Manual',  cls: 'bg-slate-100 text-slate-600' },
    DONATION: { label: 'Doação',  cls: 'bg-blue-50 text-blue-700' },
    BILL:     { label: 'Conta',   cls: 'bg-amber-50 text-amber-700' },
  };
  const m = map[ref] || { label: 'Manual', cls: 'bg-slate-100 text-slate-600' };
  return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${m.cls}">${m.label}</span>`;
}

export async function financeTransactionsView() {
  const app = document.getElementById('app');

  if (!store.systemSettings?.financialEnabled) {
    app.innerHTML = `
    ${header('Lançamentos', true)}
    <div class="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <span class="material-symbols-outlined text-5xl text-slate-300 mb-3">account_balance_wallet</span>
      <h2 class="text-lg font-bold text-slate-700 mb-2">Módulo Financeiro desabilitado</h2>
      <p class="text-sm text-slate-500 max-w-xs">O módulo financeiro não está habilitado para esta organização.</p>
    </div>
    ${bottomNav('finance')}`;
    return;
  }

  const isAdmin = store.hasRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN');

  // ── Estado ─────────────────────────────────────────────────────────────────
  let page = 1;
  let totalPages = 1;
  let totalItems = 0;
  let transactions = [];
  let filterType = '';
  let filterAccount = '';
  let filterFrom = '';
  let filterTo = '';
  let filterSearch = '';
  let summaryReceitas = 0;
  let summaryDespesas = 0;
  let loading = false;

  // ── Render shell ────────────────────────────────────────────────────────────
  app.innerHTML = `
  ${header('Lançamentos', true)}
  
  <div class="px-4 md:px-6 py-2 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-end">
    <a href="#/finance/chart" class="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
      <span class="material-symbols-outlined text-[16px]">category</span>Gerenciar Categorias
    </a>
  </div>

  <!-- Filtros -->
  <div class="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 md:px-6 py-3 space-y-2">
    <div class="flex gap-2 flex-wrap">
      <select id="ft-type" class="flex-1 min-w-[110px] px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
        <option value="">Tipo: Todos</option>
        <option value="RECEITA">Receita</option>
        <option value="DESPESA">Despesa</option>
      </select>
      <select id="ft-account" class="flex-1 min-w-[120px] px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
        <option value="">Conta: Todas</option>
        ${(store.financeAccounts || []).map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
      </select>
    </div>
    <div class="flex gap-2 flex-wrap">
      <input type="date" id="ft-from" class="flex-1 min-w-[130px] px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="De"/>
      <input type="date" id="ft-to" class="flex-1 min-w-[130px] px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Até"/>
    </div>
    <div class="relative">
      <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
      <input type="text" id="ft-search" class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Buscar por descrição…"/>
    </div>
  </div>

  <!-- Resumo -->
  <div id="txn-summary" class="hidden bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 md:px-6 py-2 flex gap-4 text-sm"></div>

  <!-- Lista -->
  <div class="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/30 pb-24">
    <div id="txn-list" class="px-4 md:px-6 py-4">
      <div class="flex items-center justify-center py-12">
        <span class="material-symbols-outlined animate-spin text-3xl text-emerald-500">refresh</span>
      </div>
    </div>
    <!-- Paginação -->
    <div id="txn-pagination" class="px-4 md:px-6 pb-4 hidden flex items-center justify-between gap-2">
      <button id="btn-prev" class="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition">
        <span class="material-symbols-outlined text-[16px]">chevron_left</span>Anterior
      </button>
      <span id="page-indicator" class="text-xs text-slate-500 dark:text-slate-400 font-medium"></span>
      <button id="btn-next" class="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition">
        Próximo<span class="material-symbols-outlined text-[16px]">chevron_right</span>
      </button>
    </div>
  </div>

  <button id="btn-float-add-txn" class="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition"><span class="material-symbols-outlined text-2xl">add</span></button>
  ${bottomNav('finance')}`;

  // ── Fetch & Render ──────────────────────────────────────────────────────────
  async function loadTransactions(resetPage = false) {
    if (resetPage) page = 1;
    loading = true;

    const list = document.getElementById('txn-list');
    list.innerHTML = `<div class="flex items-center justify-center py-12"><span class="material-symbols-outlined animate-spin text-3xl text-emerald-500">refresh</span></div>`;

    const params = new URLSearchParams({ page, limit: 20 });
    if (filterType) params.set('type', filterType);
    if (filterAccount) params.set('accountId', filterAccount);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    if (filterSearch) params.set('search', filterSearch);

    try {
      const res = await store.apiFetch(`/finance/transactions?${params}`);
      transactions = res.data || [];
      totalPages = res.totalPages || 1;
      totalItems = res.total || 0;
      page = res.page || 1;

      // Resumo do período
      summaryReceitas = transactions.filter(t => t.type === 'RECEITA').reduce((s, t) => s + Number(t.amount || 0), 0);
      summaryDespesas = transactions.filter(t => t.type === 'DESPESA').reduce((s, t) => s + Number(t.amount || 0), 0);

      renderList();
      renderPagination();
      renderSummary();
    } catch (err) {
      list.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-slate-400">
        <span class="material-symbols-outlined text-4xl mb-2">error</span>
        <p class="text-sm">Erro ao carregar lançamentos</p>
      </div>`;
    }
    loading = false;
  }

  function renderSummary() {
    const el = document.getElementById('txn-summary');
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.add('flex');
    el.innerHTML = `
      <div class="flex items-center gap-1.5 text-emerald-700 font-semibold">
        <span class="material-symbols-outlined text-[16px]">trending_up</span>
        <span class="text-xs">Receitas: ${fmtBRL(summaryReceitas)}</span>
      </div>
      <div class="w-px bg-slate-200 dark:bg-slate-600"></div>
      <div class="flex items-center gap-1.5 text-red-600 font-semibold">
        <span class="material-symbols-outlined text-[16px]">trending_down</span>
        <span class="text-xs">Despesas: ${fmtBRL(summaryDespesas)}</span>
      </div>
      <div class="w-px bg-slate-200 dark:bg-slate-600"></div>
      <div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
        <span class="text-xs">Saldo: <span class="${summaryReceitas - summaryDespesas >= 0 ? 'text-emerald-700' : 'text-red-600'} font-semibold">${fmtBRL(summaryReceitas - summaryDespesas)}</span></span>
      </div>`;
  }

  function renderList() {
    const list = document.getElementById('txn-list');
    if (!transactions.length) {
      list.innerHTML = `<div class="flex flex-col items-center justify-center py-16 text-slate-400">
        <span class="material-symbols-outlined text-5xl mb-3">receipt_long</span>
        <p class="text-sm">Nenhum lançamento encontrado</p>
        <button id="btn-empty-new" class="mt-3 text-sm text-emerald-600 font-semibold hover:underline">+ Novo lançamento</button>
      </div>`;
      document.getElementById('btn-empty-new')?.addEventListener('click', openNewTxnModal);
      return;
    }

    list.innerHTML = `
      <div class="space-y-2">
        ${transactions.map(t => {
          const isReceita = t.type === 'RECEITA';
          const canDelete = isAdmin && t.referenceType === 'MANUAL';
          return `<div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 px-4 py-3 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-700 transition">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isReceita ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}">
                <span class="material-symbols-outlined text-[18px]">${isReceita ? 'trending_up' : 'trending_down'}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">${t.description}</p>
                  ${refBadge(t.referenceType || 'MANUAL')}
                </div>
                <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  <span class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-[12px]">calendar_today</span>${fmtDate(t.date)}
                  </span>
                  ${t.account ? `<span class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]">account_balance</span>${t.account.name}</span>` : ''}
                  ${t.chartAccount ? `<span class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]">category</span>${t.chartAccount.name}</span>` : ''}
                  ${t.fund ? `<span class="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]">savings</span>${t.fund.name}</span>` : ''}
                </div>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0">
                <p class="text-sm font-bold ${isReceita ? 'text-emerald-600' : 'text-red-500'}">${isReceita ? '+' : '-'}${fmtBRL(t.amount)}</p>
                ${canDelete ? `<button class="btn-del-txn w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition" data-id="${t.id}">
                  <span class="material-symbols-outlined text-[15px]">delete</span>
                </button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;

    document.querySelectorAll('.btn-del-txn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir este lançamento?')) return;
        try {
          await store.apiFetch(`/finance/transactions/${btn.dataset.id}`, { method: 'DELETE' });
          toast('Lançamento excluído');
          loadTransactions();
        } catch (err) {
          toast(err.message || 'Erro ao excluir lançamento', 'error');
        }
      });
    });
  }

  function renderPagination() {
    const pg = document.getElementById('txn-pagination');
    const indicator = document.getElementById('page-indicator');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if (!pg) return;

    if (totalPages <= 1) { pg.classList.add('hidden'); return; }
    pg.classList.remove('hidden');
    indicator.textContent = `Página ${page} de ${totalPages} (${totalItems} lançamentos)`;
    btnPrev.disabled = page <= 1;
    btnNext.disabled = page >= totalPages;
  }

  // ── Modal novo lançamento ───────────────────────────────────────────────────
  function openNewTxnModal() {
    const accounts = store.financeAccounts || [];
    const funds = store.financeFunds || [];
    const chart = store.financeChartOfAccounts || [];

    // Flatten chart of accounts com indentação
    function flattenChart(items, depth = 0) {
      let result = [];
      (items || []).forEach(item => {
        if (!item.ativo && item.ativo !== undefined) return;
        result.push({ id: item.id, label: ('—'.repeat(depth) + (depth > 0 ? ' ' : '') + item.name + (item.code ? ` (${item.code})` : '')), type: item.type });
        if (item.children?.length) result = result.concat(flattenChart(item.children, depth + 1));
      });
      return result;
    }
    const flatChart = flattenChart(chart);

    const today = new Date().toISOString().split('T')[0];

    openModal(`<div class="p-6 max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-5">
        <h3 class="text-base font-bold">Novo Lançamento</h3>
        <button onclick="closeModal()" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400 text-xl">close</span></button>
      </div>
      <form id="txn-form" class="space-y-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Tipo <span class="text-red-500">*</span></label>
          <div class="flex gap-2">
            <label class="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 cursor-pointer has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 transition">
              <input type="radio" name="txn-type" value="RECEITA" class="accent-emerald-600"/> <span class="text-sm font-medium text-emerald-700">Receita</span>
            </label>
            <label class="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 cursor-pointer has-[:checked]:border-red-400 has-[:checked]:bg-red-50 transition">
              <input type="radio" name="txn-type" value="DESPESA" class="accent-red-500"/> <span class="text-sm font-medium text-red-600">Despesa</span>
            </label>
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Descrição <span class="text-red-500">*</span></label>
          <input id="txn-desc" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Ex: Dízimo do culto"/>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-semibold text-slate-600 mb-1 block">Valor <span class="text-red-500">*</span></label>
            <input type="text" inputmode="numeric" id="txn-amount" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="0,00"/>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-600 mb-1 block">Data <span class="text-red-500">*</span></label>
            <input type="date" id="txn-date" value="${today}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"/>
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Conta <span class="text-red-500">*</span></label>
          <select id="txn-account" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
            <option value="">Selecionar conta…</option>
            ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Categoria (Plano de Contas)</label>
          <select id="txn-chart" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
            <option value="">Selecionar categoria…</option>
            ${flatChart.map(c => `<option value="${c.id}">${c.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Fundo (Opcional)</label>
          <select id="txn-fund" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
            <option value="">Nenhum fundo</option>
            ${funds.filter(f => f.ativo !== false).map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Forma de Pagamento</label>
          <select id="txn-method" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
            <option value="">Não informado</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="PIX">Pix</option>
            <option value="TRANSFERENCIA">Transferência</option>
            <option value="CARTAO_DEBITO">Cartão Débito</option>
            <option value="CARTAO_CREDITO">Cartão Crédito</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Observações</label>
          <textarea id="txn-notes" rows="2" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" placeholder="Observações opcionais…"></textarea>
        </div>
        <button type="submit" class="w-full bg-emerald-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-emerald-700 transition mt-2">Salvar Lançamento</button>
      </form>
    </div>`);

    maskCurrency(document.getElementById('txn-amount'));

    document.getElementById('txn-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const orig = btn.innerHTML; btn.innerHTML = 'Salvando…'; btn.disabled = true;

      const type = document.querySelector('input[name="txn-type"]:checked')?.value;
      const description = document.getElementById('txn-desc').value.trim();
      const amount = parseCurrency(document.getElementById('txn-amount'));
      const date = document.getElementById('txn-date').value;
      const accountId = document.getElementById('txn-account').value;

      if (!type) { toast('Selecione o tipo (Receita ou Despesa)', 'error'); btn.innerHTML = orig; btn.disabled = false; return; }
      if (!description) { toast('Descrição é obrigatória', 'error'); btn.innerHTML = orig; btn.disabled = false; return; }
      if (!amount || amount <= 0) { toast('Informe um valor válido', 'error'); btn.innerHTML = orig; btn.disabled = false; return; }
      if (!date) { toast('Data é obrigatória', 'error'); btn.innerHTML = orig; btn.disabled = false; return; }
      if (!accountId) { toast('Selecione uma conta', 'error'); btn.innerHTML = orig; btn.disabled = false; return; }

      const body = { type, description, amount, date, accountId };
      const chartAccountId = document.getElementById('txn-chart').value;
      const fundId = document.getElementById('txn-fund').value;
      const paymentMethod = document.getElementById('txn-method').value;
      const notes = document.getElementById('txn-notes').value.trim();
      if (chartAccountId) body.chartAccountId = chartAccountId;
      if (fundId) body.fundId = fundId;
      if (paymentMethod) body.paymentMethod = paymentMethod;
      if (notes) body.notes = notes;

      try {
        await store.apiFetch('/finance/transactions', { method: 'POST', body: JSON.stringify(body) });
        toast('Lançamento criado!');
        closeModal();
        loadTransactions(true);
      } catch (err) {
        toast(err.message || 'Erro ao salvar lançamento', 'error');
        btn.innerHTML = orig; btn.disabled = false;
      }
    };
  }

  // ── Event listeners ─────────────────────────────────────────────────────────
  document.getElementById('btn-new-txn')?.addEventListener('click', openNewTxnModal);
  document.getElementById('btn-float-add-txn')?.addEventListener('click', openNewTxnModal);

  let searchTimer;
  const bindFilter = (id, setter) => {
    document.getElementById(id)?.addEventListener('change', e => { setter(e.target.value); loadTransactions(true); });
  };
  bindFilter('ft-type', v => { filterType = v; });
  bindFilter('ft-account', v => { filterAccount = v; });
  bindFilter('ft-from', v => { filterFrom = v; });
  bindFilter('ft-to', v => { filterTo = v; });
  document.getElementById('ft-search')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { filterSearch = e.target.value.trim(); loadTransactions(true); }, 400);
  });
  document.getElementById('btn-prev')?.addEventListener('click', () => { if (page > 1) { page--; loadTransactions(); } });
  document.getElementById('btn-next')?.addEventListener('click', () => { if (page < totalPages) { page++; loadTransactions(); } });

  // ── Load inicial ─────────────────────────────────────────────────────────────
  loadTransactions();
}
