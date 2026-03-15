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
      <p class="text-sm">Carregando inteligência financeira...</p>
    </div>
  </div>
  ${bottomNav('finance')}`;

  let data = null;
  let analytics = null;
  try {
    [data, analytics] = await Promise.all([
        store.apiFetch('/finance/reports/dashboard'),
        store.apiFetch('/finance/analytics/dashboard-metrics')
    ]);
  } catch (err) {
    console.error(err);
    toast('Erro ao carregar dados financeiros', 'error');
    data = {};
    analytics = {};
  }

  const entradaMes   = analytics?.income?.value ?? data?.entradaMes ?? 0;
  const saidaMes     = analytics?.expense?.value ?? data?.saidaMes ?? 0;
  const incomeDelta  = analytics?.income?.delta ?? 0;
  const expenseDelta = analytics?.expense?.delta ?? 0;
  
  const resultadoMes = entradaMes - saidaMes;
  const totalDizimistas = data?.totalDizimistas ?? 0;
  const billsVencendo   = (data?.contasVencer7d ?? data?.billsVencendo) ?? 0;
  const saldoPorConta   = data?.saldoPorConta   ?? [];

  const resultadoPositivo = resultadoMes >= 0;

  const kpis = [
    {
      label: 'Entradas',
      value: fmtBRL(entradaMes),
      delta: incomeDelta,
      icon: 'trending_up',
      color: 'emerald',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      iconBg: 'bg-emerald-100',
      iconText: 'text-emerald-600',
    },
    {
      label: 'Saídas',
      value: fmtBRL(saidaMes),
      delta: expenseDelta,
      icon: 'trending_down',
      color: 'red',
      bg: 'bg-red-50',
      text: 'text-red-700',
      iconBg: 'bg-red-100',
      iconText: 'text-red-600',
    },
    {
      label: 'Resultado',
      value: fmtBRL(resultadoMes),
      icon: 'account_balance',
      color: resultadoPositivo ? 'emerald' : 'red',
      bg: resultadoPositivo ? 'bg-emerald-50' : 'bg-red-50',
      text: resultadoPositivo ? 'text-emerald-700' : 'text-red-700',
      iconBg: resultadoPositivo ? 'bg-emerald-100' : 'bg-red-100',
      iconText: resultadoPositivo ? 'text-emerald-600' : 'text-red-600',
    },
    {
      label: 'Dizimistas',
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
    { label: 'Plano de Contas',   icon: 'category',              route: '/finance/chart',        color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Inteligência (BI)', icon: 'analytics',             route: '/finance/bi',           color: 'bg-amber-100 text-amber-700' },
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
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${kpis.map(k => `
        <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div class="flex items-center justify-between mb-2">
                <div class="w-8 h-8 rounded-lg ${k.iconBg} flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-lg ${k.iconText}">${k.icon}</span>
                </div>
                ${k.delta !== undefined ? `
                    <span class="text-[10px] font-bold ${k.delta >= 0 ? (k.label === 'Saídas' ? 'text-red-500' : 'text-emerald-500') : (k.label === 'Saídas' ? 'text-emerald-500' : 'text-red-500')} flex items-center">
                        ${k.delta > 0 ? '↑' : '↓'} ${Math.abs(k.delta)}%
                    </span>
                ` : ''}
            </div>
            <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">${k.label}</p>
            <p class="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">${k.value}</p>
        </div>`).join('')}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Gráfico de Tendência (Dashboard) -->
        <div class="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100 italic">Tendência Financeira</h3>
                    <p class="text-[10px] text-slate-400">Receitas vs Despesas (6 meses)</p>
                </div>
                <div class="flex gap-2 text-[10px] font-bold">
                    <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span><span class="text-slate-500">Entradas</span></div>
                    <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400"></span><span class="text-slate-500">Saídas</span></div>
                </div>
            </div>
            <div class="h-48 w-full">
                <canvas id="chart-dashboard-trend"></canvas>
            </div>
        </div>

        <!-- Gráfico de Retenção -->
        <div class="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100 italic">Retenção de Doadores</h3>
                    <p class="text-[10px] text-slate-400">Novos vs Perdidos (Mês Atual)</p>
                </div>
                <div class="flex gap-2 text-[10px] font-bold">
                    <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span><span class="text-slate-500">Novos</span></div>
                    <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-slate-300"></span><span class="text-slate-500">Perdidos</span></div>
                </div>
            </div>
            <div class="h-48 w-full flex items-center justify-center">
                <canvas id="chart-retention"></canvas>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Saldo por Conta -->
        <div class="space-y-3">
            <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Saldo por Conta</h3>
            <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm divide-y divide-slate-50 dark:divide-slate-700">
                ${saldoPorConta.map(c => `
                <div class="flex items-center gap-3 px-4 py-3">
                    <div class="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-[18px] text-blue-500">${accountIcon(c.type)}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">${c.name}</p>
                        <p class="text-[11px] text-slate-400 dark:text-slate-500">${ACCOUNT_TYPE_LABEL[c.type] || c.type}</p>
                    </div>
                    <p class="text-sm font-bold ${Number(c.balance||0) >= 0 ? 'text-emerald-600' : 'text-red-600'} shrink-0">${fmtBRL(c.balance)}</p>
                </div>`).join('')}
                ${!saldoPorConta.length ? '<p class="p-4 text-center text-xs text-slate-400">Nenhuma conta ativa.</p>' : ''}
            </div>
        </div>

        <!-- Menu de Acesso Rápido -->
        <div class="space-y-3">
            <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acesso Rápido</h3>
            <div class="grid grid-cols-3 gap-2">
                ${quickMenu.map(m => `
                <a href="#${m.route}" class="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 shadow-sm hover:border-primary/30 hover:shadow-md transition flex flex-col items-center gap-2 text-center group">
                    <div class="w-10 h-10 rounded-xl ${m.color} flex items-center justify-center group-hover:scale-110 transition">
                        <span class="material-symbols-outlined text-xl">${m.icon}</span>
                    </div>
                    <p class="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-tight">${m.label}</p>
                </a>`).join('')}
            </div>
        </div>
    </div>

  </div>
  ${bottomNav('finance')}`;

  if (data?.byMonth?.length) {
    setTimeout(() => {
        renderDashboardChart(data.byMonth);
        renderRetentionChart(analytics?.retention || { new: 0, lost: 0 });
    }, 100);
  }
}

function renderDashboardChart(history) {
  const ctx = document.getElementById('chart-dashboard-trend');
  if (!ctx) return;

  const MONTH_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  
  const labels = history.map(h => {
    const [y, m] = h.month.split('-');
    return `${MONTH_PT[parseInt(m)-1]}`;
  });
  
  const incomeData = history.map(h => h.income / 100);
  const expenseData = history.map(h => h.expense / 100);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Entradas',
          data: incomeData,
          borderColor: '#10b981',
          backgroundColor: '#10b98110',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointBackgroundColor: '#10b981'
        },
        {
          label: 'Saídas',
          data: expenseData,
          borderColor: '#f87171',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        y: { display: false, beginAtZero: true },
        x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#94a3b8' } }
      }
    }
  });
}

function renderRetentionChart(retention) {
    const ctx = document.getElementById('chart-retention');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Novos', 'Perdidos'],
            datasets: [{
                label: 'Doadores',
                data: [retention.new, retention.lost],
                backgroundColor: ['#3b82f6', '#e2e8f0'],
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false, beginAtZero: true },
                x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' }, color: '#64748b' } }
            }
        }
    });
}
