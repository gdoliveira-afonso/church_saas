import { store } from '../store.js';
import { header, toast, bottomNav } from '../components/ui.js';
import { navigate } from '../router.js';

function fmtBRL(v) { return 'R$ ' + (Number(v||0) / 100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }

export async function financeBiView() {
  const app = document.getElementById('app');

  const canAccess = store.hasRole('ADMIN','SUPERADMIN') || store.hasSecondaryRole('AGENTE_FINANCEIRO','GESTOR_FINANCEIRO');
  if (!canAccess) {
    navigate('/dashboard');
    return;
  }

  // Meses padrão: Mês Anterior vs Mês Atual
  const today = new Date();
  const monthCurrent = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  
  const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const monthPrev = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;

  app.innerHTML = `
  ${header('Inteligência Financeira', true)}
  <div class="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 pb-20">
    
    <!-- Filtros de Comparação -->
    <div class="px-4 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 space-y-4">
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Mês A (Referência)</label>
                <input type="month" id="bi-month-a" value="${monthPrev}" class="text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl w-full font-bold">
            </div>
            <div>
                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Mês B (Comparação)</label>
                <input type="month" id="bi-month-b" value="${monthCurrent}" class="text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl w-full font-bold text-primary">
            </div>
        </div>
        <button id="btn-update-bi" class="w-full bg-slate-900 dark:bg-primary text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/10 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
            <span class="material-symbols-outlined text-sm">analytics</span> Comparar Meses
        </button>
    </div>

    <div id="bi-content" class="px-4 md:px-6 py-5 space-y-6">
        <!-- Renderizado dinamicamente -->
        <div class="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <span class="material-symbols-outlined text-4xl animate-spin">refresh</span>
            <p class="text-sm">Processando dados históricos...</p>
        </div>
    </div>

  </div>
  ${bottomNav('finance')}`;

  const loadData = async () => {
    const monthA = document.getElementById('bi-month-a').value;
    const monthB = document.getElementById('bi-month-b').value;

    if (!monthA || !monthB) {
        toast('Selecione os dois meses para comparar', 'warning');
        return;
    }

    const getRange = (monthStr) => {
        const [y, m] = monthStr.split('-').map(Number);
        const start = `${y}-${String(m).padStart(2,'0')}-01`;
        const end = new Date(y, m, 0).toISOString().split('T')[0];
        return { start, end };
    };

    const rangeA = getRange(monthA);
    const rangeB = getRange(monthB);

    const q = `startA=${rangeA.start}&endA=${rangeA.end}&startB=${rangeB.start}&endB=${rangeB.end}`;
    
    const content = document.getElementById('bi-content');
    content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-slate-400">
            <span class="material-symbols-outlined animate-spin text-4xl mb-4 text-primary">analytics</span>
            <p class="text-sm font-medium italic">Cruzando dados e gerando insights...</p>
        </div>
    `;

    try {
      const [stats, retention, records] = await Promise.all([
        store.apiFetch(`/finance/bi/compare?${q}`),
        store.apiFetch(`/finance/bi/retention-details?${q}`),
        store.apiFetch(`/finance/bi/highs`)
      ]);

      renderBI(content, stats, retention, records);
    } catch (err) {
      console.error(err);
      content.innerHTML = `<p class="text-red-500 text-center py-10 font-bold">Erro ao carregar dados.</p>`;
    }
  };

  document.getElementById('btn-update-bi').addEventListener('click', loadData);
  loadData();
}

function renderBI(container, stats, retention, records) {
    const { periodA, periodB, variation } = stats;
    
    const cards = [
        { label: 'Receitas', description: 'Total arrecadado no mês (Dízimos + Ofertas)', valA: periodA.income, valB: periodB.income, variant: variation.income, type: 'BRL' },
        { label: 'Doadores Únicos', description: 'Quantas pessoas diferentes contribuíram', valA: periodA.giversCount, valB: periodB.giversCount, variant: variation.giversCount, type: 'INT' },
        { label: 'Ticket Médio', description: 'Valor médio doado por pessoa/membro', valA: periodA.avgContribution, valB: periodB.avgContribution, variant: variation.giversCount, type: 'BRL' },
    ];

    const DAYS_PT = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

    container.innerHTML = `
    <!-- Recordes Históricos -->
    <div class="space-y-3">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span class="material-symbols-outlined text-sm text-amber-500">military_tech</span> Recordes Históricos 
            <span class="material-symbols-outlined text-[14px] text-slate-300" title="As melhores marcas desde o início do sistema">help</span>
        </h3>
        <div class="grid grid-cols-2 gap-3">
            <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg shadow-indigo-500/20">
                <p class="text-[10px] font-bold opacity-80 uppercase mb-1">Mês mais Rentável</p>
                <h4 class="text-lg font-black">${fmtBRL(records.topMonth?.total)}</h4>
                <p class="text-[10px] font-medium opacity-90">${records.topMonth?.month || '---'}</p>
            </div>
            <div class="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-4 text-white shadow-lg shadow-rose-500/20">
                <p class="text-[10px] font-bold opacity-80 uppercase mb-1">Mês menos Rentável</p>
                <h4 class="text-lg font-black">${fmtBRL(records.bottomMonth?.total)}</h4>
                <p class="text-[10px] font-medium opacity-90">${records.bottomMonth?.month || '---'}</p>
            </div>
        </div>
    </div>

    <!-- Comparativo Metrics -->
    <div class="grid grid-cols-1 gap-4">
        ${cards.map(c => `
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <p class="text-xs font-bold text-slate-400 uppercase">${c.label}</p>
                    <p class="text-[9px] text-slate-400 italic">${c.description}</p>
                </div>
                <div class="px-2 py-1 rounded-full text-[10px] font-black ${c.variant >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">
                    ${c.variant >= 0 ? '↑' : '↓'} ${Math.abs(c.variant)}%
                </div>
            </div>
            <div class="flex items-center gap-6 mt-4">
                <div>
                    <p class="text-[10px] text-slate-400 font-bold mb-1">Mês A</p>
                    <p class="text-sm font-bold text-slate-500">${c.type === 'BRL' ? fmtBRL(c.valA) : c.valA}</p>
                </div>
                <div class="w-px h-8 bg-slate-100 dark:bg-slate-800"></div>
                <div>
                    <p class="text-[10px] text-primary font-bold mb-1">Mês B</p>
                    <p class="text-xl font-black text-slate-800 dark:text-white">${c.type === 'BRL' ? fmtBRL(c.valB) : c.valB}</p>
                </div>
            </div>
        </div>
        `).join('')}
    </div>

    <!-- Retenção de Membros -->
    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest">Retenção de Doadores</h3>
        </div>

        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div class="flex bg-slate-50 dark:bg-slate-800/50 p-1">
                <button onclick="document.querySelectorAll('.bi-tab').forEach(t=>t.classList.add('hidden')); document.getElementById('tab-adormecidos').classList.remove('hidden'); document.querySelectorAll('.bi-btn-tab').forEach(b=>b.classList.remove('bg-white','shadow-sm')); this.classList.add('bg-white','shadow-sm');" class="bi-btn-tab flex-1 py-2 text-[10px] font-bold rounded-lg transition-all bg-white shadow-sm">EM RISCO (${retention.adormecidos.length})</button>
                <button onclick="document.querySelectorAll('.bi-tab').forEach(t=>t.classList.add('hidden')); document.getElementById('tab-novos').classList.remove('hidden'); document.querySelectorAll('.bi-btn-tab').forEach(b=>b.classList.remove('bg-white','shadow-sm')); this.classList.add('bg-white','shadow-sm');" class="bi-btn-tab flex-1 py-2 text-[10px] font-bold rounded-lg transition-all">NOVOS (${retention.novos.length})</button>
                <button onclick="document.querySelectorAll('.bi-tab').forEach(t=>t.classList.add('hidden')); document.getElementById('tab-fieis').classList.remove('hidden'); document.querySelectorAll('.bi-btn-tab').forEach(b=>b.classList.remove('bg-white','shadow-sm')); this.classList.add('bg-white','shadow-sm');" class="bi-btn-tab flex-1 py-2 text-[10px] font-bold rounded-lg transition-all">FIÉIS (${retention.fieis.length})</button>
            </div>

            <div id="tab-adormecidos" class="bi-tab divide-y divide-slate-50 dark:divide-slate-800">
                ${retention.adormecidos.map(p => `
                <div class="p-4 flex items-center justify-between group">
                    <div>
                        <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${p.name}</p>
                        <p class="text-[10px] text-red-500 font-bold">Parou de dizimar</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-bold text-slate-500">${fmtBRL(p.amount)}</p>
                        <p class="text-[10px] text-slate-400">Contribuição média</p>
                    </div>
                </div>`).join('')}
                ${!retention.adormecidos.length ? '<p class="p-8 text-center text-xs text-slate-400">Ninguém deixou de contribuir neste período. Ótimo!</p>' : ''}
            </div>

            <div id="tab-novos" class="bi-tab hidden divide-y divide-slate-50 dark:divide-slate-800">
                ${retention.novos.map(p => `
                <div class="p-4 flex items-center justify-between">
                    <div>
                        <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${p.name}</p>
                        <p class="text-[10px] text-emerald-500 font-bold">Iniciou contribuições</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-bold text-slate-800 dark:text-white">${fmtBRL(p.amount)}</p>
                    </div>
                </div>`).join('')}
                ${!retention.novos.length ? '<p class="p-8 text-center text-xs text-slate-400">Nenhum novo doador no período.</p>' : ''}
            </div>

            <div id="tab-fieis" class="bi-tab hidden divide-y divide-slate-50 dark:divide-slate-800">
                ${retention.fieis.map(p => `
                <div class="p-4 flex items-center justify-between">
                    <div>
                        <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${p.name}</p>
                        <p class="text-[10px] text-blue-500 font-bold">Continua firme</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-bold text-slate-800 dark:text-white">${fmtBRL(p.amount)}</p>
                        <p class="text-[10px] ${p.amount >= p.prevAmount ? 'text-emerald-500' : 'text-red-400'} font-bold">
                            ${p.amount >= p.prevAmount ? '↑' : '↓'} ${Math.round(((p.amount - p.prevAmount) / (p.prevAmount||1)) * 100)}%
                        </p>
                    </div>
                </div>`).join('')}
                ${!retention.fieis.length ? '<p class="p-8 text-center text-xs text-slate-400">Nenhum doador fiel identificado.</p>' : ''}
            </div>
        </div>
    </div>

    <!-- Dica Pastoral -->
    <div class="bg-primary/10 border border-primary/20 rounded-2xl p-5 flex gap-4">
        <span class="material-symbols-outlined text-primary text-2xl">lightbulb</span>
        <div>
            <h4 class="text-xs font-bold text-primary uppercase mb-1">Insight Pastoral</h4>
            <p class="text-xs text-primary/80 leading-relaxed font-medium">
                Você tem <b>${retention.adormecidos.length} pessoas</b> que dizimaram no Período A mas não no Período B. 
                Considere uma mensagem ou visita para entender se elas precisam de apoio espiritual ou financeiro.
            </p>
        </div>
    </div>
    `;
}
