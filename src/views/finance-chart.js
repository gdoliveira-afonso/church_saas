import { store } from '../store.js';
import { header, toast, bottomNav, openModal, closeModal } from '../components/ui.js';

export async function financeChartView() {
  const app = document.getElementById('app');

  if (!store.systemSettings?.financialEnabled) {
    app.innerHTML = `
    ${header('Plano de Contas', true)}
    <div class="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <span class="material-symbols-outlined text-5xl text-slate-300 mb-3">category</span>
      <p class="text-sm text-slate-400">Módulo financeiro desabilitado</p>
    </div>
    ${bottomNav('finance')}`;
    return;
  }

  const canManage = store.hasRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN');

  const render = () => {
    const chart = store.financeChartOfAccounts || [];

    app.innerHTML = `
    ${header('Plano de Contas', true)}
    <div class="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/30 pb-24">
      <div class="px-4 md:px-6 py-4">
        
        <div class="mb-6">
          <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100">Categorias</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Gerencie a estrutura de receitas e despesas da sua organização.</p>
        </div>

        <div class="space-y-6">
          <!-- Receitas -->
          <section>
            <div class="flex items-center gap-2 mb-3">
              <span class="w-2 h-6 bg-emerald-500 rounded-full"></span>
              <h4 class="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Receitas</h4>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
              ${renderTree(chart.filter(c => c.type === 'RECEITA'))}
            </div>
          </section>

          <!-- Despesas -->
          <section>
            <div class="flex items-center gap-2 mb-3">
              <span class="w-2 h-6 bg-red-500 rounded-full"></span>
              <h4 class="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Despesas</h4>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
              ${renderTree(chart.filter(c => c.type === 'DESPESA'))}
            </div>
          </section>
        </div>

      </div>
    </div>
    ${canManage ? `<button id="btn-float-add-cat" class="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition"><span class="material-symbols-outlined text-2xl">add</span></button>` : ''}
    ${bottomNav('finance')}`;

    // Event Listeners
    document.getElementById('btn-float-add-cat')?.addEventListener('click', () => openCategoryModal());
    
    document.querySelectorAll('.btn-edit-cat').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openCategoryModal(btn.dataset.id);
      };
    });

    document.querySelectorAll('.btn-toggle-cat').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        if (!confirm(`Deseja desativar a categoria "${name}"? Ela não aparecerá mais nos novos lançamentos.`)) return;
        try {
          await store.toggleFinanceChartCategory(id);
          toast('Status atualizado');
          render();
        } catch (err) {
          toast(err.message || 'Erro ao atualizar status', 'error');
        }
      };
    });

    document.querySelectorAll('.btn-add-sub').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openCategoryModal(null, btn.dataset.id, btn.dataset.type);
      };
    });
  };

  function renderTree(items, depth = 0) {
    if (!items || items.length === 0) {
      return depth === 0 ? `<div class="p-8 text-center text-slate-400 text-sm">Nenhuma categoria cadastrada</div>` : '';
    }

    return items.map(item => `
      <div class="group">
        <div class="flex items-center justify-between p-3 ${depth > 0 ? 'bg-slate-50/50 dark:bg-slate-900/20 border-l-2 border-slate-100 dark:border-slate-700 ml-4' : ''} hover:bg-slate-50 dark:hover:bg-slate-700/50 transition border-b border-slate-50 dark:border-slate-700/50 last:border-0">
          <div class="flex items-center gap-3">
            ${depth === 0 ? `<span class="material-symbols-outlined text-slate-400 text-lg">${item.type === 'RECEITA' ? 'trending_up' : 'trending_down'}</span>` : ''}
            <div>
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">
                ${item.code ? `<span class="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded mr-1 text-slate-500">${item.code}</span>` : ''}
                ${item.name}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            ${depth === 0 ? `
            <button class="btn-add-sub p-1.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" data-id="${item.id}" data-type="${item.type}" title="Adicionar Subcategoria">
              <span class="material-symbols-outlined text-[18px]">add_circle</span>
            </button>` : ''}
            <button class="btn-edit-cat p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400" data-id="${item.id}" title="Editar">
              <span class="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button class="btn-toggle-cat p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400" data-id="${item.id}" data-name="${item.name}" title="Desativar">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
        ${item.children?.length ? renderTree(item.children, depth + 1) : ''}
      </div>
    `).join('');
  }

  function openCategoryModal(catId = null, parentId = null, forceType = null) {
    const chart = store.financeChartOfAccounts || [];
    const allFlat = [];
    function flatten(items) {
      items.forEach(i => {
        allFlat.push(i);
        if (i.children) flatten(i.children);
      });
    }
    flatten(chart);

    const cat = catId ? allFlat.find(c => c.id === catId) : null;
    const type = forceType || cat?.type || 'RECEITA';

    openModal(`<div class="p-6 max-w-md w-full">
      <div class="flex justify-between items-center mb-5">
        <h3 class="text-base font-bold">${cat ? 'Editar' : 'Nova'} Categoria</h3>
        <button onclick="closeModal()" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400 text-xl">close</span></button>
      </div>
      <form id="cat-form" class="space-y-4">
        ${!parentId && !cat ? `
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Tipo <span class="text-red-500">*</span></label>
          <div class="flex gap-2">
            <label class="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 cursor-pointer has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 transition">
              <input type="radio" name="cat-type" value="RECEITA" ${type === 'RECEITA' ? 'checked' : ''} class="accent-emerald-600"/> <span class="text-sm font-medium text-emerald-700">Receita</span>
            </label>
            <label class="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 cursor-pointer has-[:checked]:border-red-400 has-[:checked]:bg-red-50 transition">
              <input type="radio" name="cat-type" value="DESPESA" ${type === 'DESPESA' ? 'checked' : ''} class="accent-red-500"/> <span class="text-sm font-medium text-red-600">Despesa</span>
            </label>
          </div>
        </div>` : `<input type="hidden" name="cat-type" value="${type}" />`}

        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Nome da Categoria <span class="text-red-500">*</span></label>
          <input id="cat-name" value="${cat?.name || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Ex: Oferta de Almas, Aluguel Sede..."/>
        </div>

        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Código (Opcional)</label>
          <input id="cat-code" value="${cat?.code || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono placeholder="Ex: 1.1.01"/>
        </div>

        ${!parentId && !cat ? `
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Subcategoria de (Opcional)</label>
          <select id="cat-parent" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="">Nenhuma (Categoria Principal)</option>
            ${chart.map(c => `<option value="${c.id}">${c.name} (${c.type})</option>`).join('')}
          </select>
        </div>` : ''}

        <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition mt-2">${cat ? 'Salvar Alterações' : 'Criar Categoria'}</button>
      </form>
    </div>`);

    document.getElementById('cat-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const orig = btn.innerHTML; btn.innerHTML = 'Salvando...'; btn.disabled = true;

      const name = document.getElementById('cat-name').value.trim();
      const code = document.getElementById('cat-code').value.trim();
      const catType = document.querySelector('input[name="cat-type"]')?.value || document.querySelector('input[name="cat-type"]:checked')?.value;
      const finalParentId = parentId || document.getElementById('cat-parent')?.value || null;

      if (!name) { toast('Nome é obrigatório', 'error'); btn.innerHTML = orig; btn.disabled = false; return; }

      try {
        if (cat) {
          await store.updateFinanceChartCategory(cat.id, { name, code });
          toast('Categoria atualizada!');
        } else {
          await store.addFinanceChartCategory({ name, code, type: catType, parentId: finalParentId });
          toast('Categoria criada!');
        }
        closeModal();
        render();
      } catch (err) {
        btn.innerHTML = orig; btn.disabled = false;
        toast(err.message || 'Erro ao salvar categoria', 'error');
      }
    };
  }

  // Initial load
  if (!store.financeChartOfAccounts || store.financeChartOfAccounts.length === 0) {
    app.innerHTML = `
    ${header('Plano de Contas', true)}
    <div class="flex-1 flex items-center justify-center py-20">
      <span class="material-symbols-outlined text-4xl text-slate-300 animate-spin">refresh</span>
    </div>`;
    try {
      await store.fetchFinanceChart();
    } catch (err) {
      toast('Erro ao carregar categorias', 'error');
    }
  }

  render();
}
