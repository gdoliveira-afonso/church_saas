import { store } from '../store.js';
import { header, bottomNav, avatar, toast, openModal, closeModal } from '../components/ui.js';

export function ebdView(params) {
  const app = document.getElementById('app');

  if (!store.systemSettings?.ebdEnabled) {
    app.innerHTML = `
    ${header('EBD', false)}
    <div class="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <span class="material-symbols-outlined text-3xl text-slate-400">menu_book</span>
      </div>
      <h2 class="text-lg font-bold text-slate-700 mb-2">Módulo EBD desabilitado</h2>
      <p class="text-sm text-slate-500 max-w-xs">O módulo de Escola Bíblica Dominical não está habilitado para esta organização. Contate o administrador para ativá-lo.</p>
      <a href="#/dashboard" class="mt-6 text-sm text-primary font-semibold hover:underline">Voltar ao Dashboard</a>
    </div>
    ${bottomNav('ebd')}`;
    return;
  }

  const canManage = store.hasRole('ADMIN', 'SUPERVISOR') || store.hasSecondaryRole('SUPERINTENDENTE_EBD');

  app.innerHTML = `
  ${header('EBD - Escola Bíblica Dominical', false)}
  <div class="bg-white px-4 md:px-6 py-3 border-b border-slate-100 flex gap-2">
    <div class="relative flex-1">
      <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
      <input id="search-ebd" class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Buscar classe por nome…"/>
    </div>
  </div>
  <div id="ebd-list" class="flex-1 overflow-y-auto px-4 md:px-6 py-4 bg-slate-50/30"></div>
  ${canManage ? `<button id="btn-float-add-ebd" class="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition"><span class="material-symbols-outlined text-2xl">add</span></button>` : ''}
  ${bottomNav('ebd')}`;

  const renderList = () => {
    const q = document.getElementById('search-ebd')?.value.toLowerCase() || '';
    let classes = store.ebdClasses || [];
    if (q) classes = classes.filter(c => c.name.toLowerCase().includes(q));

    const list = document.getElementById('ebd-list');
    if (!classes.length) {
      list.innerHTML = `<div class="flex flex-col items-center justify-center py-16">
        <span class="material-symbols-outlined text-5xl text-slate-200 mb-3">menu_book</span>
        <p class="text-sm text-slate-400">Nenhuma classe encontrada</p>
        ${canManage ? `<button id="btn-empty-add-ebd" class="mt-3 text-sm text-primary font-semibold">+ Criar primeira classe</button>` : ''}
      </div>`;
      document.getElementById('btn-empty-add-ebd')?.addEventListener('click', () => ebdClassForm());
      return;
    }

    list.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      ${classes.map(c => {
        const professor = c.professor || (c.professorId ? (store.users || []).find(u => u.id === c.professorId) : null);
        const totalAlunos = c._count?.students ?? c.studentCount ?? 0;
        const ativo = c.ativo !== false;
        return `<div class="bg-white rounded-xl p-4 border border-slate-100 hover:border-primary/30 hover:shadow-sm transition group cursor-pointer ebd-card" data-id="${c.id}">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <span class="material-symbols-outlined">menu_book</span>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-bold truncate">${c.name}</h3>
              <p class="text-[11px] text-slate-500">${c.faixaEtaria || 'Faixa etária não definida'}</p>
            </div>
            ${canManage ? `<button class="btn-edit-class w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition shrink-0" data-id="${c.id}"><span class="material-symbols-outlined text-[16px]">edit</span></button>` : '<span class="material-symbols-outlined text-slate-300 group-hover:text-primary text-lg">chevron_right</span>'}
          </div>
          <div class="flex flex-col text-[11px] text-slate-500 space-y-0.5">
            ${c.sala ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">meeting_room</span>Sala: ${c.sala}</span>` : ''}
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">person</span>Professor: ${professor?.name || 'Não definido'}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">group</span>Alunos: ${totalAlunos}</span>
          </div>
          <div class="mt-3 flex justify-between items-center">
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1 ring-inset ${ativo ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' : 'bg-slate-100 text-slate-500 ring-slate-500/10'}">${ativo ? 'Ativa' : 'Inativa'}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;

    document.querySelectorAll('.ebd-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-edit-class')) return;
        window.location.hash = `/ebd/class?id=${card.dataset.id}`;
      });
    });

    document.querySelectorAll('.btn-edit-class').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        ebdClassForm(btn.dataset.id);
      });
    });
  };

  renderList();
  document.getElementById('search-ebd').oninput = renderList;
  document.getElementById('btn-float-add-ebd')?.addEventListener('click', () => ebdClassForm());
}

function ebdClassForm(classId) {
  const c = classId ? (store.ebdClasses || []).find(x => x.id === classId) : null;
  const people = store.people || [];
  const users = store.users || [];

  openModal(`<div class="p-6">
    <div class="flex justify-between items-center mb-5">
      <h3 class="text-base font-bold">${c ? 'Editar' : 'Nova'} Classe EBD</h3>
      <button onclick="closeModal()" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400 text-xl">close</span></button>
    </div>
    <form id="ebd-class-form" class="space-y-3">
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Nome da Classe <span class="text-red-500">*</span></label>
        <input id="ecf-name" value="${c?.name || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Classe Jovens"/>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Faixa Etária</label>
          <input id="ecf-faixa" value="${c?.faixaEtaria || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: 15 a 30 anos"/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Sala</label>
          <input id="ecf-sala" value="${c?.sala || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Sala 3"/>
        </div>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Professor</label>
        <select id="ecf-professor" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Selecionar professor...</option>
          ${users.filter(u => {
            const sr = (Array.isArray(u.secondaryRoles) ? u.secondaryRoles : JSON.parse(u.secondaryRoles || '[]'));
            return sr.includes('PROFESSOR') || u.id === c?.professorId;
          }).map(p => `<option value="${p.id}" ${c?.professorId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
        <p class="text-[10px] text-slate-400 mt-0.5">Apenas usuários com a flag "Professor EBD" aparecem aqui.</p>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Segundo Professor (Opcional)</label>
        <select id="ecf-professor2" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Nenhum...</option>
          ${users.filter(u => {
            const sr = (Array.isArray(u.secondaryRoles) ? u.secondaryRoles : JSON.parse(u.secondaryRoles || '[]'));
            return sr.includes('SEGUNDO_PROFESSOR') || u.id === c?.segundoProfessorId;
          }).map(p => `<option value="${p.id}" ${c?.segundoProfessorId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
        <p class="text-[10px] text-slate-400 mt-0.5">Apenas usuários com a flag "Segundo Professor" aparecem aqui.</p>
      </div>
      ${c ? `<div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <input type="checkbox" id="ecf-ativo" ${c?.ativo !== false ? 'checked' : ''} class="w-4 h-4 rounded accent-primary"/>
        <label for="ecf-ativo" class="text-sm text-slate-700 font-medium cursor-pointer">Classe ativa</label>
      </div>` : ''}
      <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition mt-2">${c ? 'Salvar Alterações' : 'Criar Classe'}</button>
      ${c ? `<button type="button" id="btn-del-ebd-class" class="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg text-sm font-semibold hover:bg-red-100">Excluir Classe</button>` : ''}
    </form>
  </div>`);

  document.getElementById('ebd-class-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML; btn.innerHTML = 'Salvando...'; btn.disabled = true;

    const name = document.getElementById('ecf-name').value.trim();
    if (!name) { toast('Nome da classe é obrigatório', 'error'); btn.innerHTML = orig; btn.disabled = false; return; }

    const data = {
      name,
      faixaEtaria: document.getElementById('ecf-faixa').value.trim() || null,
      sala: document.getElementById('ecf-sala').value.trim() || null,
      professorId: document.getElementById('ecf-professor').value || null,
      segundoProfessorId: document.getElementById('ecf-professor2').value || null,
    };
    if (c) data.ativo = document.getElementById('ecf-ativo').checked;

    try {
      if (c) {
        await store.updateEbdClass(classId, data);
        toast('Classe atualizada!');
      } else {
        await store.addEbdClass(data);
        toast('Classe criada!');
      }
      closeModal();
      ebdView();
    } catch (err) {
      btn.innerHTML = orig; btn.disabled = false;
      toast(err.message || 'Erro ao salvar classe', 'error');
    }
  };

  document.getElementById('btn-del-ebd-class')?.addEventListener('click', async () => {
    if (!confirm('Excluir esta classe? Todos os alunos, chamadas e ofertas serão removidos.')) return;
    try {
      await store.apiFetch(`/ebd/classes/${classId}`, { method: 'DELETE' });
      store.ebdClasses = (store.ebdClasses || []).filter(x => x.id !== classId);
      toast('Classe excluída');
      closeModal();
      ebdView();
    } catch (err) {
      toast('Erro ao excluir classe', 'error');
    }
  });
}
