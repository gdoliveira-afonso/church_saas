import { store } from '../store.js';
import { header, toast, bottomNav } from '../components/ui.js';

function fmtBRL(v) { return 'R$ ' + (Number(v||0) / 100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtDate(d) { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; }
function firstOfMonthISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; }
function lastOfMonthISO() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10); }

const ACCOUNT_TYPE_LABEL = { CONTA_CORRENTE: 'Conta Corrente', POUPANCA: 'Poupança', CAIXA: 'Caixa', PIX: 'PIX', OUTRO: 'Outro' };
const PAY_METHOD_LABEL   = { DINHEIRO: 'Dinheiro', PIX: 'Pix', TRANSFERENCIA: 'Transferência', CARTAO_DEBITO: 'Cartão Débito', CARTAO_CREDITO: 'Cartão Crédito', CHEQUE: 'Cheque', OUTRO: 'Outro' };
const MONTH_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function kpi(icon, label, value, color) {
  const bg = { blue: 'bg-blue-50 text-blue-500', purple: 'bg-purple-50 text-purple-500', emerald: 'bg-emerald-50 text-emerald-500', amber: 'bg-amber-50 text-amber-500', red: 'bg-red-50 text-red-500', slate: 'bg-slate-100 text-slate-500' };
  return `<div class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3">
    <div class="w-10 h-10 rounded-full ${bg[color]||bg.slate} flex items-center justify-center shrink-0">
      <span class="material-symbols-outlined">${icon}</span>
    </div>
    <div>
      <p class="text-base font-extrabold text-slate-800 dark:text-slate-100">${value}</p>
      <p class="text-[11px] text-slate-500 dark:text-slate-400">${label}</p>
    </div>
  </div>`;
}

export async function financeReportsView() {
  const app = document.getElementById('app');

  let activeTab = 'dashboard';
  let filterFrom = firstOfMonthISO();
  let filterTo   = lastOfMonthISO();
  let tabData    = {};
  let loading    = false;

  function getQ() {
    const q = new URLSearchParams();
    if (filterFrom) q.set('from', filterFrom);
    if (filterTo)   q.set('to', filterTo);
    return q.toString() ? '?' + q : '';
  }

  async function loadTab(tab) {
    loading = true;
    renderTabContent('<div class="flex items-center justify-center py-16 text-slate-400"><span class="material-symbols-outlined animate-spin mr-2 text-2xl">refresh</span><span class="text-sm">Carregando...</span></div>');
    const q = getQ();
    try {
      switch (tab) {
        case 'dashboard':
          tabData.dashboard = await store.apiFetch('/finance/reports/dashboard');
          tabData.summary   = await store.apiFetch(`/finance/reports/period-summary${q}`);
          break;
        case 'cashflow':
          tabData.cashflow = await store.apiFetch(`/finance/reports/cashflow${q}`);
          break;
        case 'dre':
          tabData.dre = await store.apiFetch(`/finance/reports/dre${q}`);
          break;
        case 'dizimistas':
          // Dízimos usa apenas os filtros internos (período/tipo), não o filtro de data global
          tabData.dizimistas = await store.apiFetch('/finance/reports/dizimistas');
          break;
        case 'funds':
          tabData.funds = await store.apiFetch(`/finance/reports/by-fund${q}`);
          break;
        case 'summary':
          tabData.summary = await store.apiFetch(`/finance/reports/period-summary${q}`);
          break;
      }
    } catch (e) {
      toast('Erro ao carregar relatório', 'error');
    }
    loading = false;
    renderTabContent(buildTabContent(tab));
    // Animação suave de mostrar/esconder filtro de data
    const filterBar = document.getElementById('filter-bar');
    if (filterBar) {
      if (tab === 'dizimistas') {
        filterBar.style.maxHeight = filterBar.scrollHeight + 'px';
        filterBar.style.overflow = 'hidden';
        filterBar.style.opacity = '1';
        requestAnimationFrame(() => {
          filterBar.style.transition = 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease';
          filterBar.style.maxHeight = '0';
          filterBar.style.opacity = '0';
        });
      } else {
        filterBar.style.transition = 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease';
        filterBar.style.maxHeight = '80px';
        filterBar.style.opacity = '1';
        filterBar.style.overflow = '';
      }
    }
    if (tab === 'dashboard') {
      const history = tabData.summary?.byMonth || [];
      if (history.length > 0) setTimeout(() => renderReportsChart(history), 100);
    }
    if (tab === 'dizimistas') {
      bindTimelineEvents();
      if (tabData.personTimeline) setTimeout(() => renderIndividualChart(tabData.personTimeline), 100);
    }
  }

  function renderTabContent(html) {
    const el = document.getElementById('tab-content');
    if (el) el.innerHTML = html;
  }

  function buildTabContent(tab) {
    switch(tab) {
      case 'dashboard': return buildDashboard();
      case 'cashflow':  return buildCashflow();
      case 'dre':       return buildDRE();
      case 'dizimistas':return buildDizimistas();
      case 'funds':     return buildFunds();
      case 'summary':   return buildSummary();
      default: return '<p class="text-slate-400 text-sm p-4">Selecione uma aba</p>';
    }
  }

  function buildDashboard() {
    const d = tabData.dashboard || {};
    const resultado = (d.resultadoMes||0);
    const resultPos = resultado >= 0;
    const saldos    = d.saldoPorConta || [];
    const alerts    = d.contasVencer7d || d.billsVencendo || 0;
    return `
    ${alerts > 0 ? `<div class="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
      <span class="material-symbols-outlined text-amber-500 shrink-0">warning</span>
      <p class="text-sm text-amber-800 font-medium">${alerts} conta(s) a pagar vencendo em breve</p>
      <a href="#/finance/bills" class="ml-auto text-xs text-amber-700 font-semibold hover:underline">Ver</a>
    </div>` : ''}
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
      ${kpi('trending_up',       'Entradas do Mês',  fmtBRL(d.entradaMes),   'emerald')}
      ${kpi('trending_down',     'Saídas do Mês',    fmtBRL(d.saidaMes),     'red')}
      ${kpi('account_balance',   'Resultado',        fmtBRL(resultado),      resultPos?'emerald':'red')}
      ${kpi('account_balance_wallet', 'Saldo Total', fmtBRL(d.saldoTotal),   'blue')}
      ${kpi('volunteer_activism','Dizimistas Ativos', d.totalDizimistas||0,  'purple')}
      ${kpi('payments',          'Contas Vencendo',   alerts,                'amber')}
    </div>
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 mb-5">
      <div class="flex items-center justify-between mb-4">
        <h4 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Evolução do Período</h4>
        <div class="flex gap-4 text-[10px] uppercase font-bold text-slate-400">
          <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Entradas</div>
          <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red-400"></span>Saídas</div>
        </div>
      </div>
      <div class="h-64 h-min-[200px] w-full relative">
        <canvas id="chart-reports-trend"></canvas>
      </div>
    </div>
    ${saldos.length ? `
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-50 dark:border-slate-700">
        <h4 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Saldo por Conta</h4>
      </div>
      <div class="divide-y divide-slate-50 dark:divide-slate-700">
        ${saldos.map(c => `
        <div class="flex items-center gap-3 px-4 py-3">
          <span class="text-slate-700 dark:text-slate-200 text-sm font-medium flex-1">${c.name} <span class="text-[10px] text-slate-500 dark:text-slate-400">${ACCOUNT_TYPE_LABEL[c.type]||c.type}</span></span>
          <span class="text-sm font-bold ${Number(c.balance||0)>=0?'text-emerald-600':'text-red-600'}">${fmtBRL(c.balance)}</span>
        </div>`).join('')}
      </div>
    </div>` : ''}`;
  }

  function buildCashflow() {
    const months = (tabData.cashflow?.months) || [];
    if (!months.length) return `<div class="flex flex-col items-center py-16 text-slate-400"><span class="material-symbols-outlined text-4xl mb-2 opacity-30">show_chart</span><p class="text-sm">Sem dados no período</p></div>`;
    const totRec  = months.reduce((s,m) => s + (m.receitas||0), 0);
    const totDesp = months.reduce((s,m) => s + (m.despesas||0), 0);
    const totRes  = totRec - totDesp;
    return `
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 dark:bg-slate-900">
            <tr class="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">
              <th class="px-4 py-3">Mês</th>
              <th class="px-4 py-3 text-right text-emerald-600">Receitas</th>
              <th class="px-4 py-3 text-right text-red-500">Despesas</th>
              <th class="px-4 py-3 text-right">Resultado</th>
            </tr>
          </thead>
          <tbody>
            ${months.map(m => {
              const res = (m.receitas||0) - (m.despesas||0);
              const [y, mo] = m.month.split('-').map(Number);
              return `<tr class="border-t border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition">
                <td class="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">${MONTH_PT[mo-1]}/${y}</td>
                <td class="px-4 py-2.5 text-right text-emerald-600 font-semibold">${fmtBRL(m.receitas)}</td>
                <td class="px-4 py-2.5 text-right text-red-500 font-semibold">${fmtBRL(m.despesas)}</td>
                <td class="px-4 py-2.5 text-right font-bold ${res>=0?'text-emerald-600':'text-red-600'}">${fmtBRL(res)}</td>
              </tr>`;
            }).join('')}
            <tr class="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-bold text-xs">
              <td class="px-4 py-2.5 text-slate-700 dark:text-slate-200">Total</td>
              <td class="px-4 py-2.5 text-right text-emerald-600">${fmtBRL(totRec)}</td>
              <td class="px-4 py-2.5 text-right text-red-500">${fmtBRL(totDesp)}</td>
              <td class="px-4 py-2.5 text-right ${totRes>=0?'text-emerald-600':'text-red-600'}">${fmtBRL(totRes)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  }

  function buildDRE() {
    const d = tabData.dre || {};
    const receitas  = d.incomeCategories || d.receitas  || [];
    const despesas  = d.expenseCategories || d.despesas  || [];
    const totRec    = d.totalReceitas  || 0;
    const totDesp   = d.totalDespesas  || 0;
    const resultado = d.resultado || (totRec - totDesp);
    const resPos    = resultado >= 0;

    function section(title, items, total, color) {
      return `
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden mb-3">
        <div class="px-4 py-3 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
          <h4 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">${title}</h4>
          <span class="text-sm font-bold ${color}">${fmtBRL(total)}</span>
        </div>
        <div class="divide-y divide-slate-50 dark:divide-slate-700">
          ${items.length ? items.map(it => `
          <div class="flex items-center px-4 py-2.5">
            <span class="text-xs text-slate-600 dark:text-slate-300 flex-1">${it.name}</span>
            <span class="text-xs font-semibold ${color}">${fmtBRL(it.amount)}</span>
          </div>`).join('') : `<div class="px-4 py-4 text-xs text-slate-400 dark:text-slate-500 text-center">Sem lançamentos</div>`}
        </div>
      </div>`;
    }

    return `
    ${section('Receitas', receitas, totRec, 'text-emerald-600')}
    ${section('Despesas', despesas, totDesp, 'text-red-600')}
    <div class="bg-white dark:bg-slate-800 rounded-xl border ${resPos?'border-emerald-200 dark:border-emerald-700':'border-red-200 dark:border-red-700'} shadow-sm p-5 flex items-center justify-between">
      <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200">Resultado Líquido</h4>
      <span class="text-xl font-extrabold ${resPos?'text-emerald-600':'text-red-600'}">${fmtBRL(resultado)}</span>
    </div>`;
  }

  function buildDizimistas() {
    const d = tabData.dizimistas || {};
    const rows = d.donors || [];
    const totalDiz = d.totalDonors || 0;
    const totalAmt = d.totalAmount || 0;

    const timeline = tabData.personTimeline;

    return `
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div class="lg:col-span-1 space-y-4">
            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <h4 class="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Análise Individual</h4>
                <div class="space-y-3">
                    <button id="btn-select-person" class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-primary/5 transition-all text-left group">
                        <span id="label-selected-person" class="truncate">${tabData.selectedPersonName || 'Selecionar Membro'}</span>
                        <span class="material-symbols-outlined text-sm text-slate-400 group-hover:text-primary transition-colors">person_search</span>
                    </button>
                    
                    <select id="select-timeline-period" class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border-none outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="3m" ${tabData.timelinePeriod==='3m'?'selected':''}>Últimos 3 Meses</option>
                        <option value="6m" ${tabData.timelinePeriod==='6m'?'selected':''}>Últimos 6 Meses</option>
                        <option value="9m" ${tabData.timelinePeriod==='9m'?'selected':''}>Últimos 9 Meses</option>
                        <option value="1y" ${!tabData.timelinePeriod || tabData.timelinePeriod==='1y'?'selected':''}>Último 1 Ano</option>
                        <option value="2y" ${tabData.timelinePeriod==='2y'?'selected':''}>Últimos 2 Anos</option>
                        <option value="3y" ${tabData.timelinePeriod==='3y'?'selected':''}>Últimos 3 Anos</option>
                    </select>

                    <select id="select-timeline-type" class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border-none outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="TODOS" ${tabData.timelineType==='TODOS'?'selected':''}>Dízimos e Ofertas</option>
                        <option value="DIZIMO" ${tabData.timelineType==='DIZIMO'?'selected':''}>Apenas Dízimos</option>
                        <option value="OFERTA" ${tabData.timelineType==='OFERTA'?'selected':''}>Apenas Ofertas</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-3">
                ${kpi('group', 'Doadores no Filtro', totalDiz, 'blue')}
                ${kpi('payments', 'Total do Período', fmtBRL(totalAmt), 'emerald')}
            </div>
        </div>

        <div class="lg:col-span-3">
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 h-full flex flex-col">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h4 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Linha do Tempo de Contribuições</h4>
                        <p class="text-[10px] text-slate-400 mt-1">${tabData.selectedPersonName || 'Selecione um membro para visualizar a evolução'}</p>
                    </div>
                    ${timeline ? `<div class="text-right"><p class="text-[10px] font-black text-primary uppercase">Total Acumulado</p><p class="text-lg font-black text-slate-800 dark:text-white">${fmtBRL(timeline.total)}</p></div>` : ''}
                </div>
                
                <div class="flex-1 min-h-[250px] relative">
                    ${timeline ? `<canvas id="chart-person-timeline"></canvas>` : `
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                        <span class="material-symbols-outlined text-6xl mb-2 opacity-20">leaderboard</span>
                        <p class="text-xs font-medium">Gráfico individual aparecerá aqui</p>
                    </div>
                    `}
                </div>
            </div>
        </div>
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
         <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest">Ranking de Contribuições</h4>
         <span class="text-[10px] text-slate-400 underline cursor-pointer hover:text-primary transition-colors">Ver todos</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
            <tr class="text-slate-400 uppercase text-[9px] font-black tracking-widest">
              <th class="px-6 py-4">Membro</th>
              <th class="px-6 py-4 text-right">Total Acumulado</th>
              <th class="px-6 py-4 text-center">Meses Ativos</th>
              <th class="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody id="ranking-tbody" class="divide-y divide-slate-50 dark:divide-slate-800">
            ${rows.length ? rows.sort((a,b) => b.total - a.total).map(r => {
              const byMonth   = r.byMonth || {};
              const allMonths = (tabData.dizimistas?.months || []).length || 1;
              const activeMonths = Object.values(byMonth).filter(v => v > 0).length;
              const reg    = activeMonths === allMonths ? 'emerald' : activeMonths > 0 ? 'amber' : 'red';
              const rLabel = activeMonths === allMonths ? 'Regular' : activeMonths > 0 ? 'Parcial' : 'Irregular';
              const safeName = r.name.replace(/"/g, '&quot;');
              return `<tr class="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition cursor-pointer" data-personid="${r.personId}" data-personname="${safeName}">

                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">${r.name.charAt(0)}</div>
                        <span class="font-bold text-slate-700 dark:text-slate-200">${r.name}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-right font-black text-emerald-600">${fmtBRL(r.total)}</td>
                <td class="px-6 py-4 text-center text-slate-500 font-medium">${activeMonths}/${allMonths} meses</td>
                <td class="px-6 py-4 text-center">
                  <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black bg-${reg}-100 text-${reg}-700 uppercase tracking-tighter">${rLabel}</span>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="4" class="px-6 py-12 text-center text-slate-400 dark:text-slate-500">Nenhum registro encontrado no período</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  function buildFunds() {
    const items = tabData.funds?.funds || (Array.isArray(tabData.funds) ? tabData.funds : []);
    if (!items.length) return `<div class="flex flex-col items-center py-16 text-slate-400"><span class="material-symbols-outlined text-4xl mb-2 opacity-30">savings</span><p class="text-sm">Nenhum fundo com movimentação no período</p></div>`;
    return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${items.map(f => {
        const color = f.color || f.fundColor || '#6366f1';
        const res   = (f.income||f.totalReceitas||0) - (f.expense||f.totalDespesas||0);
        return `
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background-color:${color}20">
              <span class="material-symbols-outlined text-xl" style="color:${color}">savings</span>
            </div>
            <div>
              <p class="text-sm font-bold text-slate-800 dark:text-slate-100">${f.name||f.fundName}</p>
              <p class="text-[11px] text-slate-400 dark:text-slate-500">${f.ativo ? 'Ativo' : 'Inativo'}</p>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div><p class="text-[10px] text-slate-400 dark:text-slate-500">Receitas</p><p class="text-xs font-bold text-emerald-600">${fmtBRL(f.income||f.totalReceitas)}</p></div>
            <div><p class="text-[10px] text-slate-400 dark:text-slate-500">Despesas</p><p class="text-xs font-bold text-red-500">${fmtBRL(f.expense||f.totalDespesas)}</p></div>
            <div><p class="text-[10px] text-slate-400 dark:text-slate-500">Resultado</p><p class="text-xs font-bold ${res>=0?'text-emerald-600':'text-red-600'}">${fmtBRL(res)}</p></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function buildSummary() {
    const d = tabData.summary || {};
    const byPay = d.byPaymentMethod || [];
    return `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${kpi('trending_up',     'Total Receitas',     fmtBRL(d.totalReceitas),  'emerald')}
      ${kpi('trending_down',   'Total Despesas',     fmtBRL(d.totalDespesas),  'red')}
      ${kpi('account_balance', 'Resultado',          fmtBRL(d.resultado),      (d.resultado||0)>=0?'emerald':'red')}
      ${kpi('receipt_long',    'Transações',         d.transactionCount||0,    'blue')}
    </div>
    ${byPay.length ? `
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-50 dark:border-slate-700">
        <h4 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Por Forma de Pagamento</h4>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="bg-slate-50 dark:bg-slate-900">
            <tr class="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">
              <th class="px-4 py-2.5 text-left">Forma</th>
              <th class="px-4 py-2.5 text-right">Valor</th>
              <th class="px-4 py-2.5 text-center">Qtd</th>
            </tr>
          </thead>
          <tbody>
            ${byPay.map(p => `
            <tr class="border-t border-slate-50 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition">
              <td class="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">${PAY_METHOD_LABEL[p.method]||p.method}</td>
              <td class="px-4 py-2.5 text-right font-bold text-emerald-600">${fmtBRL(p.amount)}</td>
              <td class="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400">${p.count}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}`;
  }

  const TABS = [
    { id: 'dashboard',  label: 'Dashboard',    icon: 'dashboard' },
    { id: 'cashflow',   label: 'Fluxo de Caixa', icon: 'show_chart' },
    { id: 'dre',        label: 'DRE',          icon: 'receipt_long' },
    { id: 'dizimistas', label: 'Dízimos',       icon: 'volunteer_activism' },
    { id: 'funds',      label: 'Por Fundo',     icon: 'savings' },
    { id: 'summary',    label: 'Resumo',        icon: 'summarize' },
  ];

  function renderShell() {
    app.innerHTML = `
    ${header('Relatórios Financeiros', true)}

    <!-- Filtros de período -->
    <div id="filter-bar" class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 py-2.5 sticky top-14 z-10 shrink-0">
      <div class="flex flex-wrap gap-2 items-center max-w-6xl mx-auto">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">Período:</span>
        <input id="f-from" type="date" value="${filterFrom}" class="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-xs outline-none focus:ring-2 focus:ring-primary/20"/>
        <span class="text-slate-400 dark:text-slate-500 text-xs">até</span>
        <input id="f-to" type="date" value="${filterTo}" class="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 text-xs outline-none focus:ring-2 focus:ring-primary/20"/>
        <button id="btn-filter" class="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition">Filtrar</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 shrink-0">
      <div class="flex gap-1 overflow-x-auto no-scrollbar max-w-6xl mx-auto">
        ${TABS.map(t => `
        <button class="rep-tab flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition ${activeTab===t.id?'text-primary border-primary':'text-slate-400 border-transparent hover:text-slate-600'}" data-tab="${t.id}">
          <span class="material-symbols-outlined text-sm">${t.icon}</span>${t.label}
        </button>`).join('')}
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 md:px-6 py-5 max-w-6xl mx-auto w-full pb-20">
      <div id="tab-content"></div>
    </div>
    <div id="export-actions" class="fixed bottom-20 md:bottom-8 right-4 md:right-8 flex flex-col gap-3 z-30">
      <button id="btn-export-pdf" class="w-14 h-14 bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition" title="Exportar PDF"><span class="material-symbols-outlined text-2xl">picture_as_pdf</span></button>
      <button id="btn-export" class="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition" title="Exportar Excel"><span class="material-symbols-outlined text-2xl">grid_on</span></button>
    </div>
    ${bottomNav('finance')}`;

    bindShellEvents();
  }

  function bindShellEvents() {
    document.querySelectorAll('.rep-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (loading) return;
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.rep-tab').forEach(b => {
          const on = b.dataset.tab === activeTab;
          b.classList.toggle('text-primary', on); b.classList.toggle('border-primary', on);
          b.classList.toggle('text-slate-400', !on); b.classList.toggle('border-transparent', !on);
        });
        await loadTab(activeTab);
      });
    });

    document.getElementById('btn-filter')?.addEventListener('click', async () => {
      filterFrom = document.getElementById('f-from')?.value || firstOfMonthISO();
      filterTo   = document.getElementById('f-to')?.value   || lastOfMonthISO();
      tabData = {}; // invalidate cache
      await loadTab(activeTab);
    });

    document.getElementById('btn-export')?.addEventListener('click', exportExcel);
    document.getElementById('btn-export-pdf')?.addEventListener('click', exportPdf);

    if (activeTab === 'dizimistas') bindTimelineEvents();
  }

  function bindTimelineEvents() {
    // Selecionar membro via botão
    document.getElementById('btn-select-person')?.addEventListener('click', async () => {
        const personId = await showPersonPicker();
        if (personId) {
            const p = (store.people || []).find(x => x.id === personId);
            await selectPerson(personId, p?.name || 'Membro');
        }
    });

    // Clique nas linhas da tabela de ranking (event delegation)
    document.getElementById('ranking-tbody')?.addEventListener('click', async (e) => {
        const row = e.target.closest('tr[data-personid]');
        if (!row) return;
        await selectPerson(row.dataset.personid, row.dataset.personname);
    });

    document.getElementById('select-timeline-period')?.addEventListener('change', async (e) => {
        tabData.timelinePeriod = e.target.value;
        if (tabData.selectedPersonId) await loadPersonTimeline();
    });

    document.getElementById('select-timeline-type')?.addEventListener('change', async (e) => {
        tabData.timelineType = e.target.value;
        if (tabData.selectedPersonId) await loadPersonTimeline();
    });
  }

  async function selectPerson(id, name) {
    tabData.selectedPersonId = id;
    tabData.selectedPersonName = name;
    tabData.timelinePeriod = tabData.timelinePeriod || '1y';
    tabData.timelineType = tabData.timelineType || 'TODOS';
    const label = document.getElementById('label-selected-person');
    if (label) label.innerText = name;
    await loadPersonTimeline();
  }

  async function loadPersonTimeline() {
    if (!tabData.selectedPersonId) return;
    try {
        const q = `personId=${tabData.selectedPersonId}&period=${tabData.timelinePeriod || '1y'}&type=${tabData.timelineType || 'TODOS'}`;
        const timeline = await store.apiFetch(`/finance/reports/person-timeline?${q}`);
        tabData.personTimeline = timeline;
        if (activeTab === 'dizimistas') {
            renderTabContent(buildTabContent('dizimistas'));
            bindTimelineEvents();
            setTimeout(() => renderIndividualChart(timeline), 50);
        }
    } catch (err) {
        console.error(err);
        toast('Erro ao carregar linha do tempo', 'error');
    }
  }

  async function exportPdf() {
    // Modal simples para escolha de modo
    const choice = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4';
        modal.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
                    <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">Exportar PDF Timbrado</h3>
                    <p class="text-xs text-slate-500 mt-1">Selecione o tipo de relatório desejado.</p>
                </div>
                <div class="p-3 grid gap-2">
                    <button data-mode="executive" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition text-left group">
                        <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition shrink-0"><span class="material-symbols-outlined">analytics</span></div>
                        <div><p class="text-sm font-bold text-slate-700 dark:text-slate-200">Relatório Executivo</p><p class="text-[10px] text-slate-500">Resumo para diretoria e pastores.</p></div>
                    </button>
                    <button data-mode="analitico" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition text-left group">
                        <div class="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition shrink-0"><span class="material-symbols-outlined">receipt_long</span></div>
                        <div><p class="text-sm font-bold text-slate-700 dark:text-slate-200">Relatório Analítico</p><p class="text-[10px] text-slate-500">Detalhamento para a tesouraria.</p></div>
                    </button>
                     <button data-mode="individual" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 transition text-left group">
                        <div class="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition shrink-0"><span class="material-symbols-outlined">person</span></div>
                        <div><p class="text-sm font-bold text-slate-700 dark:text-slate-200">Comprovante Individual</p><p class="text-[10px] text-slate-500">Extrato para o de doador.</p></div>
                    </button>
                </div>
                <div class="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                    <button id="cancel-pdf" class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelectorAll('button[data-mode]').forEach(b => b.onclick = () => { resolve(b.dataset.mode); modal.remove(); });
        modal.querySelector('#cancel-pdf').onclick = () => { resolve(null); modal.remove(); };
    });

    if (!choice) return;

    let personId = null;
    if (choice === 'individual') {
        // Use the already-selected person from the timeline filter if available
        if (tabData.selectedPersonId) {
            personId = tabData.selectedPersonId;
        } else {
            personId = await showPersonPicker();
            if (!personId) return;
        }
    }

    const btn = document.getElementById('btn-export-pdf');
    const orig = btn?.innerHTML;
    if (btn) { btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span>'; btn.disabled = true; }

    try {
      const q = new URLSearchParams();
      if (filterFrom) q.set('from', filterFrom);
      if (filterTo)   q.set('to', filterTo);
      q.set('mode', choice);
      if (personId) q.set('personId', personId);
      if (choice === 'individual') {
        q.set('period', tabData.timelinePeriod || '1y');
        q.set('type', tabData.timelineType || 'TODOS');
      }

      const res = await fetch(`${store.apiBase}/finance/reports/pdf?${q}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${store.token}` }
      });

      if (!res.ok) throw new Error('Falha ao gerar PDF');

      const blob = await res.blob();
      await store.downloadBlob(blob, `Relatorio_${choice}_${filterFrom}_${filterTo}.pdf`);
      toast('PDF gerado com sucesso!');
    } catch (e) {
      console.error(e);
      toast('Erro ao gerar relatório PDF', 'error');
    } finally {
      if (btn) { btn.innerHTML = orig; btn.disabled = false; }
    }
  }

  async function exportExcel() {
    if (typeof window.XLSX === 'undefined') { toast('Biblioteca Excel não carregada', 'warning'); return; }
    const btn = document.getElementById('btn-export');
    const orig = btn?.innerHTML;
    if (btn) { btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span>'; btn.disabled = true; }

    const q = getQ();
    try {
      const [cashflow, dre, dizimistas, byFund, summary] = await Promise.all([
        store.apiFetch(`/finance/reports/cashflow${q}`).catch(()=>({months:[]})),
        store.apiFetch(`/finance/reports/dre${q}`).catch(()=>({receitas:[],despesas:[]})),
        store.apiFetch(`/finance/reports/dizimistas${q}`).catch(()=>({data:[]})),
        store.apiFetch(`/finance/reports/by-fund${q}`).catch(()=>[]),
        store.apiFetch(`/finance/reports/period-summary${q}`).catch(()=>({})),
      ]);

      const wb = window.XLSX.utils.book_new();

      // Fluxo de Caixa
      const fluxoRows = (cashflow.months||[]).map(m => {
        const [y, mo] = m.month.split('-').map(Number);
        return { 'Mês': `${MONTH_PT[mo-1]}/${y}`, 'Receitas (R$)': (m.receitas||0)/100, 'Despesas (R$)': (m.despesas||0)/100, 'Resultado (R$)': ((m.receitas||0)-(m.despesas||0))/100 };
      });
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(fluxoRows), 'Fluxo_de_Caixa');

      // DRE
      const dreRows = [
        ...((dre.receitas||[]).map(r => ({ 'Tipo': 'Receita', 'Categoria': r.name, 'Valor (R$)': (r.amount||0)/100 }))),
        ...((dre.despesas||[]).map(d => ({ 'Tipo': 'Despesa', 'Categoria': d.name, 'Valor (R$)': (d.amount||0)/100 }))),
        { 'Tipo': 'TOTAL RECEITAS', 'Categoria': '', 'Valor (R$)': (dre.totalReceitas||0)/100 },
        { 'Tipo': 'TOTAL DESPESAS', 'Categoria': '', 'Valor (R$)': (dre.totalDespesas||0)/100 },
        { 'Tipo': 'RESULTADO', 'Categoria': '', 'Valor (R$)': (dre.resultado||(dre.totalReceitas||0)-(dre.totalDespesas||0))/100 },
      ];
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(dreRows), 'DRE');

      // Dízimos
      const dizRows = (dizimistas.donors||[]).sort((a,b)=>b.total-a.total).map(r => ({
        'Membro': r.name, 'Total (R$)': (r.total||0)/100, 'Meses Ativos': Object.values(r.byMonth||{}).filter(v=>v>0).length
      }));
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(dizRows), 'Dizimistas');

      // Por Fundo
      const fundList = byFund?.funds || (Array.isArray(byFund) ? byFund : []);
      const fundRows = fundList.map(f => ({
        'Fundo': f.name||f.fundName, 'Receitas (R$)': (f.income||f.totalReceitas||0)/100,
        'Despesas (R$)': (f.expense||f.totalDespesas||0)/100,
        'Resultado (R$)': ((f.income||f.totalReceitas||0)-(f.expense||f.totalDespesas||0))/100
      }));
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(fundRows), 'Por_Fundo');

      // Resumo
      const sumRows = (summary.byPaymentMethod||[]).map(p => ({
        'Forma de Pagamento': PAY_METHOD_LABEL[p.method]||p.method, 'Valor (R$)': (p.amount||0)/100, 'Qtd': p.count||0
      }));
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(sumRows), 'Resumo_Pagamentos');

      const blob = new Blob([window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' })],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await store.downloadBlob(blob, `Relatorio_Financeiro_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast('Relatório exportado!');
    } catch (e) {
      toast('Erro ao exportar relatório', 'error');
    } finally {
      if (btn) { btn.innerHTML = orig; btn.disabled = false; }
    }
  }

  renderShell();
  await loadTab('dashboard');
}

function renderReportsChart(history) {
  const ctx = document.getElementById('chart-reports-trend');
  if (!ctx) return;

  const isSingle = history.length === 1;
  const labels = history.map(h => {
    const [y, m] = h.month.split('-');
    return `${MONTH_PT[parseInt(m)-1]}/${y.substring(2)}`;
  });
  
  const incomeData = history.map(h => h.income / 100);
  const expenseData = history.map(h => h.expense / 100);

  new Chart(ctx, {
    type: isSingle ? 'bar' : 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Receitas',
          data: incomeData,
          borderColor: '#10b981',
          backgroundColor: isSingle ? '#10b981' : 'transparent',
          borderWidth: isSingle ? 0 : 3,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#10b981'
        },
        {
          label: 'Despesas',
          data: expenseData,
          borderColor: '#f87171',
          backgroundColor: isSingle ? '#f87171' : 'transparent',
          borderWidth: isSingle ? 0 : 3,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#f87171'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: R$ ${ctx.parsed.y.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
          }
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { borderDash: [5, 5], color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

function renderIndividualChart(timeline) {
  const ctx = document.getElementById('chart-person-timeline');
  if (!ctx || !timeline) return;

  const MONTH_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const labels = timeline.labels.map(m => {
    const [y, mo] = m.split('-');
    return `${MONTH_PT[parseInt(mo)-1]}/${y.substring(2)}`;
  });

  const data = timeline.data.map(v => v / 100);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Contribuições',
        data,
        backgroundColor: data.map(v =>
          v > 0
            ? 'rgba(59, 130, 246, 0.85)'
            : 'rgba(226, 232, 240, 0.5)'
        ),
        borderColor: data.map(v =>
          v > 0 ? '#2563eb' : '#cbd5e1'
        ),
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `R$ ${ctx.parsed.y.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { borderDash: [5, 5], color: '#f1f5f9' },
          ticks: {
            font: { size: 10 },
            callback: (v) => `R$ ${v.toLocaleString('pt-BR')}`
          }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 9 } }
        }
      }
    }
  });
}

async function showPersonPicker() {
  const people = (store.people || [])
    .filter(p => p && p.name)
    .sort((a,b) => a.name.localeCompare(b.name));
  
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
        <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">Selecionar Pessoa</h3>
            <button id="close-picker" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><span class="material-symbols-outlined">close</span></button>
          </div>
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input id="picker-search" type="text" placeholder="Buscar por nome..." class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"/>
          </div>
        </div>
        <div id="picker-list" class="flex-1 overflow-y-auto p-2 space-y-1 min-h-[300px]">
          <!-- Lista de pessoas -->
        </div>
        <div class="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 shrink-0 flex justify-between items-center">
          <p class="text-[10px] text-slate-400">Clique na pessoa para selecionar</p>
          <button id="cancel-picker" class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const list = modal.querySelector('#picker-list');
    const input = modal.querySelector('#picker-search');

    function renderList(filter = '') {
      const filtered = people.filter(p => (p.name || '').toLowerCase().includes(filter.toLowerCase())).slice(0, 50);
      if (filtered.length === 0) {
        list.innerHTML = `<div class="py-12 text-center text-slate-400"><span class="material-symbols-outlined text-4xl mb-2 opacity-20">person_search</span><p class="text-sm italic">Ninguém encontrado</p></div>`;
        return;
      }
      list.innerHTML = filtered.map(p => `
        <button data-id="${p.id}" class="picker-item w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary/5 dark:hover:bg-primary/10 transition-all text-left border border-transparent hover:border-primary/10 group">
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0 group-hover:scale-105 transition">${p.name.charAt(0)}</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">${p.name}</p>
            <p class="text-[10px] text-slate-400 truncate">${p.email || 'Sem e-mail'}</p>
          </div>
          <span class="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
        </button>
      `).join('');
      
      list.querySelectorAll('.picker-item').forEach(btn => {
        btn.onclick = () => { resolve(btn.dataset.id); modal.remove(); };
      });
    }

    renderList();
    input.focus();
    input.oninput = (e) => renderList(e.target.value);
    
    const cancel = () => { resolve(null); modal.remove(); };
    modal.querySelector('#cancel-picker').onclick = cancel;
    modal.querySelector('#close-picker').onclick = cancel;
    modal.onclick = (e) => { if (e.target === modal) cancel(); };
  });
}
