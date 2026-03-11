import { store } from '../store.js';
import { header, bottomNav, toast, openModal, closeModal } from '../components/ui.js';

export function generationsView() {
  const app = document.getElementById('app');
  app.innerHTML = `
  ${header('Gerações', false)}
  <div class="flex-1 overflow-y-auto px-4 md:px-6 py-4">
    ${(store.generations || []).length ? `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">${(store.generations || []).map(g => {
    const leaders = store.users.filter(u => u.generationId === g.id && u.role === 'LIDER_GERACAO');
    const cells = store.cells.filter(c => c.generationId === g.id);

    return `<div class="relative bg-white rounded-xl border border-slate-100 hover:border-primary/30 hover:shadow-sm transition group">
          <a href="#/cells?generationId=${g.id}" class="block p-4">
            <div class="flex gap-3 mb-3">
              <div class="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0"><span class="material-symbols-outlined text-xl">groups</span></div>
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-bold text-slate-800 truncate pr-16">${g.name}</h3>
                <p class="text-[11px] text-slate-500 mt-0.5 line-clamp-2">${g.description || 'Sem descrição'}</p>
              </div>
            </div>
            <div class="flex justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-50 mt-1">
              <span class="flex items-center gap-1 font-medium"><span class="material-symbols-outlined text-[14px]">person</span> ${leaders.length} líder(es)</span>
              <span class="flex items-center gap-1 font-medium"><span class="material-symbols-outlined text-[14px]">diversity_3</span> ${cells.length} célula(s)</span>
            </div>
          </a>
          <div class="absolute top-3 right-3 flex items-center gap-1">
             <button class="btn-edit-gen w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition" data-id="${g.id}"><span class="material-symbols-outlined text-[18px]">edit</span></button>
             <button class="btn-del-gen w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition" data-id="${g.id}"><span class="material-symbols-outlined text-[18px]">delete</span></button>
          </div>
        </div>`}).join('')}</div>` :
      `<div class="flex flex-col items-center justify-center py-16">
         <span class="material-symbols-outlined text-5xl text-slate-200 mb-3">category</span>
         <p class="text-sm text-slate-400">Nenhuma geração encontrada</p>
         <button id="btn-empty-add-gen" class="mt-3 text-sm text-primary font-semibold">+ Criar primeira geração</button>
       </div>`
    }
  </div>
  <button id="btn-float-add-gen" class="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition"><span class="material-symbols-outlined text-2xl">add</span></button>
  ${bottomNav('generations')} `;

  document.getElementById('btn-empty-add-gen')?.addEventListener('click', () => generationModal());
  document.getElementById('btn-float-add-gen')?.addEventListener('click', () => generationModal());
  document.querySelectorAll('.btn-edit-gen').forEach(b => b.addEventListener('click', () => generationModal(b.dataset.id)));
  document.querySelectorAll('.btn-del-gen').forEach(b => b.addEventListener('click', () => deleteGenerationConfirm(b.dataset.id)));
}

function generationModal(id) {
  const g = id ? store.generations.find(x => x.id === id) : null;
  openModal(`<div class="p-6">
    <div class="flex justify-between items-center mb-5">
      <h3 class="text-base font-bold">${g ? 'Editar' : 'Nova'} Geração</h3>
      <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button>
    </div>
    <form id="gen-form" class="space-y-4">
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Nome da Geração</label>
        <input id="gf-name" placeholder="Ex: Jovens, Adolescentes..." value="${g?.name || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" required/>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Descrição (Opcional)</label>
        <textarea id="gf-desc" placeholder="Detalhes sobre a geração" rows="2" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none">${g?.description || ''}</textarea>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Atribuir um Líder de Geração</label>
        <select id="gf-leader" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Nenhum / Não alterar</option>
            ${store.users.filter(u => u.role !== 'ADMIN' && u.role !== 'SUPERVISOR').map(u => {
    const isSelected = g && u.generationId === g.id && u.role === 'LIDER_GERACAO';
    return `<option value="${u.id}" ${isSelected ? 'selected' : ''}>${u.name} (@${u.username})</option>`;
  }).join('')}
        </select>
        <p class="text-[10px] text-slate-400 mt-1">O usuário selecionado se tornará um Líder de Geração atrelado a essa geração.</p>
      </div>
      <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition mt-2 flex justify-center items-center gap-2">
         ${g ? 'Salvar Alterações' : 'Criar Geração'}
      </button>
    </form>
  </div>`);

  document.getElementById('gen-form').onsubmit = async ev => {
    ev.preventDefault();
    const btn = ev.target.querySelector('button[type="submit"]');
    const origText = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">refresh</span> Salvando...';
    btn.disabled = true;

    const leaderId = document.getElementById('gf-leader').value;

    const payload = {
      name: document.getElementById('gf-name').value.trim(),
      description: document.getElementById('gf-desc').value.trim()
    };
    if (leaderId) payload.leaderId = leaderId;

    try {
      if (g) {
        await store.updateGeneration(id, payload);
        toast('Geração atualizada com sucesso!');
      } else {
        await store.addGeneration(payload);
        toast('Geração criada!');
      }
      closeModal();
      generationsView();
    } catch (err) {
      toast('Erro ao salvar Geração. Verifique a conexão.', 'error');
      btn.innerHTML = origText;
      btn.disabled = false;
    }
  };
}

function deleteGenerationConfirm(id) {
  const g = store.generations.find(x => x.id === id);
  if (!g) return;

  openModal(`<div class="p-6 text-center">
        <div class="w-14 h-14 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
            <span class="material-symbols-outlined text-red-600 text-3xl">warning</span>
        </div>
        <h3 class="text-lg font-bold mb-1">Excluir Geração</h3>
        <p class="text-sm text-slate-500">${g.name}</p>
        <p class="text-xs text-red-400 mb-5 mt-2 font-medium">As células e usuários vinculados a esta geração ficarão sem geração. Tem certeza?</p>
        <div class="flex gap-3">
            <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="flex-1 py-2.5 rounded-lg bg-slate-100 text-sm font-semibold hover:bg-slate-200">Cancelar</button>
            <button id="btn-confirm-del-gen" class="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex justify-center items-center gap-1.5">Excluir</button>
        </div>
    </div>`);

  document.getElementById('btn-confirm-del-gen').onclick = async function () {
    this.innerHTML = '<span class="material-symbols-outlined animate-spin text-[16px]">refresh</span> Excluindo...';
    this.disabled = true;
    try {
      await store.deleteGeneration(id);
      closeModal();
      toast('Geração excluída com sucesso!');
      generationsView();
    } catch (err) {
      toast('Erro ao excluir a geração.', 'error');
      this.innerHTML = 'Excluir';
      this.disabled = false;
    }
  };
}
