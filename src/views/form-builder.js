import { store } from '../store.js';
import { header, toast, badge, openModal, closeModal } from '../components/ui.js';

const FIELD_TYPES = [
  { value: 'text', label: 'Texto', icon: 'text_fields' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'phone', label: 'Telefone', icon: 'call' },
  { value: 'date', label: 'Data', icon: 'calendar_today' },
  { value: 'number', label: 'Número', icon: 'pin' },
  { value: 'select', label: 'Seleção', icon: 'list' },
  { value: 'textarea', label: 'Texto Longo', icon: 'notes' },
  { value: 'checkbox', label: 'Caixa de Seleção', icon: 'check_box' },
  { value: 'link', label: 'Link', icon: 'link' },
];

// ── Form List ──
export function formListView() {
  const app = document.getElementById('app');
  app.innerHTML = `
  ${header('Formulários', true, `<button id="btn-new-form" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition active:scale-95"><span class="material-symbols-outlined text-[16px]">add</span>Novo</button>`)}
  <div class="flex-1 overflow-y-auto px-4 md:px-6 lg:px-10 py-4 space-y-3 max-w-5xl mx-auto w-full">
    ${store.forms.length ? store.forms.map(f => `
    <div class="bg-white rounded-xl border border-slate-100 hover:border-primary/30 transition group">
      <div class="flex items-center gap-3 p-4">
        <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><span class="material-symbols-outlined">description</span></div>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-bold truncate">${f.name}</h3>
          <div class="flex items-center gap-2 mt-0.5">
            ${badge(f.status === 'ativo' ? 'Ativo' : 'Inativo', f.status === 'ativo' ? 'green' : 'slate')}
            <span class="text-[11px] text-slate-400">${f.fields.length} campos</span>
          </div>
        </div>
        <div class="flex gap-1">
          <a href="#/form-builder?id=${f.id}" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition"><span class="material-symbols-outlined text-[18px]">edit</span></a>
          <button class="btn-dup w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition" data-id="${f.id}"><span class="material-symbols-outlined text-[18px]">content_copy</span></button>
          <button class="btn-del w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition" data-id="${f.id}"><span class="material-symbols-outlined text-[18px]">delete</span></button>
        </div>
      </div>
      <div class="px-4 pb-3 flex flex-wrap gap-1.5">
        ${f.fields.map(fl => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-[10px] font-medium text-slate-500"><span class="material-symbols-outlined text-[12px]">${FIELD_TYPES.find(t => t.value === fl.type)?.icon || 'text_fields'}</span>${fl.name}</span>`).join('')}
      </div>
    </div>`).join('') : `
    <div class="flex flex-col items-center justify-center py-16">
      <span class="material-symbols-outlined text-5xl text-slate-200 mb-3">description</span>
      <p class="text-sm text-slate-400">Nenhum formulário criado</p>
      <button onclick="document.getElementById('btn-new-form').click()" class="mt-3 text-sm text-primary font-semibold">+ Criar primeiro formulário</button>
    </div>`}
  </div>`;

  document.getElementById('btn-new-form').onclick = () => {
    openModal(`<div class="p-6">
      <div class="flex justify-between items-center mb-5">
        <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined text-lg">note_add</span></div><h3 class="text-base font-bold">Novo Formulário</h3></div>
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button>
      </div>
      <form id="new-form-form" class="space-y-4">
        <div><label class="text-xs font-semibold text-slate-600 mb-1 block">Nome do Formulário</label><input id="nf-name" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Ficha de Visitante" autofocus/></div>
        <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition">Criar Formulário</button>
      </form>
    </div>`);
    document.getElementById('new-form-form').onsubmit = async e => {
      e.preventDefault();
      const name = document.getElementById('nf-name').value.trim();
      if (!name) { toast('Nome obrigatório', 'error'); return; }
      const f = await store.addForm({ name, status: 'ativo', fields: [] });
      closeModal();
      location.hash = '/form-builder?id=' + f.id;
    };
  };
  document.querySelectorAll('.btn-dup').forEach(b => b.onclick = async () => {
    const orig = store.forms.find(f => f.id === b.dataset.id); if (!orig) return;
    const dup = { name: orig.name + ' (cópia)', status: 'ativo', fields: JSON.parse(JSON.stringify(orig.fields)) };
    await store.addForm(dup); toast('Formulário duplicado!'); formListView();
  });
  document.querySelectorAll('.btn-del').forEach(b => b.onclick = () => {
    const f = store.forms.find(x => x.id === b.dataset.id); if (!f) return;
    openModal(`<div class="p-6 text-center">
      <div class="w-14 h-14 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center"><span class="material-symbols-outlined text-red-600 text-3xl">delete_forever</span></div>
      <h3 class="text-lg font-bold mb-1">Excluir Formulário</h3>
      <p class="text-sm text-slate-500 mb-5">"${f.name}" será excluído permanentemente.</p>
      <div class="flex gap-3">
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="flex-1 py-2.5 rounded-lg bg-slate-100 text-sm font-semibold hover:bg-slate-200 transition">Cancelar</button>
        <button id="btn-confirm-del-form" class="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Excluir</button>
      </div>
    </div>`);
    document.getElementById('btn-confirm-del-form').onclick = async () => {
      await store.deleteForm(b.dataset.id);
      closeModal(); toast('Formulário excluído'); formListView();
    };
  });
}

// ── Form Builder ──
export function formBuilderView(params) {
  const app = document.getElementById('app');
  const formId = params?.id;
  const form = store.forms.find(f => f.id === formId);
  if (!form) { app.innerHTML = '<div class="flex-1 flex items-center justify-center text-slate-400">Formulário não encontrado</div>'; return; }

  // Shared drag state
  let dragData = null;

  function render() {
    app.innerHTML = `
    <header class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shrink-0 pt-[env(safe-area-inset-top)] transition-colors duration-300">
      <div class="flex items-center px-4 md:px-6 h-14 gap-3">
        <button onclick="history.back()" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-xl">arrow_back</span></button>
        <div class="flex-1 min-w-0"><input id="form-name" value="${form.name}" class="text-base font-bold bg-transparent border-none outline-none w-full truncate focus:bg-slate-50 focus:px-2 rounded transition"/></div>
        <div class="flex items-center gap-2">
          <button id="btn-toggle-status" class="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${form.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}" title="Apenas formulários Ativos podem receber novas respostas">${form.status === 'ativo' ? 'Status: Ativo' : 'Status: Inativo'}</button>
          <button id="btn-toggle-login" class="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${form.showOnLogin ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}" title="Se 'Apenas via Link', ele fica Oculto da tela inicial de Login.">${form.showOnLogin ? 'Exibir no Login' : 'Apenas via Link'}</button>
          <button id="btn-form-settings" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition" title="Configurações"><span class="material-symbols-outlined text-lg">tune</span></button>
          <button id="btn-preview" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition" title="Preview"><span class="material-symbols-outlined text-lg">visibility</span></button>
          <button id="btn-copy-link" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition" title="Copiar Link Público"><span class="material-symbols-outlined text-lg">link</span></button>
        </div>
      </div>
    </header>
    <div class="flex-1 overflow-y-auto">
      <div class="flex flex-col md:flex-row">
        <!-- Palette -->
        <div class="md:w-[240px] bg-slate-50 md:border-r border-b md:border-b-0 border-slate-100 p-3 md:p-4 shrink-0 md:sticky md:top-[calc(3.5rem+env(safe-area-inset-top))] md:h-[calc(100vh-(3.5rem+env(safe-area-inset-top)))] md:overflow-y-auto">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Campos Disponíveis</p>
          <p class="text-[10px] text-slate-300 mb-2">Clique ou arraste para adicionar</p>
          <div class="grid grid-cols-4 md:grid-cols-2 gap-1.5" id="palette">
            ${FIELD_TYPES.map(t => `
            <div class="palette-item flex flex-col items-center gap-0.5 p-2 md:p-2.5 rounded-lg border border-dashed border-slate-200 bg-white text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition cursor-grab active:cursor-grabbing text-[10px] md:text-xs font-medium select-none" data-type="${t.value}" draggable="true">
              <span class="material-symbols-outlined text-base md:text-lg pointer-events-none">${t.icon}</span><span class="pointer-events-none">${t.label}</span>
            </div>`).join('')}
          </div>
        </div>
        <!-- Canvas -->
        <div class="flex-1 p-4 md:p-6 max-w-4xl">
          <div id="canvas" class="min-h-[300px] rounded-xl transition-all">
            ${form.fields.length ? `<div id="field-list" class="space-y-2">${form.fields.map((f, i) => fieldCard(f, i, form.fields.length)).join('')}</div>` : ''}
            <div id="drop-zone" class="border-2 border-dashed ${form.fields.length ? 'border-slate-100 mt-3' : 'border-slate-200'} rounded-xl p-${form.fields.length ? '4' : '10'} text-center transition hover:border-primary/40">
              <span class="material-symbols-outlined text-${form.fields.length ? '2xl' : '4xl'} text-slate-200 mb-1">drag_indicator</span>
              <p class="text-sm text-slate-400">${form.fields.length ? 'Arraste mais campos aqui' : 'Arraste campos aqui ou clique nos botões ao lado'}</p>
              ${!form.fields.length ? '<p class="text-[11px] text-slate-300 mt-1">Os campos aparecerão no formulário público</p>' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>`;

    bindAll();
  }

  function fieldCard(f, idx, total) {
    const ft = FIELD_TYPES.find(t => t.value === f.type) || FIELD_TYPES[0];
    return `
    <div class="field-item group relative bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition" data-idx="${idx}" draggable="true">
      <div class="flex items-center gap-2 p-3">
        <div class="drag-handle flex items-center justify-center w-6 h-8 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0"><span class="material-symbols-outlined text-lg pointer-events-none">drag_indicator</span></div>
        <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"><span class="material-symbols-outlined text-base">${ft.icon}</span></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold truncate">${f.name}</p>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-[10px] text-slate-400">${ft.label}</span>
            ${f.required ? '<span class="text-[9px] font-bold text-red-500">OBRIGATÓRIO</span>' : ''}
            ${f.type === 'select' && f.options ? `<span class="text-[10px] text-slate-300">${f.options.length} opções</span>` : ''}
            ${f.type === 'checkbox' && f.checkItems ? `<span class="text-[10px] text-slate-300">${f.checkItems.length} caixas</span>` : ''}
          </div>
        </div>
        <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
          ${idx > 0 ? `<button class="btn-up w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100" data-idx="${idx}"><span class="material-symbols-outlined text-[16px]">arrow_upward</span></button>` : ''}
          ${idx < total - 1 ? `<button class="btn-down w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100" data-idx="${idx}"><span class="material-symbols-outlined text-[16px]">arrow_downward</span></button>` : ''}
          <button class="btn-edit-field w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:text-primary hover:bg-primary/10" data-idx="${idx}"><span class="material-symbols-outlined text-[16px]">edit</span></button>
          <button class="btn-del-field w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50" data-idx="${idx}"><span class="material-symbols-outlined text-[16px]">close</span></button>
        </div>
      </div>
    </div>`;
  }

  function bindAll() {
    // Name
    const nameInput = document.getElementById('form-name');
    nameInput?.addEventListener('change', () => { form.name = nameInput.value.trim() || form.name; store.updateForm(form.id, form); });

    // Status toggle
    document.getElementById('btn-toggle-status')?.addEventListener('click', () => {
      form.status = form.status === 'ativo' ? 'inativo' : 'ativo'; store.updateForm(form.id, form); render();
    });

    // Login toggle
    document.getElementById('btn-toggle-login')?.addEventListener('click', () => {
      form.showOnLogin = !form.showOnLogin; store.updateForm(form.id, form); render();
    });

    // Form settings modal
    document.getElementById('btn-form-settings')?.addEventListener('click', () => {
      const icons = ['favorite', 'handshake', 'waving_hand', 'volunteer_activism', 'description', 'church', 'group', 'school', 'celebration', 'local_hospital'];
      const colors = [{ v: 'emerald', l: 'Verde' }, { v: 'purple', l: 'Roxo' }, { v: 'blue', l: 'Azul' }, { v: 'orange', l: 'Laranja' }, { v: 'red', l: 'Vermelho' }];
      openModal(`<div class="p-6 max-h-[85vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-5">
          <h3 class="text-base font-bold">Configurações do Formulário</h3>
          <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button>
        </div>
        <form id="form-settings" class="space-y-4">
          <div>
            <label class="text-xs font-semibold text-slate-600 mb-1.5 block">Subtítulo</label>
            <input id="fs-subtitle" value="${form.subtitle || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Descrição curta"/>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-600 mb-1.5 block">Tipo de cadastro ao enviar</label>
            <select id="fs-status" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
              <option value="" ${!form.personStatus ? 'selected' : ''}>— Não criar pessoa (apenas triagem)</option>
              <option value="Novo Convertido" ${form.personStatus === 'Novo Convertido' ? 'selected' : ''}>Novo Convertido</option>
              <option value="Reconciliação" ${form.personStatus === 'Reconciliação' ? 'selected' : ''}>Reconciliação</option>
            </select>
            <p class="text-[10px] text-slate-400 mt-1">Todas as respostas vão para a Triagem. Se selecionado, também cria uma pessoa com este status.</p>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-600 mb-1.5 block">Ícone</label>
            <div class="flex flex-wrap gap-1.5" id="fs-icons">${icons.map(ic => `<button type="button" class="fs-icon w-9 h-9 rounded-lg border flex items-center justify-center transition ${form.icon === ic ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-400 hover:border-primary/50 hover:text-primary'}" data-icon="${ic}"><span class="material-symbols-outlined text-lg">${ic}</span></button>`).join('')}</div>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-600 mb-1.5 block">Cor</label>
            <div class="flex gap-2" id="fs-colors">${colors.map(c => `<button type="button" class="fs-color px-3 py-1.5 rounded-full text-xs font-semibold border transition ${form.color === c.v ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-500 hover:border-primary/50'}" data-color="${c.v}">${c.l}</button>`).join('')}</div>
          </div>
          <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition">Salvar</button>
        </form>
      </div>`);

      let selIcon = form.icon || 'description';
      let selColor = form.color || 'blue';
      document.querySelectorAll('.fs-icon').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.fs-icon').forEach(x => { x.className = 'fs-icon w-9 h-9 rounded-lg border flex items-center justify-center transition border-slate-200 text-slate-400 hover:border-primary/50 hover:text-primary'; });
        b.className = 'fs-icon w-9 h-9 rounded-lg border flex items-center justify-center transition border-primary bg-primary/10 text-primary';
        selIcon = b.dataset.icon;
      }));
      document.querySelectorAll('.fs-color').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.fs-color').forEach(x => { x.className = 'fs-color px-3 py-1.5 rounded-full text-xs font-semibold border transition border-slate-200 text-slate-500 hover:border-primary/50'; });
        b.className = 'fs-color px-3 py-1.5 rounded-full text-xs font-semibold border transition border-primary bg-primary/10 text-primary';
        selColor = b.dataset.color;
      }));
      document.getElementById('form-settings').onsubmit = e => {
        e.preventDefault();
        form.subtitle = document.getElementById('fs-subtitle').value.trim();
        form.personStatus = document.getElementById('fs-status').value.trim() || null;
        form.icon = selIcon;
        form.color = selColor;
        store.updateForm(form.id, form); closeModal(); render(); toast('Configurações salvas!');
      };
    });

    // Preview and Copy Link
    document.getElementById('btn-preview')?.addEventListener('click', () => showPreview());
    document.getElementById('btn-copy-link')?.addEventListener('click', () => {
      const url = window.location.origin + window.location.pathname + '#/f?id=' + form.id;
      navigator.clipboard.writeText(url).then(() => {
        toast('Link público copiado!');
      }).catch(() => toast('Erro ao copiar link', 'error'));
    });

    // Palette click (fallback — always works)
    document.querySelectorAll('.palette-item').forEach(b => {
      b.addEventListener('click', () => addFieldModal(b.dataset.type));
    });

    // Up/Down arrows
    document.querySelectorAll('.btn-up').forEach(b => b.onclick = () => {
      const i = +b.dataset.idx;[form.fields[i - 1], form.fields[i]] = [form.fields[i], form.fields[i - 1]]; store.updateForm(form.id, form); render();
    });
    document.querySelectorAll('.btn-down').forEach(b => b.onclick = () => {
      const i = +b.dataset.idx;[form.fields[i], form.fields[i + 1]] = [form.fields[i + 1], form.fields[i]]; store.updateForm(form.id, form); render();
    });

    // Edit / Delete
    document.querySelectorAll('.btn-edit-field').forEach(b => b.onclick = () => editFieldModal(+b.dataset.idx));
    document.querySelectorAll('.btn-del-field').forEach(b => b.onclick = () => { form.fields.splice(+b.dataset.idx, 1); store.updateForm(form.id, form); render(); toast('Campo removido'); });

    // ══════ DRAG & DROP ══════
    const canvas = document.getElementById('canvas');
    const fieldList = document.getElementById('field-list');
    const dropZone = document.getElementById('drop-zone');

    // Palette drag start
    document.querySelectorAll('.palette-item').forEach(el => {
      el.addEventListener('dragstart', e => {
        dragData = { action: 'new', type: el.dataset.type };
        e.dataTransfer.setData('text/plain', 'new');
        e.dataTransfer.effectAllowed = 'copy';
        requestAnimationFrame(() => {
          canvas.classList.add('ring-2', 'ring-primary/30', 'ring-inset');
          dropZone.classList.add('border-primary/40', 'bg-primary/5');
        });
      });
      el.addEventListener('dragend', () => {
        dragData = null;
        canvas.classList.remove('ring-2', 'ring-primary/30', 'ring-inset');
        dropZone.classList.remove('border-primary/40', 'bg-primary/5', 'border-primary', 'scale-[1.02]');
        document.querySelectorAll('.drop-indicator').forEach(x => x.remove());
      });
    });

    // Field items drag start
    document.querySelectorAll('.field-item').forEach(el => {
      el.addEventListener('dragstart', e => {
        dragData = { action: 'move', fromIdx: parseInt(el.dataset.idx) };
        e.dataTransfer.setData('text/plain', 'move');
        e.dataTransfer.effectAllowed = 'move';
        requestAnimationFrame(() => {
          el.classList.add('opacity-30', 'scale-95');
          canvas.classList.add('ring-2', 'ring-primary/30', 'ring-inset');
        });
      });
      el.addEventListener('dragend', () => {
        dragData = null;
        el.classList.remove('opacity-30', 'scale-95');
        canvas.classList.remove('ring-2', 'ring-primary/30', 'ring-inset');
        document.querySelectorAll('.drop-indicator').forEach(x => x.remove());
      });
    });

    // ── Drop on field list (reorder / insert between fields) ──
    if (fieldList) {
      fieldList.addEventListener('dragover', e => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = dragData?.action === 'new' ? 'copy' : 'move';

        // Remove old indicators
        document.querySelectorAll('.drop-indicator').forEach(x => x.remove());

        // Find insert position and show indicator
        const items = [...fieldList.querySelectorAll('.field-item')];
        let insertBefore = null;
        for (const item of items) {
          const rect = item.getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) { insertBefore = item; break; }
        }

        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator h-1 bg-primary rounded-full mx-4 my-1 pointer-events-none shadow-sm shadow-primary/30';
        if (insertBefore) fieldList.insertBefore(indicator, insertBefore);
        else fieldList.appendChild(indicator);
      });

      fieldList.addEventListener('dragleave', e => {
        if (!fieldList.contains(e.relatedTarget)) {
          document.querySelectorAll('.drop-indicator').forEach(x => x.remove());
        }
      });

      fieldList.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.drop-indicator').forEach(x => x.remove());
        if (!dragData) return;

        const items = [...fieldList.querySelectorAll('.field-item')];
        let toIdx = items.length;
        for (let i = 0; i < items.length; i++) {
          const rect = items[i].getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) { toIdx = i; break; }
        }

        if (dragData.action === 'new') {
          const ft = FIELD_TYPES.find(t => t.value === dragData.type) || FIELD_TYPES[0];
          const field = { name: ft.label, type: dragData.type, required: false };
          if (dragData.type === 'select') field.options = ['Opção 1', 'Opção 2'];
          form.fields.splice(toIdx, 0, field);
          store.updateForm(form.id, form); dragData = null; render(); toast(`"${ft.label}" adicionado!`);
        } else if (dragData.action === 'move') {
          const fromIdx = dragData.fromIdx;
          if (fromIdx !== toIdx) {
            const [moved] = form.fields.splice(fromIdx, 1);
            form.fields.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, moved);
            store.updateForm(form.id, form); dragData = null; render();
          }
        }
      });
    }

    // ── Drop on the bottom drop zone (add to end) ──
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add('border-primary', 'bg-primary/5', 'scale-[1.02]');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-primary', 'bg-primary/5', 'scale-[1.02]');
    });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-primary', 'bg-primary/5', 'scale-[1.02]');
      if (!dragData) return;
      if (dragData.action === 'new') {
        const ft = FIELD_TYPES.find(t => t.value === dragData.type) || FIELD_TYPES[0];
        const field = { name: ft.label, type: dragData.type, required: false };
        if (dragData.type === 'select') field.options = ['Opção 1', 'Opção 2'];
        form.fields.push(field);
        store.updateForm(form.id, form); dragData = null; render(); toast(`"${ft.label}" adicionado!`);
      } else if (dragData.action === 'move') {
        const fromIdx = dragData.fromIdx;
        const [moved] = form.fields.splice(fromIdx, 1);
        form.fields.push(moved);
        store.updateForm(form.id, form); dragData = null; render();
      }
    });
  }

  function fieldModal(editIdx) {
    const isEdit = editIdx !== undefined && editIdx !== null;
    const existing = isEdit ? form.fields[editIdx] : null;
    const initType = existing?.type || 'text';
    const initName = existing?.name || '';
    const initReq = existing?.required || false;
    const initPlaceholder = existing?.placeholder || '';
    const initOptions = existing?.options ? [...existing.options] : ['Opção 1', 'Opção 2'];
    const initLabel = existing?.checkLabel || existing?.name || '';
    const initCheckItems = existing?.checkItems ? [...existing.checkItems] : ['Caixa 1'];
    let currentOptions = [...initOptions];
    let currentCheckItems = [...initCheckItems];

    openModal(`<div class="p-5 md:p-6 max-h-[85vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-base font-bold">${isEdit ? 'Editar Campo' : 'Novo Campo'}</h3>
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button>
      </div>
      <form id="fm-form" class="space-y-4">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1.5 block">Nome do Campo</label>
          <input id="fm-name" value="${initName}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" placeholder="Ex: Nome Completo" autofocus/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1.5 block">Tipo do Campo</label>
          <div class="grid grid-cols-4 gap-1.5" id="fm-type-grid">
            ${FIELD_TYPES.map(t => `<button type="button" class="fm-type-btn flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] font-medium transition ${t.value === initType ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30' : 'border-slate-200 bg-white text-slate-500 hover:border-primary/50 hover:text-primary'}" data-type="${t.value}">
              <span class="material-symbols-outlined text-base">${t.icon}</span>${t.label}
            </button>`).join('')}
          </div>
          <input type="hidden" id="fm-type" value="${initType}"/>
        </div>
        <div id="fm-config" class="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-3"></div>
        <div class="space-y-2" id="fm-main-checks">
          <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition">
            <input type="checkbox" id="fm-req" ${initReq ? 'checked' : ''} class="accent-primary w-4 h-4"/>
            <div><p class="text-sm font-semibold">Obrigatório</p><p class="text-[11px] text-slate-400">O usuário deve preencher este campo</p></div>
          </label>
          <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition">
            <input type="checkbox" id="fm-extra" ${existing?.isExtra ? 'checked' : ''} class="accent-primary w-4 h-4"/>
            <div>
              <p class="text-sm font-semibold">Informação Adicional</p>
              <p class="text-[11px] text-slate-400">Salva na aba "Adicional" do perfil da pessoa</p>
            </div>
          </label>
        </div>
        <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 active:scale-[.98] transition-all">${isEdit ? 'Salvar Alterações' : 'Adicionar Campo'}</button>
      </form>
    </div>`);

    const typeInput = document.getElementById('fm-type');
    const configPanel = document.getElementById('fm-config');

    document.querySelectorAll('.fm-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fm-type-btn').forEach(b => {
          b.className = 'fm-type-btn flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] font-medium transition border-slate-200 bg-white text-slate-500 hover:border-primary/50 hover:text-primary';
        });
        btn.className = 'fm-type-btn flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] font-medium transition border-primary bg-primary/10 text-primary ring-1 ring-primary/30';
        typeInput.value = btn.dataset.type;
        updateConfig();
      });
    });

    function optionRow(text, idx) {
      return '<div class="flex items-center gap-1.5" data-idx="' + idx + '">' +
        '<span class="material-symbols-outlined text-slate-300 text-sm">drag_indicator</span>' +
        '<input class="opt-input flex-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-sm outline-none focus:ring-1 focus:ring-primary/20" value="' + text + '" data-idx="' + idx + '"/>' +
        '<button type="button" class="opt-del w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition" data-idx="' + idx + '"><span class="material-symbols-outlined text-sm" style="pointer-events:none">close</span></button>' +
        '</div>';
    }

    function updateConfig() {
      const type = typeInput.value;
      let html = '';
      if (type === 'text' || type === 'email' || type === 'phone' || type === 'number') {
        const ph = document.getElementById('fm-placeholder')?.value || initPlaceholder;
        html = '<div><label class="text-xs font-semibold text-slate-600 mb-1 block">Placeholder</label><input id="fm-placeholder" value="' + ph + '" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Texto de exemplo..."/></div>';
      } else if (type === 'link') {
        const ph = document.getElementById('fm-placeholder')?.value || initPlaceholder;
        html = '<div><label class="text-xs font-semibold text-slate-600 mb-1 block">URL de Redirecionamento</label><input id="fm-placeholder" value="' + ph + '" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="https://..."/></div>';
      } else if (type === 'select') {
        html = '<div><label class="text-xs font-semibold text-slate-600 mb-1.5 block">Opções de Seleção</label>' +
          '<div id="fm-opts-list" class="space-y-1.5 mb-2">' + currentOptions.map((o, i) => optionRow(o, i)).join('') + '</div>' +
          '<button type="button" id="fm-add-opt" class="flex items-center gap-1.5 text-primary text-xs font-semibold hover:bg-primary/10 px-2 py-1.5 rounded-md transition"><span class="material-symbols-outlined text-sm">add_circle</span>Adicionar opção</button></div>';
      } else if (type === 'checkbox') {
        html = '<div><label class="text-xs font-semibold text-slate-600 mb-1.5 block">Itens da Caixa de Seleção</label>' +
          '<div id="fm-chk-list" class="space-y-1.5 mb-2">' + currentCheckItems.map((o, i) => '<div class="flex items-center gap-1.5" data-cidx="' + i + '">' +
            '<span class="material-symbols-outlined text-slate-300 text-sm">check_box</span>' +
            '<input class="chk-input flex-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-sm outline-none focus:ring-1 focus:ring-primary/20" value="' + o + '" data-cidx="' + i + '"/>' +
            '<button type="button" class="chk-del w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition" data-cidx="' + i + '"><span class="material-symbols-outlined text-sm" style="pointer-events:none">close</span></button>' +
            '</div>').join('') + '</div>' +
          '<button type="button" id="fm-add-chk" class="flex items-center gap-1.5 text-primary text-xs font-semibold hover:bg-primary/10 px-2 py-1.5 rounded-md transition"><span class="material-symbols-outlined text-sm">add_circle</span>Adicionar caixa</button></div>';
      } else if (type === 'textarea') {
        const ph = document.getElementById('fm-placeholder')?.value || initPlaceholder;
        html = '<div><label class="text-xs font-semibold text-slate-600 mb-1 block">Placeholder</label><input id="fm-placeholder" value="' + ph + '" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none" placeholder="Texto de exemplo..."/></div>';
      } else if (type === 'date') {
        html = '<p class="text-xs text-slate-400 flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">info</span>O navegador mostrará um seletor de data.</p>';
      }
      configPanel.innerHTML = html || '<p class="text-xs text-slate-400">Nenhuma configuração extra.</p>';
      configPanel.style.display = html ? '' : 'none';

      const mainChecks = document.getElementById('fm-main-checks');
      if (mainChecks) mainChecks.style.display = type === 'link' ? 'none' : '';

      if (type === 'select') {
        document.querySelectorAll('.opt-input').forEach(inp => inp.addEventListener('input', () => { currentOptions[+inp.dataset.idx] = inp.value; }));
        document.querySelectorAll('.opt-del').forEach(btn => btn.addEventListener('click', () => { if (currentOptions.length <= 1) { toast('Mínimo 1 opção', 'warning'); return; } currentOptions.splice(+btn.dataset.idx, 1); updateConfig(); }));
        document.getElementById('fm-add-opt')?.addEventListener('click', () => { currentOptions.push('Opção ' + (currentOptions.length + 1)); updateConfig(); });
      }
      if (type === 'checkbox') {
        document.querySelectorAll('.chk-input').forEach(inp => inp.addEventListener('input', () => { currentCheckItems[+inp.dataset.cidx] = inp.value; }));
        document.querySelectorAll('.chk-del').forEach(btn => btn.addEventListener('click', () => { if (currentCheckItems.length <= 1) { toast('Mínimo 1 caixa', 'warning'); return; } currentCheckItems.splice(+btn.dataset.cidx, 1); updateConfig(); }));
        document.getElementById('fm-add-chk')?.addEventListener('click', () => { currentCheckItems.push('Caixa ' + (currentCheckItems.length + 1)); updateConfig(); });
      }
      document.getElementById('fm-placeholder')?.addEventListener('input', () => { });
    }

    document.getElementById('fm-name')?.addEventListener('input', () => { });
    document.getElementById('fm-req')?.addEventListener('change', () => { });
    updateConfig();

    document.getElementById('fm-form').onsubmit = e => {
      e.preventDefault();
      const name = document.getElementById('fm-name').value.trim();
      if (!name) { toast('Nome obrigatório', 'error'); return; }
      const type = typeInput.value;
      const field = {
        name,
        type,
        required: document.getElementById('fm-req').checked,
        isExtra: document.getElementById('fm-extra').checked
      };
      if (type === 'select') field.options = currentOptions.filter(Boolean);
      if (type === 'checkbox') field.checkItems = currentCheckItems.filter(Boolean);
      const ph = document.getElementById('fm-placeholder')?.value;
      if (ph) field.placeholder = ph;
      if (isEdit) { form.fields[editIdx] = field; toast('Campo atualizado!'); }
      else { form.fields.push(field); toast('Campo adicionado!'); }
      store.updateForm(form.id, form); closeModal(); render();
    };
  }

  const addFieldModal = (presetType) => fieldModal(null);
  const editFieldModal = (idx) => fieldModal(idx);

  function showPreview() {
    openModal(`<div class="p-6">
      <div class="flex justify-between items-center mb-5">
        <h3 class="text-base font-bold">Pré-visualização</h3>
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button>
      </div>
      <div class="rounded-xl border border-slate-200 p-4 bg-slate-50">
        <h4 class="text-sm font-bold text-center mb-4">${form.name}</h4>
        <div class="space-y-3">
          ${form.fields.map(f => `<div>
            <label class="text-xs font-semibold text-slate-600 mb-1 block">${f.name}${f.required ? ' <span class="text-red-400">*</span>' : ''}</label>
            ${f.type === 'select' ? `<select class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm" disabled><option>${(f.options || []).join('</option><option>')}</option></select>` :
        f.type === 'textarea' ? '<textarea class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm" rows="2" disabled></textarea>' :
          f.type === 'checkbox' ? `<div class="space-y-1.5">${(f.checkItems || [f.checkLabel || f.name]).map(ci => `<label class="flex items-center gap-2 text-sm"><input type="checkbox" disabled/>${ci}</label>`).join('')}</div>` :
            `<input type="${f.type}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm" disabled placeholder="${f.name}"/>`}
          </div>`).join('')}
          ${!form.fields.length ? '<p class="text-sm text-slate-400 text-center py-4">Nenhum campo adicionado</p>' : ''}
        </div>
      </div>
    </div>`);
  }

  render();
}
