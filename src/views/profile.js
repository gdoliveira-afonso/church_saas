import { store } from '../store.js';
import { header, avatar, badge, statusColor, secondaryRoleBadges, toast, openModal, closeModal } from '../components/ui.js';

export function profileView(params) {
  const app = document.getElementById('app');
  const p = store.getPerson(params?.id);
  if (!p) { app.innerHTML = '<div class="flex-1 flex items-center justify-center"><p class="text-slate-400">Pessoa não encontrada</p></div>'; return }
  const cell = p.cellId ? store.getCell(p.cellId) : null;

  const user = p.userId ? store.users.find(u => u.id === p.userId) : null;

  function isTrackVisible(track, person) {
    if (!track.targetMetadata) return true;
    try {
      const target = JSON.parse(track.targetMetadata);
      if (target.everyone) return true;

      // Check status
      if (target.statuses && target.statuses.length > 0) {
        if (target.statuses.includes(person.status)) return true;
      }

      // Check generation (from cell)
      if (target.generations && target.generations.length > 0) {
        const personCell = store.getCell(person.cellId);
        const genId = personCell?.generationId || person.generationId;
        if (genId && target.generations.includes(genId)) return true;
      }

      return false;
    } catch (e) {
      return true; // Fallback
    }
  }

  function getVisits() { return store.getVisitsForPerson(p.id); }
  function getNotes() { return store.getNotesForPerson(p.id); }
  const att = store.getAttendanceForPerson(p.id);
  const attPct = att.length ? Math.round(att.filter(a => a.status === 'present').length / att.length * 100) : 0;

  app.innerHTML = `
  ${header('Perfil', true, store.hasRole('ADMIN', 'SUPERVISOR', 'LIDER_GERACAO', 'LEADER', 'VICE_LEADER') ? `<a href="#/people/edit?id=${p.id}" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"><span class="material-symbols-outlined text-lg">edit</span></a>` : '')}
  <div class="flex-1 overflow-y-auto pb-32">
    <div class="flex flex-col md:flex-row md:items-start md:gap-6 items-center bg-white px-5 md:px-6 pt-5 pb-6 border-b border-slate-100">
      <div class="relative shrink-0 mb-3 md:mb-0">${avatar(p.name, 'h-20 w-20 text-xl')}<span class="absolute bottom-0 right-0 w-5 h-5 ${p.riskLevel === 'high' ? 'bg-red-500' : p.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-emerald-500'} border-2 border-white rounded-full flex items-center justify-center"><span class="material-symbols-outlined text-white text-[12px]">${p.riskLevel === 'low' ? 'check' : 'priority_high'}</span></span></div>
      <div class="text-center md:text-left">
        <h1 class="text-xl font-extrabold">${p.name}</h1>
        <div class="flex flex-wrap gap-1.5 justify-center md:justify-start mt-1.5">${badge(p.status, statusColor(p.status))} ${secondaryRoleBadges(user)} ${p.riskLevel === 'high' ? badge('Em Risco', 'red') : ''}</div>
        <p class="text-xs text-slate-500 mt-1">${store.systemSettings?.cellsEnabled !== false && cell ? `${cell.name} • ${cell.meetingDay || ''}` : ''} ${p.phone || ''}</p>
        <div class="flex gap-2 mt-3 justify-center md:justify-start">
          ${p.phone ? `<a href="tel:${p.phone}" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold"><span class="material-symbols-outlined text-sm">call</span>Ligar</a>` : ''}
          ${p.phone ? `<a href="https://wa.me/55${p.phone.replace(/\D/g, '')}" target="_blank" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold"><span class="material-symbols-outlined text-sm">chat</span>WhatsApp</a>` : ''}
        </div>
      </div>
    </div>
    <!-- Tabs -->
    <div class="flex gap-1 px-4 md:px-6 py-3 overflow-x-auto no-scrollbar">${['Dados', 'Espiritual', 'Retiros', 'Visitas', 'Marcos', 'Notas', 'Adicional', ...(store.systemSettings?.ebdEnabled === true ? ['EBD'] : [])].map((t, i) => `<button class="tab whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition ${i === 0 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}" data-t="${t.toLowerCase()}">${t}</button>`).join('')}</div>
    <div id="tab-c" class="px-4 md:px-6 lg:px-10 pb-6 max-w-4xl mx-auto w-full"></div>
  </div>
  <div class="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-4 md:px-6 py-3 z-40">
    <button id="btn-note" class="w-full md:w-auto bg-primary text-white py-3 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[.98] transition-all shadow-sm"><span class="material-symbols-outlined text-lg">edit_note</span>Nota</button>
  </div>`;

  const tc = document.getElementById('tab-c');
  function show(t) {
    document.querySelectorAll('.tab').forEach(b => { b.classList.toggle('bg-primary', b.dataset.t === t); b.classList.toggle('text-white', b.dataset.t === t); b.classList.toggle('bg-slate-100', b.dataset.t !== t); b.classList.toggle('text-slate-500', b.dataset.t !== t) });
    if (t === 'dados') {
      let consolidationHtml = '';
      if (p.status === 'Novo Convertido' && p.consolidation) {
        const c = p.consolidation;
        const days = Math.floor((new Date() - new Date(c.startDate)) / 86400000);
        const consVisits = getVisits().filter(v => v.type === 'Visita de Consolidação').length;
        const sColor = c.status === 'COMPLETED' ? 'emerald' : c.status === 'IN_PROGRESS' ? 'amber' : 'slate';
        const sText = c.status === 'COMPLETED' ? 'Finalizada' : c.status === 'IN_PROGRESS' ? 'Em Andamento' : 'Pendente';
        const showBtn = c.status !== 'COMPLETED';

        consolidationHtml = `<div class="bg-gradient-to-br from-${sColor}-50 to-white dark:from-${sColor}-900/20 dark:to-slate-800 rounded-xl p-5 shadow-sm border border-${sColor}-100 dark:border-${sColor}-800 mb-4">
          <div class="flex justify-between items-start mb-3">
            <h3 class="text-sm font-bold text-${sColor}-900 dark:text-${sColor}-400 flex items-center gap-2"><span class="material-symbols-outlined text-base">route</span>Jornada de Consolidação</h3>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-${sColor}-100 dark:bg-${sColor}-900/50 text-${sColor}-700 dark:text-${sColor}-300">${sText}</span>
          </div>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="bg-white dark:bg-slate-700/50 rounded-lg p-3 border border-${sColor}-50 dark:border-${sColor}-900/30">
              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Tempo na Igreja</p>
              <p class="text-xl font-extrabold text-${sColor}-700 dark:text-${sColor}-400">${days} <span class="text-xs font-semibold text-slate-400 dark:text-slate-500">dias</span></p>
            </div>
            <div class="bg-white dark:bg-slate-700/50 rounded-lg p-3 border border-${sColor}-50 dark:border-${sColor}-900/30">
              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Visitas Recebidas</p>
              <p class="text-xl font-extrabold text-${sColor}-700 dark:text-${sColor}-400">${consVisits} <span class="text-xs font-semibold text-slate-400 dark:text-slate-500">visitas</span></p>
            </div>
          </div>
          ${showBtn ? `<button id="btn-complete-consolidation" class="w-full bg-${sColor}-600 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-${sColor}-700 transition" onclick="window.completeCons()"> <span class="material-symbols-outlined text-lg">check_circle</span> Marcar como Consolidado </button>` : `<p class="text-xs text-center text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 py-2 rounded-lg">Consolidado em ${new Date(c.completedDate).toLocaleDateString('pt-BR')}</p>`}
        </div>`;
      }

      const calculateAge = (dob) => {
        if (!dob) return null;
        const birth = new Date(dob);
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
        return age;
      };
      const age = calculateAge(p.birthdate);

      tc.innerHTML = consolidationHtml + card('📌 Dados Gerais', `<dl class="space-y-3">${[
        ['person', p.name],
        ['call', p.phone || '-'],
        ['cake', p.birthdate ? p.birthdate.split('-').reverse().join('/') : '-'],
        age !== null ? ['database', `${age} anos`] : null,
        ['home', p.address || '-'],
        ['calendar_today', p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : '-']
      ].filter(Boolean).map(([i, v]) => `<div class="flex items-center gap-3"><span class="material-symbols-outlined text-slate-400 text-lg">${i}</span><span class="text-sm">${v}</span></div>`).join('')}</dl>`);
    }
    if (t === 'espiritual') {
      const spTracks = store.tracks.filter(tr => tr.category === 'espiritual' && isTrackVisible(tr, p));
      tc.innerHTML = card('🙏 Vida Espiritual', `<div class="space-y-3">${spTracks.length ? spTracks.map(tr => {
        const d = p.tracksData ? p.tracksData[tr.id] : false;
        return `<div class="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-lg bg-${tr.color}-100 flex items-center justify-center"><span class="material-symbols-outlined text-${tr.color}-500 text-base">${tr.icon}</span></div><span class="text-sm font-medium">${tr.name}</span></div><span class="text-xs font-medium px-2.5 py-1 rounded-full ${d ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">${d ? '✓ Sim' : '✗ Não'}</span></div>`;
      }).join('') : '<p class="text-sm text-slate-400 text-center py-4">Nenhum marco espiritual disponível para este perfil</p>'}</div>`);
    }
    if (t === 'retiros') {
      const retTracks = store.tracks.filter(tr => tr.category === 'retiros' && isTrackVisible(tr, p));
      tc.innerHTML = card('🏕 Retiros', `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${retTracks.length ? retTracks.map(tr => {
        const d = p.tracksData ? p.tracksData[tr.id] : false;
        return `<div class="p-4 bg-slate-50 rounded-lg text-center border border-slate-100 hover:border-${tr.color}-300 transition"><div class="w-10 h-10 mx-auto rounded-lg bg-${tr.color}-100 flex items-center justify-center mb-2"><span class="material-symbols-outlined text-${tr.color}-600">${tr.icon}</span></div><p class="text-sm font-semibold mb-2">${tr.name}</p><span class="text-xs font-medium px-2.5 py-1 rounded-full ${d ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">${d ? '✓ Realizado' : '✗ Pendente'}</span></div>`;
      }).join('') : '<p class="text-sm text-slate-400 text-center py-4 col-span-2">Nenhum retiro disponível para este perfil</p>'}</div>`);
    }
    if (t === 'visitas') {
      const visits = getVisits();
      tc.innerHTML = card('🏠 Visitas', `${visits.length ? visits.map(v => `<div class="p-3 border border-slate-100 rounded-lg mb-2"><div class="flex justify-between mb-1"><span class="text-sm font-semibold text-primary">${v.type || 'Visita'}</span><span class="text-[11px] text-slate-400">${v.date}</span></div><p class="text-xs text-slate-600">${v.observation || ''}</p>${v.result ? `<p class="text-[11px] text-slate-500 mt-1 font-medium">Resultado: ${v.result}</p>` : ''}</div>`).join('') : '<p class="text-sm text-slate-400 text-center py-4">Nenhuma visita registrada</p>'}<button id="btn-visit" class="mt-3 w-full bg-primary/10 text-primary py-2 rounded-lg text-sm font-semibold hover:bg-primary/20 transition">+ Registrar Visita</button>`);
      document.getElementById('btn-visit')?.addEventListener('click', () => openVisitModal());
    }
    if (t === 'marcos') {
      tc.innerHTML = `<div class="flex items-center justify-center py-8"><span class="material-symbols-outlined animate-spin text-3xl text-slate-300">progress_activity</span></div>`;
      store.getMilestones(p.id).then(milestones => {
        const COLOR_MAP = {
          emerald: '#059669', primary: '#2563eb', blue: '#2563eb', purple: '#7c3aed',
          indigo: '#4f46e5', cyan: '#0891b2', teal: '#0d9488', orange: '#ea580c',
          gray: '#6b7280', slate: '#64748b', amber: '#d97706', red: '#dc2626'
        };
        const ICON_DEFAULT = 'emoji_events';

        if (!milestones.length) {
          tc.innerHTML = `<div class="flex flex-col items-center py-12 text-slate-400">
            <span class="material-symbols-outlined text-5xl mb-3">timeline</span>
            <p class="text-sm font-medium mb-1">Nenhum marco registrado ainda</p>
            <p class="text-xs">Os marcos aparecem automaticamente ao salvar alterações</p>
          </div>
          <button id="btn-add-marco" class="w-full mt-3 bg-primary/10 text-primary py-2 rounded-lg text-sm font-semibold hover:bg-primary/20 transition flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-sm">add_circle</span>Adicionar Marco Manual
          </button>`;
        } else {
          const isAdmin = store.hasRole('ADMIN', 'SUPERVISOR');
          const timelineItems = milestones.map((m, idx) => {
            const color = COLOR_MAP[m.color] || '#64748b';
            let rawDateStrStr = typeof m.date === 'string' ? m.date : m.date.toISOString();
            if (rawDateStrStr.indexOf('T') === -1) {
              rawDateStrStr = rawDateStrStr + 'T12:00:00Z';
            }
            const date = new Date(rawDateStrStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
            const isLast = idx === milestones.length - 1;
            return `<div class="flex gap-3 ${isLast ? '' : 'pb-5'} relative group">
              <div class="flex flex-col items-center shrink-0">
                <div class="w-9 h-9 rounded-full flex items-center justify-center shadow-sm" style="background:${color}18; border: 2px solid ${color}40">
                  <span class="material-symbols-outlined text-base" style="color:${color}">${m.icon || ICON_DEFAULT}</span>
                </div>
                ${isLast ? '' : `<div class="w-0.5 flex-1 mt-1.5" style="background:${color}25"></div>`}
              </div>
              <div class="flex-1 pt-1 pb-1 pr-6 relative">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-sm font-bold text-slate-800">${m.label}</p>
                  <span class="text-[10px] text-slate-400 whitespace-nowrap shrink-0">${date}</span>
                </div>
                ${m.detail ? `<p class="text-xs text-slate-500 mt-0.5">${m.detail}</p>` : ''}
                <span class="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 inline-block" style="background:${color}15; color:${color}">${m.type === 'MANUAL' ? 'Marco Manual' : m.type === 'STATUS_CHANGE' ? 'Status' : (store.systemSettings?.cellsEnabled !== false && m.type === 'CELL_CHANGE') ? 'Célula' : m.type === 'TRACK_COMPLETED' ? 'Espiritual' : m.type}</span>
                ${isAdmin ? `<button data-id="${m.id}" class="btn-del-marco absolute top-0 -right-2 w-7 h-7 flex items-center justify-center text-red-500/50 hover:text-red-600 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100" title="Excluir Marco"><span class="material-symbols-outlined text-[15px]">delete</span></button>` : ''}
              </div>
            </div>`;
          }).join('');
          tc.innerHTML = `<div class="py-2">${store.systemSettings?.cellsEnabled === false ? timelineItems.replace(/.*CELL_CHANGE.*<\/div>.*<\/div><\/div>/g, '') : timelineItems}</div>
          <button id="btn-add-marco" class="w-full mt-2 bg-primary/10 text-primary py-2 rounded-lg text-sm font-semibold hover:bg-primary/20 transition flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-sm">add_circle</span>Adicionar Marco Manual
          </button>`;

          document.querySelectorAll('.btn-del-marco').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              if (confirm('Tem certeza que deseja excluir permanentemente este marco?')) {
                const id = e.currentTarget.dataset.id;
                try {
                  await store.deleteMilestone(p.id, id);
                  toast('Marco excluído com sucesso');
                  show('marcos');
                } catch (err) { toast('Erro ao excluir', 'error'); }
              }
            });
          });
        }
        document.getElementById('btn-add-marco')?.addEventListener('click', openMarcoModal);
      });
    }
    if (t === 'notas') {
      const notes = getNotes();
      const isAdmin = store.hasRole('ADMIN', 'SUPERVISOR');
      tc.innerHTML = `<div class="space-y-3">${notes.length ? notes.map(n => {
        const author = store.getUser(n.authorId);
        const authorName = author ? author.name : 'Desconhecido';
        const typeStr = n.type || n.category || 'Outro';
        const isAuthor = n.authorId === store.currentUser.id;

        return `<div class="p-4 bg-white rounded-xl border-l-4 ${typeStr === 'Visita' ? 'border-l-emerald-500' : typeStr === 'Desânimo' ? 'border-l-amber-500' : typeStr === 'Falta' ? 'border-l-red-500' : 'border-l-primary'} shadow-sm relative group">
          <div class="flex justify-between mb-1">
            <span class="text-[11px] font-medium px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">${authorName}</span>
            <span class="text-[11px] text-slate-400">${n.date}</span>
          </div>
          <p class="text-[11px] text-slate-500 font-bold mb-1">${typeStr}</p>
          <p class="text-sm text-slate-700">${n.text}</p>
          ${(isAdmin || isAuthor) ? `<button data-id="${n.id}" class="btn-del-note absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-red-500/50 hover:text-red-600 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100" title="Excluir Nota"><span class="material-symbols-outlined text-[18px]">delete</span></button>` : ''}
        </div>`;
      }).join('') : '<p class="text-sm text-slate-400 text-center py-6">Nenhuma nota registrada</p>'}</div>`;

      document.querySelectorAll('.btn-del-note').forEach(btn => {
        btn.onclick = async () => {
          if (confirm('Tem certeza que deseja excluir esta nota?')) {
            try {
              await store.deleteNote(btn.dataset.id);
              toast('Nota excluída');
              show('notas');
            } catch (e) { toast('Erro ao excluir', 'error'); }
          }
        };
      });
    }
    if (t === 'adicional') {
      let extra = {};
      try { extra = p.extraData ? (typeof p.extraData === 'string' ? JSON.parse(p.extraData) : p.extraData) : {}; } catch (e) { console.error('Erro ao processar extraData:', e); }
      const entries = Object.entries(extra);
      const isAdmin = store.hasRole('ADMIN', 'SUPERVISOR', 'LEADER', 'VICE_LEADER', 'LIDER_GERACAO');

      tc.innerHTML = `
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-sm font-bold flex items-center gap-2"><span class="material-symbols-outlined text-primary text-lg">description</span> Informações Adicionais</h3>
          ${isAdmin ? `<button id="btn-add-extra" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition"><span class="material-symbols-outlined text-lg">add_circle</span> Novo Campo</button>` : ''}
        </div>
        ${entries.length ? `<div class="space-y-4">${entries.map(([k, v]) => {
        let valHtml = `<p class="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">${v || '<span class="text-slate-300 italic">vazio</span>'}</p>`;
        if (v && v.includes('|') && (v.startsWith('http') || v.includes('www.'))) {
          const [name, url] = v.split('|');
          valHtml = `<a href="${url.startsWith('http') ? url : 'https://' + url}" target="_blank" class="flex items-center justify-between gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition text-sm font-semibold text-primary group">
              <span class="truncate">${name || 'Acessar Link'}</span>
              <span class="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">open_in_new</span>
            </a>`;
        } else if (v && (v.startsWith('http') || v.startsWith('www.'))) {
          valHtml = `<a href="${v.startsWith('http') ? v : 'https://' + v}" target="_blank" class="flex items-center justify-between gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition text-sm font-semibold text-primary group">
              <span class="truncate">${v}</span>
              <span class="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">open_in_new</span>
            </a>`;
        }
        return `<div class="relative group">
            <div class="flex justify-between items-center mb-1 ml-1 pr-1">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${k}</p>
              ${isAdmin ? `
                <div class="flex gap-2">
                  <button class="btn-edit-extra text-slate-300 hover:text-primary transition" data-key="${k}" title="Editar"><span class="material-symbols-outlined text-base">edit</span></button>
                  <button class="btn-del-extra text-slate-300 hover:text-red-500 transition" data-key="${k}" title="Remover"><span class="material-symbols-outlined text-base">delete</span></button>
                </div>` : ''}
            </div>
            ${valHtml}
          </div>`;
      }).join('')}</div>` : '<div class="flex flex-col items-center py-12 text-slate-300"><span class="material-symbols-outlined text-5xl mb-2">content_paste_off</span><p class="text-sm font-medium">Nenhuma informação adicional vinculada</p><p class="text-xs mt-1 text-center">Configure campos no formulário para salvar aqui.</p></div>'}`;

      if (isAdmin) {
        document.getElementById('btn-add-extra')?.addEventListener('click', () => openExtraDataModal());
        document.querySelectorAll('.btn-edit-extra').forEach(btn => {
          btn.addEventListener('click', () => openExtraDataModal(btn.dataset.key, extra[btn.dataset.key]));
        });
        document.querySelectorAll('.btn-del-extra').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (confirm(`Excluir o campo "${btn.dataset.key}"?`)) {
              delete extra[btn.dataset.key];
              try {
                await store.updatePersonExtraData(p.id, extra);
                toast('Campo excluído!');
                show('adicional');
              } catch (e) { toast('Erro ao salvar', 'error'); }
            }
          });
        });
      }
    }
    if (t === 'ebd') {
      tc.innerHTML = `<div class="flex items-center justify-center py-10"><span class="material-symbols-outlined animate-spin text-3xl text-slate-300">progress_activity</span></div>`;
      store.apiFetch(`/ebd/person/${p.id}`).then(data => {
        if (!data || (!data.enrolled && !data.isProfessor)) {
          tc.innerHTML = `<div class="flex flex-col items-center py-12 text-slate-300">
            <span class="material-symbols-outlined text-5xl mb-2">menu_book</span>
            <p class="text-sm font-medium text-slate-400">Não matriculado em nenhuma classe da EBD</p>
          </div>`;
          return;
        }

        if (data.isProfessor && !data.enrolled) {
          tc.innerHTML = `
            <div class="space-y-4">
              <h3 class="text-sm font-bold flex items-center gap-2">
                <span class="material-symbols-outlined text-emerald-500 text-lg">school</span>Status na EBD
              </h3>
              <div class="bg-emerald-50 rounded-xl p-5 border border-emerald-100 shadow-sm flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-emerald-600">school</span>
                  </div>
                  <div>
                    <h4 class="text-sm font-bold text-slate-800">Professor(a)</h4>
                    <p class="text-[11px] text-slate-500">${data.teachingClasses?.join(', ') || 'Classe vinculada'}</p>
                  </div>
                </div>
                <span class="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">DOCENTE</span>
              </div>
            </div>`;
          return;
        }

        const pct = data.percentual || 0;
        const pctColor = pct >= 70 ? 'emerald' : pct >= 50 ? 'amber' : 'red';
        tc.innerHTML = `
          <div class="space-y-4">
            <h3 class="text-sm font-bold flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-lg">local_library</span>Matrícula e Frequência
            </h3>
            <div class="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-blue-500">school</span>
                  </div>
                  <div>
                    <h4 class="text-sm font-bold text-slate-800">${data.class.name}</h4>
                    ${data.class.faixaEtaria ? `<p class="text-[11px] text-slate-400">${data.class.faixaEtaria}</p>` : ''}
                  </div>
                </div>
                <a href="#/ebd/class?id=${data.class.id}" class="h-8 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold flex items-center transition">Ver Classe</a>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2 mb-3">
                <div class="h-2 rounded-full bg-${pctColor}-500 transition-all" style="width:${pct}%"></div>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                  <span class="block text-[10px] uppercase font-bold text-slate-400 mb-1">Aulas</span>
                  <p class="text-lg font-extrabold text-slate-700">${data.totalAulas}</p>
                </div>
                <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                  <span class="block text-[10px] uppercase font-bold text-slate-400 mb-1">Presenças</span>
                  <p class="text-lg font-extrabold text-${pctColor}-600">${data.totalPresente}</p>
                </div>
                <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                  <span class="block text-[10px] uppercase font-bold text-slate-400 mb-1">Frequência</span>
                  <p class="text-lg font-extrabold text-${pctColor}-600">${pct}%</p>
                </div>
              </div>
            </div>
          </div>`;
      }).catch(() => {
        tc.innerHTML = `<p class="text-sm text-slate-400 text-center py-8">Erro ao carregar dados da EBD</p>`;
      });
    }
  }

  function openExtraDataModal(editKey = '', editVal = '') {
    openModal(`<div class="p-5 md:p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-base font-bold">${editKey ? 'Editar' : 'Novo'} Campo Adicional</h3>
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button>
      </div>
      <form id="extra-form" class="space-y-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Nome do Campo</label>
          <input id="ef-key" type="text" value="${editKey}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Hobby, Profissão, Redes Sociais..." required ${editKey ? 'readonly bg-slate-50' : ''}/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Valor</label>
          <textarea id="ef-val" rows="3" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" placeholder="Digite a informação..." required>${editVal}</textarea>
          <p class="text-[10px] text-slate-400 mt-1">Para links clicáveis, adicione "Nome|http://url" ou apenas a URL.</p>
        </div>
        <button type="submit" class="w-full bg-primary text-white py-2.5 mt-2 rounded-lg text-sm font-bold hover:bg-primary/90 active:scale-[.98] transition-all">Salvar Informação</button>
      </form>
    </div>`);

    document.getElementById('extra-form').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const key = document.getElementById('ef-key').value.trim();
      const val = document.getElementById('ef-val').value.trim();

      let extra = {};
      try { extra = p.extraData ? (typeof p.extraData === 'string' ? JSON.parse(p.extraData) : p.extraData) : {}; } catch (e) { }

      extra[key] = val;

      const orig = btn.innerHTML; btn.innerHTML = 'Salvando...'; btn.disabled = true;
      try {
        await store.updatePersonExtraData(p.id, extra);
        toast('Informação salva!');
        closeModal();
        show('adicional');
      } catch (err) { toast('Erro ao salvar', 'error'); btn.innerHTML = orig; btn.disabled = false; }
    };
  }

  const D = {
    currentUser: null,
    users: [], people: [], cells: [], attendance: [], pastoralNotes: [], visits: [], events: [], cellCancellations: [], cellJustifications: [], eventExceptions: [],
    forms: [], tracks: [], triageQueue: [], notifications: [], generations: []
  };

  function isTrackVisible(track, person) {
    if (!track.targetMetadata) return true;
    try {
      const target = JSON.parse(track.targetMetadata);
      if (target.everyone) return true;

      // Check status
      if (target.statuses && target.statuses.length > 0) {
        if (target.statuses.includes(person.status)) return true;
      }

      // Check generation (from cell)
      if (target.generations && target.generations.length > 0) {
        const personCell = store.getCell(person.cellId);
        const genId = personCell?.generationId || person.generationId;
        if (genId && target.generations.includes(genId)) return true;
      }

      return false;
    } catch (e) {
      return true; // Fallback
    }
  }

  function openMarcoModal() {
    const ICON_OPTS = [
      ['emoji_events', 'Evento'], ['favorite', 'Fé'], ['verified', 'Membro'], ['handshake', 'Reconciliação'],
      ['water_drop', 'Batismo'], ['local_fire_department', 'Espírito Santo'], ['school', 'Escola'],
      ['volunteer_activism', 'Retiro'], ['groups', 'Célula'], ['swap_horiz', 'Transfer.'],
      ['shield_person', 'Líder'], ['supervisor_account', 'Vice-Líder'],
      ['person_off', 'Inativo'], ['person_remove', 'Afastado'], ['moving', 'Mudou-se'],
      ['star', 'Destaque'], ['church', 'Igreja'], ['celebration', 'Celebração']
    ];
    const COLOR_OPTS = [
      ['emerald', 'Verde'], ['blue', 'Azul'], ['purple', 'Roxo'], ['indigo', 'Índigo'],
      ['cyan', 'Ciano'], ['teal', 'Teal'], ['amber', 'Âmbar'], ['orange', 'Laranja'],
      ['gray', 'Cinza'], ['slate', 'Slate']
    ];
    const today = new Date().toISOString().split('T')[0];
    openModal(`<div class="p-5 md:p-6 pb-20 md:pb-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-base font-bold">Adicionar Marco Manual</h3>
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button>
      </div>
      <form id="marco-form" class="space-y-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Título do Marco</label>
          <input id="mf-label" type="text" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Casamento, Batismo, Liderança..." required/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Data Opcional</label>
          <input id="mf-date" type="date" value="${today}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Detalhe (opcional)</label>
          <input id="mf-detail" type="text" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Informação adicional..."/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-2 block">Ícone</label>
          <div class="flex flex-wrap gap-1.5">
            ${ICON_OPTS.map(([ic, label], i) => `<label title="${label}" class="cursor-pointer">
              <input type="radio" name="mf-icon" value="${ic}" class="sr-only" ${i === 0 ? 'checked' : ''}>
              <span class="icon-opt w-9 h-9 flex items-center justify-center rounded-lg border-2 transition ${i === 0 ? 'border-primary bg-primary/10' : 'border-slate-200 hover:border-slate-300'}">
                <span class="material-symbols-outlined text-base">${ic}</span>
              </span>
            </label>`).join('')}
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-2 block">Cor</label>
          <div class="flex flex-wrap gap-1.5">
            ${COLOR_OPTS.map(([c, label], i) => `<label title="${label}" class="cursor-pointer">
              <input type="radio" name="mf-color" value="${c}" class="sr-only" ${i === 0 ? 'checked' : ''}>
              <span class="color-opt w-6 h-6 rounded-full border-2 transition block ${i === 0 ? 'border-slate-800 scale-110' : 'border-transparent hover:border-slate-400'}" style="background:var(--color-${c}, ${{
        emerald: '#059669', blue: '#2563eb', purple: '#7c3aed', indigo: '#4f46e5', cyan: '#0891b2',
        teal: '0d9488', amber: '#d97706', orange: '#ea580c', gray: '#6b7280', slate: '#64748b'
      }[c]})"></span>
            </label>`).join('')}
          </div>
        </div>
        <button type="submit" class="w-full bg-primary text-white py-2.5 mt-2 rounded-lg text-sm font-bold hover:bg-primary/90 active:scale-[.98] transition-all">Salvar Marco</button>
      </form>
    </div>`);

    // Icon selector visual
    document.querySelectorAll('input[name="mf-icon"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.icon-opt').forEach(s => { s.classList.remove('border-primary', 'bg-primary/10'); s.classList.add('border-slate-200'); });
        radio.nextElementSibling.classList.add('border-primary', 'bg-primary/10'); radio.nextElementSibling.classList.remove('border-slate-200');
      });
    });
    document.querySelectorAll('input[name="mf-color"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.color-opt').forEach(s => { s.classList.remove('border-slate-800', 'scale-110'); s.classList.add('border-transparent'); });
        radio.nextElementSibling.classList.add('border-slate-800', 'scale-110'); radio.nextElementSibling.classList.remove('border-transparent');
      });
    });

    document.getElementById('marco-form').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const orig = btn.innerHTML; btn.innerHTML = 'Salvando...'; btn.disabled = true;
      try {
        const payload = {
          label: document.getElementById('mf-label').value.trim(),
          detail: document.getElementById('mf-detail').value.trim(),
          icon: document.querySelector('input[name="mf-icon"]:checked').value,
          color: document.querySelector('input[name="mf-color"]:checked').value,
          date: document.getElementById('mf-date').value
        };
        await store.addManualMilestone(p.id, payload);
        toast('Marco adicionado!');
        closeModal();
        show('marcos');
      } catch (err) { toast('Erro ao salvar', 'error'); btn.innerHTML = orig; btn.disabled = false; }
    };
  }

  function openVisitModal() {
    const today = new Date().toISOString().split('T')[0];
    openModal(`<div class="p-5 md:p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-base font-bold">Registrar Visita</h3>
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button>
      </div>
      <form id="visit-form" class="space-y-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Tipo de Visita</label>
          <select id="vf-type" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20">
            <option value="Visita de Consolidação">Visita de Consolidação</option>
            <option value="Visita de Acompanhamento">Visita de Acompanhamento</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Data</label>
          <input id="vf-date" type="date" value="${today}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Observação</label>
          <textarea id="vf-obs" rows="3" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" placeholder="Descreva como foi a visita..."></textarea>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Resultado</label>
          <select id="vf-result" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20">
            <option value="Realizada">Realizada com sucesso</option>
            <option value="Pessoa ausente">Pessoa ausente</option>
            <option value="Remarcada">Remarcada</option>
            <option value="Recusada">Recusada</option>
          </select>
        </div>
        <button type="submit" class="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 active:scale-[.98] transition-all">Salvar Visita</button>
      </form>
    </div>`);
    document.getElementById('visit-form').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const orig = btn.innerHTML; btn.innerHTML = 'Salvando...'; btn.disabled = true;
      try {
        await store.addVisit({
          personId: p.id,
          authorId: store.currentUser.id,
          date: document.getElementById('vf-date').value,
          type: document.getElementById('vf-type').value,
          observation: document.getElementById('vf-obs').value.trim(),
          result: document.getElementById('vf-result').value
        });
        closeModal();
        toast('Visita registrada!');
        show('visitas');
      } catch (err) { toast('Erro ao salvar', 'error'); btn.innerHTML = orig; btn.disabled = false; }
    };
  }

  show('dados');
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => show(b.dataset.t));
  document.getElementById('btn-note').onclick = () => {
    openModal(`<div class="p-5 md:p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-base font-bold">Nova Nota</h3>
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button>
      </div>
      <form id="note-form" class="space-y-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Categoria</label>
          <select id="nf-cat" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20">
            <option value="Visita">Visita</option>
            <option value="Acompanhamento">Acompanhamento</option>
            <option value="Desânimo">Desânimo</option>
            <option value="Falta">Falta</option>
            <option value="Outro" selected>Outro</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Texto</label>
          <textarea id="nf-text" rows="3" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" placeholder="Escreva a nota..." required></textarea>
        </div>
        <button type="submit" class="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 active:scale-[.98] transition-all">Salvar Nota</button>
      </form>
    </div>`);
    document.getElementById('note-form').onsubmit = async e => {
      e.preventDefault();
      const text = document.getElementById('nf-text').value.trim();
      if (!text) return;

      const btn = e.target.querySelector('button[type="submit"]');
      const orig = btn.innerHTML; btn.innerHTML = 'Salvando...'; btn.disabled = true;
      try {
        await store.addNote({ personId: p.id, authorId: store.currentUser.id, date: new Date().toISOString().split('T')[0], type: document.getElementById('nf-cat').value, text, visibility: 'leadership' });
        closeModal();
        toast('Nota adicionada!');
        show('notas');
      } catch (err) { toast('Erro ao salvar', 'error'); btn.innerHTML = orig; btn.disabled = false; }
    };
  };

  window.completeCons = async () => {
    await store.completeConsolidation(p.id);
    toast('Consolidação concluída 🎉');
    show('dados');
  };
}

function card(title, content) { return `<div class="bg-white rounded-xl p-5 shadow-sm border border-slate-100"><h3 class="text-sm font-bold mb-4">${title}</h3>${content}</div>` }
