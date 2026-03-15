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

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

function isoToInput(dateStr) {
  if (!dateStr) return '';
  return dateStr.slice(0,10);
}

function todayISO() {
  return new Date().toISOString().slice(0,10);
}

function monthAgoISO() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0,10);
}

const ACCOUNT_TYPE_LABEL = { CONTA_CORRENTE: 'Conta Corrente', POUPANCA: 'Poupança', CAIXA: 'Caixa', PIX: 'PIX', OUTRO: 'Outro' };

function accountIcon(type) {
  const icons = { CONTA_CORRENTE: 'account_balance', POUPANCA: 'savings', CAIXA: 'point_of_sale', PIX: 'pix', OUTRO: 'wallet' };
  return icons[type] || 'wallet';
}

function accountColor(type) {
  const colors = { CONTA_CORRENTE: 'bg-blue-50 text-blue-500', POUPANCA: 'bg-emerald-50 text-emerald-500', CAIXA: 'bg-amber-50 text-amber-500', PIX: 'bg-purple-50 text-purple-500', OUTRO: 'bg-slate-100 text-slate-500' };
  return colors[type] || 'bg-slate-100 text-slate-500';
}

export async function financeAccountsView() {
  const app = document.getElementById('app');

  if (!store.systemSettings?.financialEnabled) {
    app.innerHTML = `
    ${header('Contas Bancárias', true)}
    <div class="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <span class="material-symbols-outlined text-5xl text-slate-300 mb-3">account_balance</span>
      <p class="text-sm text-slate-400">Módulo financeiro desabilitado</p>
      <a href="#/dashboard" class="mt-4 text-sm text-primary font-semibold hover:underline">Voltar ao Dashboard</a>
    </div>
    ${bottomNav('finance')}`;
    return;
  }

  const canManage = store.hasRole('ADMIN','SUPERVISOR','SUPERADMIN');

  const render = () => {
    const accounts = store.financeAccounts || [];

    app.innerHTML = `
    ${header('Contas Bancárias', true)}
    <div class="flex-1 overflow-y-auto px-4 md:px-6 py-4 bg-slate-50/30 dark:bg-slate-950/30">

      ${accounts.length === 0 ? `
      <div class="flex flex-col items-center justify-center py-20 text-center">
        <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <span class="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-500">account_balance</span>
        </div>
        <h3 class="text-base font-bold text-slate-600 dark:text-slate-300 mb-1">Nenhuma conta cadastrada</h3>
        <p class="text-sm text-slate-400 dark:text-slate-500 max-w-xs">Adicione sua primeira conta bancária para começar a registrar lançamentos financeiros.</p>
        ${canManage ? `<button id="btn-add-account-empty" class="mt-4 text-sm text-primary font-semibold hover:underline">+ Adicionar conta</button>` : ''}
      </div>` : `
      <div class="space-y-3">
        ${accounts.map(acc => `
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:border-primary/20 hover:shadow-md transition group account-card" data-id="${acc.id}">
          <div class="flex items-center gap-3 p-4">
            <div class="w-11 h-11 rounded-xl ${accountColor(acc.type)} flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-xl">${accountIcon(acc.type)}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">${acc.name}</p>
              <p class="text-[11px] text-slate-400 dark:text-slate-500">${ACCOUNT_TYPE_LABEL[acc.type] || acc.type}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${fmtBRL(acc.balance ?? acc.initialBalance)}</p>
              <p class="text-[10px] text-slate-400 dark:text-slate-500">saldo atual</p>
            </div>
          </div>
          <div class="border-t border-slate-50 dark:border-slate-700 px-4 py-2.5 flex items-center gap-2">
            <button class="btn-statement flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:underline" data-id="${acc.id}" data-name="${acc.name}">
              <span class="material-symbols-outlined text-[15px]">receipt_long</span>Extrato
            </button>
            ${canManage ? `
            <span class="text-slate-200 dark:text-slate-600 mx-1">|</span>
            <button class="btn-edit-account text-xs text-slate-500 dark:text-slate-400 hover:text-primary font-semibold flex items-center gap-1" data-id="${acc.id}">
              <span class="material-symbols-outlined text-[15px]">edit</span>Editar
            </button>
            <button class="btn-del-account ml-auto text-xs text-red-400 hover:text-red-600 font-semibold flex items-center gap-1" data-id="${acc.id}" data-name="${acc.name}">
              <span class="material-symbols-outlined text-[15px]">delete</span>Excluir
            </button>` : ''}
          </div>
        </div>`).join('')}
      </div>`}

    </div>
    ${canManage ? `<button id="btn-float-add-account" class="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition"><span class="material-symbols-outlined text-2xl">add</span></button>` : ''}
    ${bottomNav('finance')}`;

    // Events
    document.getElementById('btn-add-account')?.addEventListener('click', () => openAccountForm());
    document.getElementById('btn-add-account-empty')?.addEventListener('click', () => openAccountForm());
    document.getElementById('btn-float-add-account')?.addEventListener('click', () => openAccountForm());

    document.querySelectorAll('.btn-edit-account').forEach(btn => {
      btn.addEventListener('click', () => openAccountForm(btn.dataset.id));
    });

    document.querySelectorAll('.btn-del-account').forEach(btn => {
      btn.addEventListener('click', () => deleteAccount(btn.dataset.id, btn.dataset.name, render));
    });

    document.querySelectorAll('.btn-statement').forEach(btn => {
      btn.addEventListener('click', () => openStatement(btn.dataset.id, btn.dataset.name));
    });
  };

  // Load accounts if needed
  if (!store.financeAccounts || store.financeAccounts.length === 0) {
    app.innerHTML = `
    ${header('Contas Bancárias', true)}
    <div class="flex-1 flex items-center justify-center">
      <span class="material-symbols-outlined text-4xl text-slate-300 animate-spin">refresh</span>
    </div>
    ${bottomNav('finance')}`;

    try {
      if (store.fetchFinanceAccounts) {
        await store.fetchFinanceAccounts();
      } else {
        const data = await store.apiFetch('/finance/accounts');
        store.financeAccounts = data;
      }
    } catch(err) {
      toast('Erro ao carregar contas', 'error');
      store.financeAccounts = [];
    }
  }

  render();
}

// ── Modal: Criar/Editar Conta ──────────────────────────────────────────────
function openAccountForm(accountId) {
  const acc = accountId ? (store.financeAccounts || []).find(a => a.id === accountId) : null;

  openModal(`<div class="p-6 max-w-md w-full">
    <div class="flex justify-between items-center mb-5">
      <h3 class="text-base font-bold">${acc ? 'Editar' : 'Nova'} Conta Bancária</h3>
      <button onclick="closeModal()" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400 text-xl">close</span></button>
    </div>
    <form id="account-form" class="space-y-4">
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Nome da Conta <span class="text-red-500">*</span></label>
        <input id="af-name" value="${acc?.name || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Ex: Conta Corrente Bradesco"/>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Tipo <span class="text-red-500">*</span></label>
        <select id="af-type" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
          ${Object.entries(ACCOUNT_TYPE_LABEL).map(([v, l]) => `<option value="${v}" ${acc?.type === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Saldo Inicial (R$)</label>
        <input id="af-balance" type="text" inputmode="numeric" value="${acc?.initialBalance ? (acc.initialBalance / 100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="0,00"/>
        ${acc ? `<p class="text-[10px] text-slate-400 mt-0.5">Alterar o saldo inicial afetará o saldo calculado desta conta.</p>` : ''}
      </div>
      <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition mt-2">${acc ? 'Salvar Alterações' : 'Criar Conta'}</button>
    </form>
  </div>`);

  maskCurrency(document.getElementById('af-balance'));

  document.getElementById('account-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML; btn.innerHTML = 'Salvando...'; btn.disabled = true;

    const name = document.getElementById('af-name').value.trim();
    const type = document.getElementById('af-type').value;
    const initialBalance = parseCurrency(document.getElementById('af-balance'));

    if (!name) { toast('Nome da conta é obrigatório', 'error'); btn.innerHTML = orig; btn.disabled = false; return; }

    try {
      if (acc) {
        const updated = await store.apiFetch(`/finance/accounts/${acc.id}`, { method: 'PUT', body: JSON.stringify({ name, type, initialBalance }) });
        store.financeAccounts = (store.financeAccounts || []).map(a => a.id === acc.id ? { ...a, ...updated } : a);
        toast('Conta atualizada!');
      } else {
        const created = await store.apiFetch('/finance/accounts', { method: 'POST', body: JSON.stringify({ name, type, initialBalance }) });
        store.financeAccounts = [...(store.financeAccounts || []), created];
        toast('Conta criada!');
      }
      closeModal();
      financeAccountsView();
    } catch(err) {
      btn.innerHTML = orig; btn.disabled = false;
      toast(err.message || 'Erro ao salvar conta', 'error');
    }
  };
}

// ── Deletar Conta ──────────────────────────────────────────────────────────
async function deleteAccount(accountId, name, renderFn) {
  if (!confirm(`Excluir a conta "${name}"? Esta ação não pode ser desfeita.`)) return;
  try {
    await store.apiFetch(`/finance/accounts/${accountId}`, { method: 'DELETE' });
    store.financeAccounts = (store.financeAccounts || []).filter(a => a.id !== accountId);
    toast('Conta excluída');
    renderFn();
  } catch(err) {
    toast(err.message || 'Erro ao excluir conta', 'error');
  }
}

// ── Modal: Extrato ─────────────────────────────────────────────────────────
async function openStatement(accountId, accountName) {
  const from = monthAgoISO();
  const to   = todayISO();

  openModal(`<div class="p-6 w-full max-w-2xl">
    <div class="flex justify-between items-center mb-6">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-lg">receipt_long</span>
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Extrato Bancário</h3>
          <p class="text-[11px] text-slate-500 font-medium">${accountName}</p>
        </div>
      </div>
      <button onclick="closeModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"><span class="material-symbols-outlined text-slate-400 text-xl">close</span></button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-[1fr_1fr_auto] gap-3 mb-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
      <div class="space-y-1">
        <label class="text-[10px] font-bold text-slate-500 uppercase ml-1">Início</label>
        <input type="date" id="stmt-from" value="${from}" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
      </div>
      <div class="space-y-1">
        <label class="text-[10px] font-bold text-slate-500 uppercase ml-1">Fim</label>
        <input type="date" id="stmt-to" value="${to}" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
      </div>
      <div class="col-span-2 md:col-span-1 flex items-end">
        <button id="stmt-filter-btn" class="w-full md:w-auto px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition active:scale-95 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-[18px]">filter_list</span> Filtrar
        </button>
      </div>
    </div>
    <div id="stmt-content" class="min-h-[200px]">
      <div class="flex items-center justify-center py-8">
        <span class="material-symbols-outlined text-3xl text-slate-300 animate-spin">refresh</span>
      </div>
    </div>
  </div>`);

  const loadStatement = async () => {
    const fromVal = document.getElementById('stmt-from')?.value || from;
    const toVal   = document.getElementById('stmt-to')?.value   || to;
    const content = document.getElementById('stmt-content');
    if (!content) return;

    content.innerHTML = `<div class="flex items-center justify-center py-8"><span class="material-symbols-outlined text-3xl text-slate-300 animate-spin">refresh</span></div>`;

    try {
      const stmtData = await store.apiFetch(`/finance/accounts/${accountId}/statement?from=${fromVal}&to=${toVal}`);
      const rows = stmtData?.transactions || [];

      if (!rows || rows.length === 0) {
        content.innerHTML = `<div class="flex flex-col items-center py-10 text-slate-400">
          <span class="material-symbols-outlined text-3xl mb-2">receipt_long</span>
          <p class="text-sm">Nenhum lançamento no período</p>
        </div>`;
        return;
      }

      content.innerHTML = `<div class="border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/30 overflow-hidden shadow-sm">
        <div class="overflow-x-auto scrollbar-thin">
          <table class="w-full text-left border-collapse table-auto">
            <thead>
              <tr class="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800">
                <th class="pl-4 pr-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data</th>
                <th class="px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lançamento</th>
                <th class="px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">Valor</th>
                <th class="pl-2 pr-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">Saldo</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 dark:divide-slate-800/50">
              ${rows.map(r => {
                const isCredit = r.type === 'RECEITA';
                return `<tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td class="pl-4 pr-2 py-3.5 whitespace-nowrap">
                    <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded shadow-sm">${fmtDate(r.date)}</span>
                  </td>
                  <td class="px-2 py-3.5">
                    <p class="text-[13px] font-bold text-slate-700 dark:text-slate-200 line-clamp-1 max-w-[120px] md:max-w-none">${r.description || '—'}</p>
                    <p class="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[100px] md:max-w-none">${r.chartAccount?.name || r.category || 'Outros'}</p>
                  </td>
                  <td class="px-2 py-3.5 text-right whitespace-nowrap leading-none">
                    <span class="text-[13px] font-bold ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}">
                      ${isCredit ? '+' : '-'}${fmtBRL(r.amount)}
                    </span>
                  </td>
                  <td class="pl-2 pr-4 py-3.5 text-right whitespace-nowrap leading-none">
                    <span class="text-[13px] font-black ${Number(r.runningBalance||0) >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-700 dark:text-red-500'}">
                      ${fmtBRL(r.runningBalance)}
                    </span>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    } catch(err) {
      content.innerHTML = `<div class="flex flex-col items-center py-8 text-red-400">
        <span class="material-symbols-outlined text-3xl mb-2">error</span>
        <p class="text-sm">Erro ao carregar extrato</p>
      </div>`;
      toast('Erro ao carregar extrato', 'error');
    }
  };

  await loadStatement();

  document.getElementById('stmt-filter-btn')?.addEventListener('click', loadStatement);
}
