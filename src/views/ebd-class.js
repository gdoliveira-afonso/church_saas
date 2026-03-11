import { store } from '../store.js';
import { header, avatar, toast, openModal, closeModal } from '../components/ui.js';

export async function ebdClassView(params) {
  const app = document.getElementById('app');
  const classId = params?.id || params?.classId;

  if (!classId) {
    app.innerHTML = `<div class="flex-1 flex items-center justify-center text-slate-400">Classe não encontrada</div>`;
    return;
  }

  // Loading state
  app.innerHTML = `<div class="flex-1 flex flex-col items-center justify-center bg-slate-50/50">
    <div class="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
    <p class="text-sm text-slate-500 font-medium">Carregando classe...</p>
  </div>`;

  let classData, students, attendanceList, offerings;

  try {
    [classData, students, attendanceList, offerings] = await Promise.all([
      store.apiFetch(`/ebd/classes/${classId}`),
      store.getEbdStudents(classId),
      store.getEbdAttendance(classId),
      store.getEbdOfferings(classId),
    ]);
  } catch (err) {
    app.innerHTML = `<div class="flex-1 flex items-center justify-center text-slate-400">Erro ao carregar classe</div>`;
    return;
  }

  if (!classData) {
    app.innerHTML = `<div class="flex-1 flex items-center justify-center text-slate-400">Classe não encontrada</div>`;
    return;
  }

  const canManage = store.hasRole('ADMIN', 'SUPERVISOR') || store.hasSecondaryRole('SUPERINTENDENTE_EBD');
  const professor = classData.professorId ? (store.users || []).find(u => u.id === classData.professorId) : null;
  const totalOfertasValor = (offerings || []).reduce((sum, o) => sum + (parseFloat(o.valor) || 0), 0);
  const todayDate = new Date().toISOString().split('T')[0];

  // Attendance state map: personId → 'present' | 'absent' | null
  const attState = {};
  (students || []).forEach(s => { attState[s.personId] = null; });

  function renderView(activeTab = 'alunos', currentStudents = students, currentAttendanceList = attendanceList, currentOfferings = offerings, selectedDate = todayDate) {
    const totalOfertas = (currentOfferings || []).reduce((sum, o) => sum + (parseFloat(o.valor) || 0), 0);

    app.innerHTML = `
    ${header(classData.name, true, canManage ? `<button id="btn-edit-class" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"><span class="material-symbols-outlined text-lg">edit</span></button>` : '')}

    <div class="bg-white px-4 md:px-6 py-2 border-b border-slate-100 shadow-sm">
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        ${classData.faixaEtaria ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">people</span>${classData.faixaEtaria}</span>` : ''}
        ${classData.sala ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">meeting_room</span>${classData.sala}</span>` : ''}
        ${professor ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">person</span>${professor.name}</span>` : ''}
        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">group</span>${(currentStudents || []).length} alunos</span>
      </div>
    </div>

    <div class="bg-white border-b border-slate-200 sticky top-14 z-10 px-4 md:px-6 flex gap-6 overflow-x-auto no-scrollbar">
      <button class="ebd-tab ${activeTab === 'alunos' ? 'text-primary border-b-2 border-primary font-bold' : 'text-slate-500 font-medium border-b-2 border-transparent'} whitespace-nowrap py-3.5 text-sm transition-colors" data-tab="alunos">Alunos</button>
      <button class="ebd-tab ${activeTab === 'chamada' ? 'text-primary border-b-2 border-primary font-bold' : 'text-slate-500 font-medium border-b-2 border-transparent'} whitespace-nowrap py-3.5 text-sm transition-colors" data-tab="chamada">Chamada</button>
      <button class="ebd-tab ${activeTab === 'oferta' ? 'text-primary border-b-2 border-primary font-bold' : 'text-slate-500 font-medium border-b-2 border-transparent'} whitespace-nowrap py-3.5 text-sm transition-colors" data-tab="oferta">
        Oferta
        ${totalOfertas > 0 ? `<span class="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">R$ ${totalOfertas.toFixed(2).replace('.', ',')}</span>` : ''}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto bg-slate-50/30 pb-24">

      <!-- ABA ALUNOS -->
      <div id="tab-alunos" class="tab-panel ${activeTab === 'alunos' ? 'block' : 'hidden'} px-4 md:px-6 py-4">
        ${canManage ? `<button id="btn-matricular" class="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition mb-4 shadow-sm">
          <span class="material-symbols-outlined text-lg">person_add</span>Matricular Aluno
        </button>` : ''}
        <div id="student-list">
          ${renderStudentList(currentStudents, canManage)}
        </div>
      </div>

      <!-- ABA CHAMADA -->
      <div id="tab-chamada" class="tab-panel ${activeTab === 'chamada' ? 'block' : 'hidden'} px-4 md:px-6 py-4">
        <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm mb-4">
          <label class="text-xs font-semibold text-slate-600 mb-2 block">Data da Chamada</label>
          <input type="date" id="att-date" value="${selectedDate}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 font-medium text-slate-700"/>
        </div>

        <div id="att-grid" class="space-y-2 mb-4">
          ${renderAttGrid(currentStudents, attState)}
        </div>

        ${(currentStudents || []).length > 0 ? `
        <button id="btn-save-att" class="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition shadow-sm mb-6">
          <span class="material-symbols-outlined text-lg">save</span>Salvar Chamada
        </button>` : ''}

        ${(currentAttendanceList || []).length > 0 ? `
        <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Histórico de Chamadas</h3>
        <div class="space-y-2">
          ${(currentAttendanceList || []).map(att => {
            const records = att.records || [];
            const presentes = records.filter(r => r.status === 'present').length;
            const total = records.length;
            const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;
            return `<div class="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-between shadow-sm">
              <span class="text-sm font-semibold text-slate-700">${att.date ? att.date.split('-').reverse().join('/') : '-'}</span>
              <div class="flex items-center gap-2">
                <div class="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full bg-primary rounded-full" style="width:${pct}%"></div>
                </div>
                <span class="text-[11px] font-bold text-primary">${presentes}/${total} (${pct}%)</span>
              </div>
            </div>`;
          }).join('')}
        </div>` : '<p class="text-[12px] text-slate-400 text-center py-8 bg-white border border-dashed rounded-xl">Nenhuma chamada registrada ainda.</p>'}
      </div>

      <!-- ABA OFERTA -->
      <div id="tab-oferta" class="tab-panel ${activeTab === 'oferta' ? 'block' : 'hidden'} px-4 md:px-6 py-4">
        ${canManage ? `
        <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm mb-4">
          <h3 class="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><span class="material-symbols-outlined text-primary text-lg">add_circle</span>Registrar Oferta</h3>
          <form id="offering-form" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-slate-600 mb-1 block">Data <span class="text-red-500">*</span></label>
                <input type="date" id="of-data" value="${todayDate}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
              </div>
              <div>
                <label class="text-xs font-semibold text-slate-600 mb-1 block">Valor (R$) <span class="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0" id="of-valor" placeholder="0,00" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
              </div>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-600 mb-1 block">Observação</label>
              <input type="text" id="of-obs" placeholder="Ex: Oferta de missões" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
            </div>
            <button type="submit" class="w-full bg-emerald-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-emerald-700 transition">Registrar Oferta</button>
          </form>
        </div>` : ''}

        <div class="flex items-center justify-between mb-3 px-1">
          <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ofertas Registradas</h3>
          ${totalOfertas > 0 ? `<span class="text-sm font-bold text-emerald-600">Total: R$ ${totalOfertas.toFixed(2).replace('.', ',')}</span>` : ''}
        </div>

        <div id="offering-list">
          ${renderOfferingList(currentOfferings)}
        </div>
      </div>

    </div>`;

    // Tab switching
    document.querySelectorAll('.ebd-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        document.querySelectorAll('.ebd-tab').forEach(t => {
          const isActive = t.dataset.tab === targetTab;
          t.classList.toggle('text-primary', isActive);
          t.classList.toggle('border-primary', isActive);
          t.classList.toggle('font-bold', isActive);
          t.classList.toggle('text-slate-500', !isActive);
          t.classList.toggle('font-medium', !isActive);
          t.classList.toggle('border-transparent', !isActive);
        });
        document.querySelectorAll('.tab-panel').forEach(p => {
          p.classList.toggle('hidden', p.id !== `tab-${targetTab}`);
          p.classList.toggle('block', p.id === `tab-${targetTab}`);
        });
      });
    });

    // Edit class button
    document.getElementById('btn-edit-class')?.addEventListener('click', () => {
      openEditModal();
    });

    // Matricular aluno
    document.getElementById('btn-matricular')?.addEventListener('click', () => {
      openEnrollModal(currentStudents, (updatedStudents) => {
        students = updatedStudents;
        renderView('alunos', students, currentAttendanceList, currentOfferings, selectedDate);
      });
    });

    // Remover aluno
    document.querySelectorAll('.btn-remove-student').forEach(btn => {
      btn.addEventListener('click', async () => {
        const studentId = btn.dataset.studentId;
        const studentName = btn.dataset.studentName;
        if (!confirm(`Remover ${studentName} da classe?`)) return;
        btn.disabled = true;
        try {
          await store.removeEbdStudent(classId, studentId);
          students = students.filter(s => s.id !== studentId);
          toast('Aluno removido da classe');
          document.getElementById('student-list').innerHTML = renderStudentList(students, canManage);
          setupRemoveButtons();
        } catch (err) {
          toast('Erro ao remover aluno', 'error');
          btn.disabled = false;
        }
      });
    });

    function setupRemoveButtons() {
      document.querySelectorAll('.btn-remove-student').forEach(btn => {
        btn.addEventListener('click', async () => {
          const studentId = btn.dataset.studentId;
          const studentName = btn.dataset.studentName;
          if (!confirm(`Remover ${studentName} da classe?`)) return;
          btn.disabled = true;
          try {
            await store.removeEbdStudent(classId, studentId);
            students = students.filter(s => s.id !== studentId);
            toast('Aluno removido da classe');
            document.getElementById('student-list').innerHTML = renderStudentList(students, canManage);
            setupRemoveButtons();
          } catch (err) {
            toast('Erro ao remover aluno', 'error');
            btn.disabled = false;
          }
        });
      });
    }

    // Chamada: toggle presença — event delegation para sobreviver a re-renders
    document.getElementById('att-grid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.att-toggle');
      if (!btn) return;
      const personId = btn.dataset.personId;
      const status = btn.dataset.status;
      attState[personId] = attState[personId] === status ? null : status;
      document.getElementById('att-grid').innerHTML = renderAttGrid(students, attState);
    });

    // Salvar chamada
    document.getElementById('btn-save-att')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const date = document.getElementById('att-date').value;
      if (!date) { toast('Selecione a data da chamada', 'warning'); return; }

      const records = Object.entries(attState)
        .filter(([, s]) => s !== null)
        .map(([personId, status]) => {
          const st = (currentStudents || []).find(s => s.personId === personId);
          return st ? { ebdStudentId: st.id, presente: status === 'present' } : null;
        })
        .filter(Boolean);

      if (!records.length) { toast('Marque pelo menos um aluno', 'warning'); return; }

      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">sync</span> Salvando...';
      btn.disabled = true;

      try {
        await store.saveEbdAttendance(classId, { data: date, records });
        toast('Chamada salva!');
        const updatedAttendance = await store.getEbdAttendance(classId);
        renderView('chamada', students, updatedAttendance, currentOfferings, date);
      } catch (err) {
        toast('Erro ao salvar chamada', 'error');
        btn.innerHTML = orig;
        btn.disabled = false;
      }
    });

    // Registrar oferta
    document.getElementById('offering-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const data = document.getElementById('of-data').value;
      const valor = parseFloat(document.getElementById('of-valor').value);
      const observacao = document.getElementById('of-obs').value.trim();

      if (!data || isNaN(valor) || valor <= 0) {
        toast('Preencha data e valor da oferta', 'warning');
        return;
      }

      const orig = btn.innerHTML;
      btn.innerHTML = 'Registrando...'; btn.disabled = true;

      try {
        await store.addEbdOffering(classId, { data, valor, observacao: observacao || null });
        toast('Oferta registrada!');
        const updatedOfferings = await store.getEbdOfferings(classId);
        renderView('oferta', students, currentAttendanceList, updatedOfferings, selectedDate);
      } catch (err) {
        toast('Erro ao registrar oferta', 'error');
        btn.innerHTML = orig; btn.disabled = false;
      }
    });
  }

  function renderStudentList(sts, canManageLocal) {
    if (!sts || !sts.length) {
      return `<div class="flex flex-col items-center justify-center py-12 bg-white border border-dashed rounded-xl">
        <span class="material-symbols-outlined text-4xl text-slate-200 mb-2">person_off</span>
        <p class="text-sm text-slate-400">Nenhum aluno matriculado</p>
      </div>`;
    }
    return `<div class="space-y-2">${sts.map(s => {
      const person = (store.people || []).find(p => p.id === s.personId) || { name: s.person?.name || 'Aluno', status: '' };
      return `<div class="bg-white rounded-xl p-3 border border-slate-100 flex items-center gap-3 shadow-sm">
        ${avatar(person.name, 'h-9 w-9')}
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold truncate text-slate-800">${person.name}</p>
          ${person.status ? `<p class="text-[11px] text-slate-500">${person.status}</p>` : ''}
        </div>
        ${canManageLocal ? `<button class="btn-remove-student w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500 transition shrink-0" data-student-id="${s.id}" data-student-name="${person.name}">
          <span class="material-symbols-outlined text-[18px]">person_remove</span>
        </button>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  function renderAttGrid(sts, state) {
    if (!sts || !sts.length) {
      return `<p class="text-[12px] text-slate-400 text-center py-8 bg-white border border-dashed rounded-xl">Matricule alunos para registrar chamada.</p>`;
    }
    return sts.map(s => {
      const person = (store.people || []).find(p => p.id === s.personId) || { name: s.person?.name || 'Aluno' };
      const cur = state[s.personId];
      return `<div class="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
        <div class="flex items-center gap-3 mb-2">${avatar(person.name, 'h-8 w-8')}<p class="text-sm font-semibold truncate flex-1">${person.name}</p></div>
        <div class="grid grid-cols-3 gap-1 bg-slate-50 p-1 rounded-lg">
          <button class="att-toggle flex flex-col items-center py-2 rounded text-[10px] font-medium transition ${cur === 'present' ? 'bg-white shadow-sm border border-slate-200 text-primary' : 'text-slate-400 hover:bg-white/50'}" data-person-id="${s.personId}" data-status="present">
            <span class="material-symbols-outlined text-[16px] mb-0.5">check_circle</span>Presente
          </button>
          <button class="att-toggle flex flex-col items-center py-2 rounded text-[10px] font-medium transition ${cur === 'absent' ? 'bg-red-50 shadow-sm border border-red-100 text-red-600' : 'text-slate-400 hover:bg-white/50'}" data-person-id="${s.personId}" data-status="absent">
            <span class="material-symbols-outlined text-[16px] mb-0.5">cancel</span>Ausente
          </button>
          <button class="att-toggle flex flex-col items-center py-2 rounded text-[10px] font-medium transition ${cur === 'justified' ? 'bg-amber-50 shadow-sm border border-amber-100 text-amber-600' : 'text-slate-400 hover:bg-white/50'}" data-person-id="${s.personId}" data-status="justified">
            <span class="material-symbols-outlined text-[16px] mb-0.5">history_edu</span>Justif.
          </button>
        </div>
      </div>`;
    }).join('');
  }

  function renderOfferingList(offs) {
    if (!offs || !offs.length) {
      return `<p class="text-[12px] text-slate-400 text-center py-8 bg-white border border-dashed rounded-xl">Nenhuma oferta registrada ainda.</p>`;
    }
    return `<div class="space-y-2">${offs.map(o => {
      const valor = parseFloat(o.valor) || 0;
      const dataFmt = o.data ? o.data.split('-').reverse().join('/') : (o.date ? o.date.split('-').reverse().join('/') : '-');
      return `<div class="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <span class="material-symbols-outlined text-[16px]">payments</span>
          </div>
          <div>
            <p class="text-sm font-bold text-emerald-700">R$ ${valor.toFixed(2).replace('.', ',')}</p>
            <p class="text-[11px] text-slate-500">${dataFmt}${o.observacao ? ' · ' + o.observacao : ''}</p>
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  function openEnrollModal(currentStudents, onEnrolled) {
    const enrolledIds = new Set((currentStudents || []).map(s => s.personId));
    const available = (store.people || []).filter(p => !enrolledIds.has(p.id));

    openModal(`<div class="p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-base font-bold">Matricular Aluno</h3>
        <button onclick="closeModal()" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400 text-xl">close</span></button>
      </div>
      <div class="relative mb-3">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
        <input id="enroll-search" class="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Buscar por nome..."/>
      </div>
      <div id="enroll-list" class="max-h-72 overflow-y-auto space-y-1.5">
        ${renderEnrollList(available, '')}
      </div>
    </div>`);

    document.getElementById('enroll-search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.getElementById('enroll-list').innerHTML = renderEnrollList(available, q);
      setupEnrollBtns(onEnrolled, currentStudents);
    });

    setupEnrollBtns(onEnrolled, currentStudents);
  }

  function renderEnrollList(people, q) {
    const filtered = q ? people.filter(p => p.name.toLowerCase().includes(q)) : people;
    if (!filtered.length) return `<p class="text-sm text-slate-400 text-center py-4">Nenhuma pessoa encontrada</p>`;
    return filtered.map(p => `<div class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition">
      ${avatar(p.name, 'h-8 w-8')}
      <div class="flex-1 min-w-0"><p class="text-sm font-medium truncate">${p.name}</p><p class="text-[11px] text-slate-400">${p.status || ''}</p></div>
      <button class="btn-do-enroll shrink-0 text-xs font-semibold text-primary border border-primary/30 px-3 py-1 rounded-lg hover:bg-primary/5 transition" data-person-id="${p.id}" data-person-name="${p.name}">Matricular</button>
    </div>`).join('');
  }

  function setupEnrollBtns(onEnrolled, currentStudents) {
    document.querySelectorAll('.btn-do-enroll').forEach(btn => {
      btn.addEventListener('click', async () => {
        const personId = btn.dataset.personId;
        btn.disabled = true; btn.textContent = '...';
        try {
          const newStudent = await store.enrollEbdStudent(classId, personId);
          toast('Aluno matriculado!');
          const updatedStudents = [...(currentStudents || []), newStudent || { id: newStudent?.id || Date.now(), personId }];
          closeModal();
          onEnrolled(updatedStudents);
        } catch (err) {
          toast('Erro ao matricular aluno', 'error');
          btn.disabled = false; btn.textContent = 'Matricular';
        }
      });
    });
  }

  function openEditModal() {
    const people = store.people || [];
    const users = store.users || [];

    openModal(`<div class="p-6">
      <div class="flex justify-between items-center mb-5">
        <h3 class="text-base font-bold">Editar Classe</h3>
        <button onclick="closeModal()" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400 text-xl">close</span></button>
      </div>
      <form id="ebd-edit-form" class="space-y-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Nome <span class="text-red-500">*</span></label>
          <input id="ee-name" value="${classData.name || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-semibold text-slate-600 mb-1 block">Faixa Etária</label>
            <input id="ee-faixa" value="${classData.faixaEtaria || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: 15 a 30 anos"/>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-600 mb-1 block">Sala</label>
            <input id="ee-sala" value="${classData.sala || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Professor</label>
          <select id="ee-professor" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Selecionar...</option>
            ${users.filter(u => {
              const sr = Array.isArray(u.secondaryRoles) ? u.secondaryRoles : JSON.parse(u.secondaryRoles || '[]');
              return sr.includes('PROFESSOR') || u.id === classData.professorId;
            }).map(u => `<option value="${u.id}" ${classData.professorId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Segundo Professor</label>
          <select id="ee-professor2" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Nenhum...</option>
            ${users.filter(u => {
              const sr = Array.isArray(u.secondaryRoles) ? u.secondaryRoles : JSON.parse(u.secondaryRoles || '[]');
              return sr.includes('SEGUNDO_PROFESSOR') || u.id === classData.segundoProfessorId;
            }).map(u => `<option value="${u.id}" ${classData.segundoProfessorId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <input type="checkbox" id="ee-ativo" ${classData.ativo !== false ? 'checked' : ''} class="w-4 h-4 rounded accent-primary"/>
          <label for="ee-ativo" class="text-sm text-slate-700 font-medium cursor-pointer">Classe ativa</label>
        </div>
        <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition mt-2">Salvar Alterações</button>
      </form>
    </div>`);

    document.getElementById('ebd-edit-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const name = document.getElementById('ee-name').value.trim();
      if (!name) { toast('Nome obrigatório', 'error'); return; }

      const orig = btn.innerHTML; btn.innerHTML = 'Salvando...'; btn.disabled = true;

      const data = {
        name,
        faixaEtaria: document.getElementById('ee-faixa').value.trim() || null,
        sala: document.getElementById('ee-sala').value.trim() || null,
        professorId: document.getElementById('ee-professor').value || null,
        segundoProfessorId: document.getElementById('ee-professor2').value || null,
        ativo: document.getElementById('ee-ativo').checked,
      };

      try {
        const updated = await store.updateEbdClass(classId, data);
        Object.assign(classData, updated || data);
        toast('Classe atualizada!');
        closeModal();
        renderView('alunos', students, attendanceList, offerings, todayDate);
      } catch (err) {
        toast('Erro ao atualizar classe', 'error');
        btn.innerHTML = orig; btn.disabled = false;
      }
    };
  }

  // Initial render
  renderView('alunos', students, attendanceList, offerings, todayDate);
}
