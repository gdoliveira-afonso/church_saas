import { store } from '../store.js';
import { header, toast, bottomNav } from '../components/ui.js';
import { navigate } from '../router.js';

function fmtBRL(v) { return 'R$ ' + (Number(v||0) / 100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }

const ACCOUNT_TYPE_LABEL = { CORRENTE: 'Conta Corrente', POUPANCA: 'Poupança', CAIXA: 'Caixa', INVESTIMENTO: 'Investimento', OUTRO: 'Outro' };

function accountIcon(type) {
  const icons = { CORRENTE: 'account_balance', POUPANCA: 'savings', CAIXA: 'point_of_sale', INVESTIMENTO: 'show_chart', OUTRO: 'wallet' };
  return icons[type] || 'wallet';
}

export async function financeDashboardView() {
  const app = document.getElementById('app');

  if (!store.systemSettings?.financialEnabled) {
    app.innerHTML = `
    ${header('Financeiro', false)}
    <div class="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <span class="material-symbols-outlined text-3xl text-slate-400 dark:text-slate-500">account_balance_wallet</span>
      </div>
      <h2 class="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Módulo Financeiro desabilitado</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 max-w-xs">O módulo financeiro não está habilitado para esta organização. Contate o administrador para ativá-lo.</p>
      <a href="#/dashboard" class="mt-6 text-sm text-primary font-semibold hover:underline">Voltar ao Dashboard</a>
    </div>
    ${bottomNav('finance')}`;
    return;
  }

  const canAccess = store.hasRole('ADMIN','SUPERVISOR','SUPERADMIN') || store.hasSecondaryRole('AGENTE_FINANCEIRO');
  if (!canAccess) {
    navigate('/dashboard');
    return;
  }

  // Loading state
  app.innerHTML = `
  ${header('Financeiro', false)}
  <div class="flex-1 flex items-center justify-center">
    <div class="flex flex-col items-center gap-3 text-slate-400">
      <span class="material-symbols-outlined text-4xl animate-spin">refresh</span>
      <p class="text-sm">Carregando dados financeiros...</p>
    </div>
  </div>
  ${bottomNav('finance')}`;

  let data = null;
  try {
    data = await store.apiFetch('/finance/reports/dashboard');
  } catch (err) {
    toast('Erro ao carregar dados financeiros', 'error');
    data = {};
  }

  const entradaMes   = data?.entradaMes   ?? 0;
  const saidaMes     = data?.saidaMes     ?? 0;
  const resultadoMes = data?.resultadoMes ?? 0;
  const totalDizimistas = data?.totalDizimistas ?? 0;
  const billsVencendo   = (data?.contasVencer7d ?? data?.billsVencendo) ?? 0;
  const saldoPorConta   = data?.saldoPorConta   ?? [];

  const resultadoPositivo = resultadoMes >= 0;

  const kpis = [
    {
      label: 'Entradas do Mês',
      value: fmtBRL(entradaMes),
      icon: 'trending_up',
      color: 'emerald',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      iconBg: 'bg-emerald-100',
      iconText: 'text-emerald-600',
    },
    {
      label: 'Saídas do Mês',
      value: fmtBRL(saidaMes),
      icon: 'trending_down',
      color: 'red',
      bg: 'bg-red-50',
      text: 'text-red-700',
      iconBg: 'bg-red-100',
      iconText: 'text-red-600',
    },
    {
      label: 'Resultado do Mês',
      value: fmtBRL(resultadoMes),
      icon: 'account_balance',
      color: resultadoPositivo ? 'emerald' : 'red',
      bg: resultadoPositivo ? 'bg-emerald-50' : 'bg-red-50',
      text: resultadoPositivo ? 'text-emerald-700' : 'text-red-700',
      iconBg: resultadoPositivo ? 'bg-emerald-100' : 'bg-red-100',
      iconText: resultadoPositivo ? 'text-emerald-600' : 'text-red-600',
    },
    {
      label: 'Dizimistas Ativos',
      value: totalDizimistas,
      icon: 'volunteer_activism',
      color: 'blue',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600',
    },
  ];

  const quickMenu = [
    { label: 'Lançamentos',       icon: 'receipt_long',          route: '/finance/transactions', color: 'bg-slate-100 text-slate-600' },
    { label: 'Doações & Dízimos', icon: 'volunteer_activism',    route: '/finance/donations',    color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Contas a Pagar',    icon: 'payments',              route: '/finance/bills',        color: 'bg-red-50 text-red-600' },
    { label: 'Contas Bancárias',  icon: 'account_balance',       route: '/finance/accounts',     color: 'bg-blue-50 text-blue-600' },
    { label: 'Fundos',            icon: 'savings',               route: '/finance/funds',        color: 'bg-amber-50 text-amber-600' },
    { label: 'Relatórios',        icon: 'bar_chart',             route: '/finance/reports',      color: 'bg-purple-50 text-purple-600' },
  ];

  app.innerHTML = `
  ${header('Financeiro', false)}
  <div class="flex-1 overflow-y-auto px-4 md:px-6 py-4 bg-slate-50/30 dark:bg-slate-950/30 space-y-5">

    ${billsVencendo > 0 ? `
    <div class="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl px-4 py-3">
      <span class="material-symbols-outlined text-amber-500 text-xl shrink-0">warning</span>
      <p class="text-sm text-amber-800 dark:text-amber-300 font-medium">${billsVencendo} conta(s) a pagar vencendo em breve</p>
      <a href="#/finance/bills" class="ml-auto text-xs text-amber-700 dark:text-amber-400 font-semibold hover:underline shrink-0">Ver</a>
    </div>` : ''}

    <!-- KPIs -->
    <div>
      <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Resumo do Mês</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${kpis.map(k => `
        <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-9 h-9 rounded-lg ${k.iconBg} flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[20px] ${k.iconText}">${k.icon}</span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">${k.label}</p>
          </div>
          <p class="text-base font-bold ${k.text} leading-tight">${k.value}</p>
        </div>`).join('')}
      </div>
    </div>

    <!-- Saldo por Conta -->
    ${saldoPorConta.length > 0 ? `
    <div>
      <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Saldo por Conta</h3>
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm divide-y divide-slate-50 dark:divide-slate-700">
        ${saldoPorConta.map(c => `
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[18px] text-blue-500">${accountIcon(c.type)}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">${c.name}</p>
            <p class="text-[11px] text-slate-400 dark:text-slate-500">${ACCOUNT_TYPE_LABEL[c.type] || c.type}</p>
          </div>
          <p class="text-sm font-bold ${Number(c.balance||0) >= 0 ? 'text-emerald-600' : 'text-red-600'} shrink-0">${fmtBRL(c.balance)}</p>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- Menu de Acesso Rápido -->
    <div>
      <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Acesso Rápido</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        ${quickMenu.map(m => `
        <a href="#${m.route}" class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm hover:border-primary/30 hover:shadow-md transition flex flex-col items-center gap-2 text-center group">
          <div class="w-12 h-12 rounded-xl ${m.color} flex items-center justify-center group-hover:scale-110 transition">
            <span class="material-symbols-outlined text-2xl">${m.icon}</span>
          </div>
          <p class="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">${m.label}</p>
        </a>`).join('')}
      </div>
    </div>

  </div>
  ${bottomNav('finance')}`;
}
