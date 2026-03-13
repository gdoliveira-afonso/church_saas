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

const PAY_METHOD_LABEL = { DINHEIRO: 'Dinheiro', PIX: 'Pix', TRANSFERENCIA: 'Transferência', CARTAO_DEBITO: 'Cartão Débito', CARTAO_CREDITO: 'Cartão Crédito', CHEQUE: 'Cheque', OUTRO: 'Outro' };
const REC_LABEL = { NONE: 'Único', MONTHLY: 'Mensal', YEARLY: 'Anual' };

function getBillStatus(bill) {
  if (bill.status !== 'PENDENTE') return bill.status;
  return new Date(bill.dueDate + 'T12:00:00') < new Date() ? 'VENCIDO' : 'PENDENTE';
}

const STATUS_BADGE = {
  PENDENTE:  'bg-amber-50 text-amber-700',
  VENCIDO:   'bg-red-50 text-red-700',
  PAGO:      'bg-emerald-50 text-emerald-700',
  PARCIAL:   'bg-blue-50 text-blue-700',
  CANCELADO: 'bg-slate-100 text-slate-500',
};
const STATUS_LABEL = { PENDENTE: 'Pendente', VENCIDO: 'Vencido', PAGO: 'Pago', PARCIAL: 'Parcial', CANCELADO: 'Cancelado' };

export async function financeBillsView() {
  const app = document.getElementById('app');
  const canManage = store.hasRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN') || store.hasSecondaryRole('AGENTE_FINANCEIRO');

  let activeTab = 'pendentes';
  let bills = []; let page = 1; let totalPages = 1;
  let filterFrom = '', filterTo = '';

  async function loadBills() {
    try {
      const q = new URLSearchParams({ page, limit: '30' });
      if (activeTab === 'pendentes') { q.set('status', 'PENDENTE'); }
      else if (activeTab === 'pagas') { q.set('status', 'PAGO'); }
      if (filterFrom) q.set('from', filterFrom);
      if (filterTo)   q.set('to', filterTo);
      const res = await store.apiFetch(`/finance/bills?${q}`);
      bills      = res.data || [];
      totalPages = res.totalPages || 1;
    } catch (e) { toast('Erro ao carregar contas', 'error'); bills = []; }
  }

  function computeKPIs() {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth()+1, 0);
    const endOfMonthStr = endOfMonth.toISOString().slice(0,10);
    const pendentes = bills.filter(b => getBillStatus(b) === 'PENDENTE' || getBillStatus(b) === 'VENCIDO');
    const vencendo  = bills.filter(b => getBillStatus(b) === 'PENDENTE' && b.dueDate <= endOfMonthStr);
    const totalPend = pendentes.reduce((s, b) => s + (b.amount||0), 0);
    const totalVenc = vencendo.reduce((s, b) => s + (b.amount||0), 0);
    return { totalPend, totalVenc, vencendoCount: vencendo.length };
  }

  function render() {
    const kpis = computeKPIs();
    app.innerHTML = `
    ${header('Contas a Pagar', true)}

    <!-- Tabs -->
    <div class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 sticky top-14 z-10 shrink-0">
      <div class="flex gap-4">
        ${['pendentes','pagas','todas'].map(tab => `
        <button class="bill-tab py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${activeTab===tab?'text-primary border-primary':'text-slate-400 border-transparent hover:text-slate-600'}" data-tab="${tab}">${{pendentes:'Pendentes',pagas:'Pagas',todas:'Todas'}[tab]}</button>`).join('')}
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 md:px-6 py-5 max-w-5xl mx-auto w-full pb-20 space-y-4">

      <!-- KPIs (apenas em pendentes) -->
      ${activeTab === 'pendentes' ? `
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><span class="material-symbols-outlined text-amber-500 text-[18px]">payments</span></div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">Total Pendente</p>
          </div>
          <p class="text-base font-bold text-amber-600">${fmtBRL(kpis.totalPend)}</p>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><span class="material-symbols-outlined text-red-500 text-[18px]">event_busy</span></div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">Vencendo este mês</p>
          </div>
          <p class="text-base font-bold text-red-600">${fmtBRL(kpis.totalVenc)} <span class="text-xs text-red-400">(${kpis.vencendoCount})</span></p>
        </div>
      </div>` : ''}

      <!-- Filtros data -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Vencimento:</span>
        <input id="f-from" type="date" value="${filterFrom}" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        <span class="text-slate-400 dark:text-slate-500 text-sm">até</span>
        <input id="f-to" type="date" value="${filterTo}" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        <button id="btn-filter" class="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition">Filtrar</button>
      </div>

      <!-- Lista de contas -->
      <div class="space-y-2">
        ${bills.length ? bills.map(b => {
          const status = getBillStatus(b);
          const paidAmount = (b.payments || []).reduce((s,p) => s + (p.amount||0), 0);
          const remaining  = (b.amount||0) - paidAmount;
          return `
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <p class="text-sm font-bold text-slate-800 dark:text-slate-100">${b.description}</p>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${STATUS_BADGE[status]||'bg-slate-100 text-slate-500'}">${STATUS_LABEL[status]||status}</span>
                  ${b.recurrence && b.recurrence !== 'NONE' ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 font-semibold">${REC_LABEL[b.recurrence] || b.recurrence}</span>` : ''}
                </div>
                <div class="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 flex-wrap">
                  <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">event</span>Vence: ${fmtDate(b.dueDate)}</span>
                  ${b.account ? `<span>${b.account.name}</span>` : ''}
                  ${status === 'PARCIAL' ? `<span class="text-blue-600 dark:text-blue-400">Pago: ${fmtBRL(paidAmount)} · Restante: ${fmtBRL(remaining)}</span>` : ''}
                </div>
              </div>
              <div class="flex flex-col items-end gap-2 shrink-0">
                <p class="text-base font-extrabold ${status==='VENCIDO'?'text-red-600':status==='PAGO'?'text-emerald-600':'text-slate-800 dark:text-slate-100'}">${fmtBRL(b.amount)}</p>
                ${canManage && (status === 'PENDENTE' || status === 'VENCIDO' || status === 'PARCIAL') ? `
                <button data-id="${b.id}" data-rem="${remaining}" data-action="pay" class="bill-btn flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition">
                  <span class="material-symbols-outlined text-sm">check_circle</span>Pagar
                </button>` : ''}
                ${canManage && status === 'PENDENTE' ? `
                <button data-id="${b.id}" data-action="delete" class="bill-btn text-[10px] text-slate-400 hover:text-red-500 transition">Excluir</button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('') : `
        <div class="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
          <span class="material-symbols-outlined text-5xl mb-3 opacity-30">payments</span>
          <p class="text-sm">Nenhuma conta encontrada</p>
        </div>`}
      </div>

      ${totalPages > 1 ? `
      <div class="flex items-center justify-between">
        <button id="btn-prev" ${page<=1?'disabled':''} class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition">← Anterior</button>
        <span class="text-xs text-slate-400 dark:text-slate-500">Página ${page} de ${totalPages}</span>
        <button id="btn-next" ${page>=totalPages?'disabled':''} class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Próximo →</button>
      </div>` : ''}

    </div>
    ${canManage ? `<button id="btn-float-add-bill" class="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition"><span class="material-symbols-outlined text-2xl">add</span></button>` : ''}
    ${bottomNav('finance')}`;

    bindEvents();
  }

  function bindEvents() {
    document.querySelectorAll('.bill-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        activeTab = btn.dataset.tab;
        page = 1;
        await loadBills();
        render();
      });
    });

    document.getElementById('btn-filter')?.addEventListener('click', async () => {
      filterFrom = document.getElementById('f-from')?.value || '';
      filterTo   = document.getElementById('f-to')?.value   || '';
      page = 1;
      await loadBills();
      render();
    });

    document.getElementById('btn-prev')?.addEventListener('click', async () => { page--; await loadBills(); render(); });
    document.getElementById('btn-next')?.addEventListener('click', async () => { page++; await loadBills(); render(); });

    document.getElementById('btn-new-bill')?.addEventListener('click', () => openBillModal());
    document.getElementById('btn-float-add-bill')?.addEventListener('click', () => openBillModal());

    document.querySelectorAll('.bill-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id     = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'pay') {
          openPayModal(id, parseFloat(btn.dataset.rem || '0'));
        } else if (action === 'delete') {
          if (!confirm('Excluir esta conta a pagar?')) return;
          try {
            await store.apiFetch(`/finance/bills/${id}`, { method: 'DELETE' });
            toast('Conta excluída');
            await loadBills();
            render();
          } catch (e) { toast(e.message || 'Erro ao excluir', 'error'); }
        }
      });
    });
  }

  function openBillModal() {
    openModal(`
    <div class="p-5 space-y-4 max-w-md w-full">
      <h3 class="text-base font-bold text-slate-800">Nova Conta a Pagar</h3>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Descrição *</label>
        <input id="b-desc" type="text" placeholder="Ex: Aluguel, Energia..." class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Valor *</label>
          <input id="b-amount" type="text" inputmode="numeric" placeholder="0,00" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Vencimento *</label>
          <input id="b-due" type="date" value="${todayISO()}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Recorrência</label>
        <select id="b-recur" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
          ${Object.entries(REC_LABEL).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Notas (opcional)</label>
        <input id="b-notes" type="text" placeholder="Observações..." class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="closeModal()" class="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
        <button id="btn-save-bill" class="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">Salvar</button>
      </div>
    </div>`);

    maskCurrency(document.getElementById('b-amount'));

    document.getElementById('btn-save-bill').addEventListener('click', async () => {
      const description = document.getElementById('b-desc')?.value.trim();
      const amount = parseCurrency(document.getElementById('b-amount'));
      const dueDate     = document.getElementById('b-due')?.value;
      if (!description) { toast('Descrição é obrigatória', 'error'); return; }
      if (!amount || amount <= 0) { toast('Informe o valor', 'error'); return; }
      if (!dueDate) { toast('Informe o vencimento', 'error'); return; }
      const btn = document.getElementById('btn-save-bill');
      btn.disabled = true; btn.textContent = 'Salvando...';
      try {
        await store.apiFetch('/finance/bills', {
          method: 'POST',
          body: JSON.stringify({
            description, amount, dueDate,
            recurrence: document.getElementById('b-recur')?.value || 'NONE',
            notes:      document.getElementById('b-notes')?.value || undefined,
          })
        });
        toast('Conta a pagar registrada!');
        closeModal();
        await loadBills();
        render();
      } catch (e) {
        toast(e.message || 'Erro ao salvar', 'error');
        btn.disabled = false; btn.textContent = 'Salvar';
      }
    });
  }

  function openPayModal(billId, remaining) {
    const accounts = store.financeAccounts || [];
    // remaining is already in centavos from the backend
    openModal(`
    <div class="p-5 space-y-4 max-w-sm w-full">
      <h3 class="text-base font-bold text-slate-800">Registrar Pagamento</h3>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Data *</label>
          <input id="pay-date" type="date" value="${todayISO()}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Valor *</label>
          <input id="pay-amount" type="text" inputmode="numeric" value="${remaining > 0 ? (remaining / 100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="0,00"/>
        </div>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Conta *</label>
        <select id="pay-account" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Selecione...</option>
          ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Forma de Pagamento</label>
        <select id="pay-method" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
          ${Object.entries(PAY_METHOD_LABEL).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Notas</label>
        <input id="pay-notes" type="text" placeholder="(opcional)" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="closeModal()" class="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
        <button id="btn-confirm-pay" class="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition">Confirmar</button>
      </div>
    </div>`);

    maskCurrency(document.getElementById('pay-amount'));

    document.getElementById('btn-confirm-pay').addEventListener('click', async () => {
      const paymentDate = document.getElementById('pay-date')?.value;
      const amount      = parseCurrency(document.getElementById('pay-amount'));
      const accountId     = document.getElementById('pay-account')?.value;
      const paymentMethod = document.getElementById('pay-method')?.value;
      const notes         = document.getElementById('pay-notes')?.value;
      if (!amount || amount <= 0) { toast('Informe o valor', 'error'); return; }
      if (!accountId) { toast('Selecione a conta', 'error'); return; }
      const btn = document.getElementById('btn-confirm-pay');
      btn.disabled = true; btn.textContent = 'Confirmando...';
      try {
        await store.apiFetch(`/finance/bills/${billId}/pay`, {
          method: 'POST',
          body: JSON.stringify({ paymentDate, amount, accountId, paymentMethod, notes: notes || undefined })
        });
        toast('Pagamento registrado!');
        closeModal();
        await loadBills();
        render();
      } catch (e) {
        toast(e.message || 'Erro ao registrar pagamento', 'error');
        btn.disabled = false; btn.textContent = 'Confirmar';
      }
    });
  }

  // Loading state
  app.innerHTML = `
  ${header('Contas a Pagar', true)}
  <div class="flex-1 flex items-center justify-center">
    <span class="material-symbols-outlined text-4xl text-slate-300 animate-spin">refresh</span>
  </div>
  ${bottomNav('finance')}`;

  await loadBills();
  render();
}
