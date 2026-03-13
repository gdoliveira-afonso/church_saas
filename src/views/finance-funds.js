import { store } from '../store.js';
import { header, toast, bottomNav, openModal, closeModal } from '../components/ui.js';

function fmtBRL(v) { return 'R$ ' + (Number(v||0) / 100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }

export async function financeFundsView() {
  const app = document.getElementById('app');
  const canManage = store.hasRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN');

  let funds = [];

  async function loadFunds() {
    try {
      funds = await store.apiFetch('/finance/funds');
      store.financeFunds = Array.isArray(funds) ? funds : [];
    } catch (e) {
      toast('Erro ao carregar fundos', 'error');
      funds = store.financeFunds || [];
    }
  }

  function render() {
    app.innerHTML = `
    ${header('Fundos', true)}
    <div class="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-3 max-w-3xl mx-auto w-full pb-20">

      ${funds.length === 0 ? `
      <div class="flex flex-col items-center justify-center py-20 text-center">
        <div class="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
          <span class="material-symbols-outlined text-3xl text-amber-400">savings</span>
        </div>
        <h3 class="text-base font-bold text-slate-700 dark:text-slate-200 mb-1">Nenhum fundo cadastrado</h3>
        <p class="text-sm text-slate-400 dark:text-slate-500 max-w-xs">Fundos permitem separar e rastrear receitas por finalidade (ex: Missões, Reforma, etc.)</p>
        ${canManage ? `<button id="btn-new-fund-empty" class="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition shadow-sm"><span class="material-symbols-outlined text-lg">add</span>Criar Primeiro Fundo</button>` : ''}
      </div>` : `
      <div class="space-y-3">
        ${funds.map(f => `
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex items-start gap-4 ${!f.ativo ? 'opacity-60' : ''}">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style="background-color:${f.color || '#6366f1'}20">
            <span class="material-symbols-outlined text-xl" style="color:${f.color || '#6366f1'}">savings</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-bold text-slate-800 dark:text-slate-100">${f.name}</p>
              ${!f.ativo ? '<span class="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-semibold">Inativo</span>' : ''}
            </div>
            ${f.description ? `<p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">${f.description}</p>` : ''}
            <p class="text-base font-extrabold mt-1.5 ${Number(f.balance||0) >= 0 ? 'text-emerald-600' : 'text-red-600'}">${fmtBRL(f.balance)}</p>
          </div>
          ${canManage ? `
          <div class="flex items-center gap-1 shrink-0">
            <button data-id="${f.id}" data-action="toggle" title="${f.ativo ? 'Desativar' : 'Ativar'}" class="fund-btn w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              <span class="material-symbols-outlined text-[18px]">${f.ativo ? 'toggle_on' : 'toggle_off'}</span>
            </button>
            <button data-id="${f.id}" data-action="edit" title="Editar" class="fund-btn w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition">
              <span class="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button data-id="${f.id}" data-action="delete" title="Excluir" class="fund-btn w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>` : ''}
        </div>`).join('')}
      </div>`}

    </div>
    ${canManage ? `<button id="btn-float-add-fund" class="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition"><span class="material-symbols-outlined text-2xl">add</span></button>` : ''}
    ${bottomNav('finance')}`;

    bindEvents();
  }

  function bindEvents() {
    document.getElementById('btn-new-fund')?.addEventListener('click', () => openFundModal(null));
    document.getElementById('btn-new-fund-empty')?.addEventListener('click', () => openFundModal(null));
    document.getElementById('btn-float-add-fund')?.addEventListener('click', () => openFundModal(null));

    document.querySelectorAll('.fund-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const fund = funds.find(f => f.id === id);

        if (action === 'edit') {
          openFundModal(fund);
        } else if (action === 'toggle') {
          try {
            await store.apiFetch(`/finance/funds/${id}/toggle`, { method: 'PATCH' });
            await loadFunds();
            render();
          } catch (e) {
            toast('Erro ao alterar status do fundo', 'error');
          }
        } else if (action === 'delete') {
          if (Number(fund?.saldo || 0) !== 0) {
            toast('Não é possível excluir um fundo com saldo', 'error');
            return;
          }
          if (!confirm(`Excluir fundo "${fund?.name}"?`)) return;
          try {
            await store.apiFetch(`/finance/funds/${id}`, { method: 'DELETE' });
            toast('Fundo excluído');
            await loadFunds();
            render();
          } catch (e) {
            toast(e.message || 'Erro ao excluir fundo', 'error');
          }
        }
      });
    });
  }

  function openFundModal(fund) {
    const isEdit = !!fund;
    openModal(`
    <div class="p-5 space-y-4 max-w-md w-full">
      <h3 class="text-base font-bold text-slate-800">${isEdit ? 'Editar Fundo' : 'Novo Fundo'}</h3>

      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Nome *</label>
        <input id="f-name" type="text" value="${fund?.name || ''}" placeholder="Ex: Fundo de Missões" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Descrição</label>
        <input id="f-desc" type="text" value="${fund?.description || ''}" placeholder="Descrição do fundo (opcional)" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Cor</label>
        <div class="flex gap-2 items-center">
          <input id="f-color" type="color" value="${fund?.color || '#6366f1'}" class="h-9 w-12 p-1 rounded cursor-pointer border border-slate-200"/>
          <span class="text-xs text-slate-400">Cor usada para identificar o fundo nas visualizações</span>
        </div>
      </div>
      ${isEdit ? `
      <div class="flex items-center gap-2">
        <input id="f-ativo" type="checkbox" class="w-4 h-4 accent-primary" ${fund.ativo ? 'checked' : ''}/>
        <label for="f-ativo" class="text-sm text-slate-700">Fundo ativo</label>
      </div>` : ''}

      <div class="flex gap-2 pt-2">
        <button onclick="closeModal()" class="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
        <button id="btn-save-fund" class="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">Salvar</button>
      </div>
    </div>`);

    document.getElementById('btn-save-fund').addEventListener('click', async () => {
      const name = document.getElementById('f-name')?.value.trim();
      if (!name) { toast('Nome é obrigatório', 'error'); return; }
      const body = {
        name,
        description: document.getElementById('f-desc')?.value.trim() || null,
        color: document.getElementById('f-color')?.value || '#6366f1',
      };
      if (isEdit) body.ativo = document.getElementById('f-ativo')?.checked ?? true;

      const btn = document.getElementById('btn-save-fund');
      btn.disabled = true; btn.textContent = 'Salvando...';
      try {
        if (isEdit) {
          await store.apiFetch(`/finance/funds/${fund.id}`, { method: 'PUT', body: JSON.stringify(body) });
          toast('Fundo atualizado');
        } else {
          await store.apiFetch('/finance/funds', { method: 'POST', body: JSON.stringify(body) });
          toast('Fundo criado!');
        }
        closeModal();
        await loadFunds();
        render();
      } catch (e) {
        toast(e.message || 'Erro ao salvar fundo', 'error');
        btn.disabled = false; btn.textContent = 'Salvar';
      }
    });
  }

  // Loading
  app.innerHTML = `
  ${header('Fundos', true)}
  <div class="flex-1 flex items-center justify-center">
    <span class="material-symbols-outlined text-4xl text-slate-300 animate-spin">refresh</span>
  </div>
  ${bottomNav('finance')}`;

  await loadFunds();
  render();
}
