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

  const canManage = store.hasRole('ADMIN', 'SUPERVISOR', 'SUPERADMIN') || store.hasSecondaryRole('SUPERINTENDENTE_EBD');
  const user = store.currentUser || {};
  const isTeacherOfClass = classData.professorId === user.id || 
                           classData.segundoProfessorId === user.id || 
                           classData.terceiroProfessorId === user.id;
  const canRecord = canManage || isTeacherOfClass;

  const professor = classData.professorId ? (store.users || []).find(u => u.id === classData.professorId) : null;
  const totalOfertasValor = (offerings || []).reduce((sum, o) => sum + (parseFloat(o.valor) || 0), 0);
  const todayDate = new Date().toISOString().split('T')[0];

  // Attendance state map: personId → 'present' | 'absent' | null
  const attState = {};
  (students || []).forEach(s => { attState[s.personId] = null; });
  
  // Also add professors to attState
  if (classData.professorId) attState['prof_1'] = null;
  if (classData.segundoProfessorId) attState['prof_2'] = null;
  if (classData.terceiroProfessorId) attState['prof_3'] = null;

  function renderView(activeTab = 'alunos', currentStudents = students, currentAttendanceList = attendanceList, currentOfferings = offerings, selectedDate = todayDate) {
    const totalOfertas = (currentOfferings || []).reduce((sum, o) => sum + (parseFloat(o.valor) || 0), 0);

    app.innerHTML = `
    ${header(classData.name, true, canManage ? `<button id="btn-edit-class" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"><span class="material-symbols-outlined text-lg">edit</span></button>` : '')}

    <div class="bg-white px-4 md:px-6 py-2 border-b border-slate-100 shadow-sm">
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        ${classData.faixaEtaria ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">people</span>${classData.faixaEtaria}</span>` : ''}
        ${classData.sala ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">meeting_room</span>${classData.sala}</span>` : ''}
        ${professor ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">person</span>${professor.name}</span>` : ''}
        ${classData.segundoProfessorId ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">person_outline</span>Aux: ${(store.users || []).find(u => u.id === classData.segundoProfessorId)?.name || '...'}</span>` : ''}
        ${classData.terceiroProfessorId ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">person_outline</span>Aux: ${(store.users || []).find(u => u.id === classData.terceiroProfessorId)?.name || '...'}</span>` : ''}
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
      <button class="ebd-tab ${activeTab === 'frequencia' ? 'text-primary border-b-2 border-primary font-bold' : 'text-slate-500 font-medium border-b-2 border-transparent'} whitespace-nowrap py-3.5 text-sm transition-colors" data-tab="frequencia">Frequência</button>
    </div>

    <div class="flex-1 overflow-y-auto bg-slate-50/30 pb-24">

      <!-- ABA ALUNOS -->
      <div id="tab-alunos" class="tab-panel ${activeTab === 'alunos' ? 'block' : 'hidden'} px-4 md:px-6 py-4">
        ${canManage ? `<button id="btn-matricular" class="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition mb-4 shadow-sm">
          <span class="material-symbols-outlined text-lg">person_add</span>Matricular Aluno
        </button>` : ''}
        ${renderFrequencyAlerts(currentStudents, currentAttendanceList)}
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
          ${renderAttGrid(currentStudents, classData, attState)}
        </div>

        ${(currentStudents || []).length > 0 && canRecord ? `
        <button id="btn-save-att" class="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition shadow-sm mb-6">
          <span class="material-symbols-outlined text-lg">save</span>Salvar Chamada
        </button>` : ''}

        ${(currentAttendanceList || []).length > 0 ? `
        <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Histórico de Chamadas</h3>
        <div class="space-y-2">
          ${(currentAttendanceList || []).map(att => {
            const justificados = records.filter(r => r.justificado === true).length;
            const profsPresentes = [att.professorPresente, att.segundoProfessorPresente, att.terceiroProfessorPresente].filter(p => p === true).length;
            const profsJustificados = [att.professorJustificado, att.segundoProfessorJustificado, att.terceiroProfessorJustificado].filter(p => p === true).length;
            const total = records.length;
            const faltas = total - presentes - justificados;

            return `<div class="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-between shadow-sm">
              <div class="flex flex-col">
                <span class="text-sm font-semibold text-slate-700">${att.data ? att.data.split('-').reverse().join('/') : '-'}</span>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="text-[9px] font-bold text-emerald-600">${presentes}P</span>
                  <span class="text-[9px] font-bold text-amber-500">${justificados}J</span>
                  <span class="text-[9px] font-bold text-red-500">${faltas}F</span>
                  ${profsPresentes > 0 || profsJustificados > 0 ? `
                    <span class="text-[9px] text-slate-300">|</span>
                    <span class="text-[9px] font-medium text-primary">${profsPresentes}P${profsJustificados > 0 ? `+${profsJustificados}J` : ''} Prof</span>
                  ` : ''}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-bold text-primary">${Math.round((presentes / (total || 1)) * 100)}%</span>
              </div>
            </div>`;
          }).join('')}
        </div>` : '<p class="text-[12px] text-slate-400 text-center py-8 bg-white border border-dashed rounded-xl">Nenhuma chamada registrada ainda.</p>'}
      </div>

      <!-- ABA OFERTA -->
      <div id="tab-oferta" class="tab-panel ${activeTab === 'oferta' ? 'block' : 'hidden'} px-4 md:px-6 py-4">
        ${canRecord ? `
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

      <!-- ABA FREQUÊNCIA -->
      <div id="tab-frequencia" class="tab-panel ${activeTab === 'frequencia' ? 'block' : 'hidden'} px-4 md:px-6 py-4">
        ${renderFrequencyTab(currentStudents, currentAttendanceList)}
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
      document.getElementById('att-grid').innerHTML = renderAttGrid(students, classData, attState);
    });

    // Salvar chamada
    document.getElementById('btn-save-att')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const date = document.getElementById('att-date').value;
      if (!date) { toast('Selecione a data da chamada', 'warning'); return; }

      const records = Object.entries(attState)
        .filter(([id, s]) => s !== null && !id.startsWith('prof_'))
        .map(([personId, status]) => {
          const st = (currentStudents || []).find(s => s.personId === personId);
          return st ? { ebdStudentId: st.id, presente: status === 'present', justificado: status === 'justified' } : null;
        })
        .filter(Boolean);

      const professorPresente = attState['prof_1'] === 'present';
      const professorJustificado = attState['prof_1'] === 'justified';
      const segundoProfessorPresente = attState['prof_2'] === 'present';
      const segundoProfessorJustificado = attState['prof_2'] === 'justified';
      const terceiroProfessorPresente = attState['prof_3'] === 'present';
      const terceiroProfessorJustificado = attState['prof_3'] === 'justified';

      if (!records.length && !professorPresente && !professorJustificado && !segundoProfessorPresente && !segundoProfessorJustificado && !terceiroProfessorPresente && !terceiroProfessorJustificado) { 
        toast('Marque a presença de alguém', 'warning'); return; 
      }

      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">sync</span> Salvando...';
      btn.disabled = true;

      try {
        await store.saveEbdAttendance(classId, { 
          data: date, 
          records,
          professorPresente,
          professorJustificado,
          segundoProfessorPresente,
          segundoProfessorJustificado,
          terceiroProfessorPresente,
          terceiroProfessorJustificado
        });
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

    // PDF export da classe
    document.getElementById('btn-pdf-class')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-pdf-class');
      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">refresh</span> Gerando...';
      btn.disabled = true;
      try {
        const s = store.systemSettings || {};
        const prof = classData.professorId ? (store.users || []).find(u => u.id === classData.professorId) : null;
        const prof2 = classData.segundoProfessorId ? (store.users || []).find(u => u.id === classData.segundoProfessorId) : null;
        const prof3 = classData.terceiroProfessorId ? (store.users || []).find(u => u.id === classData.terceiroProfessorId) : null;
        const totalAulas = (currentAttendanceList || []).length;

        const studentsFreq = (currentStudents || []).map(st => {
          const person = (store.people || []).find(p => p.id === st.personId) || { name: st.person?.name || 'Aluno' };
          let present = 0;
          (currentAttendanceList || []).forEach(att => {
            const rec = (att.records || []).find(r => r.ebdStudentId === st.id);
            if (rec && rec.presente === true) present++;
          });
          const pct = totalAulas > 0 ? Math.round((present / totalAulas) * 100) : 0;
          return { name: person.name, present, total: totalAulas, pct };
        });

        const attendanceHistory = (currentAttendanceList || []).map(att => {
          const records = att.records || [];
          const present = records.filter(r => r.presente === true).length;
          const total = records.length;
          const pct = total > 0 ? Math.round((present / total) * 100) : 0;
          return { data: att.data ? att.data.split('-').reverse().join('/') : '—', present, total, pct };
        });

        const totalPresentes = studentsFreq.reduce((s, x) => s + x.present, 0);
        const totalRec = studentsFreq.reduce((s, x) => s + x.total, 0);
        const freqPct = totalRec > 0 ? Math.round((totalPresentes / totalRec) * 100) : 0;

        const payload = {
          logoUrl: s.logoUrl || null,
          appName: s.appName || s.congregationName || 'CRM Celular',
          congregationName: s.congregationName || '',
          congregationAddress: s.congregationAddress || '',
          pastorName: s.pastorName || '',
          periodLabel: 'Histórico Completo',
          className: classData.name,
          professor: prof?.name || null,
          segundoProfessor: prof2?.name || null,
          terceiroProfessor: prof3?.name || null,
          sala: classData.sala || null,
          faixaEtaria: classData.faixaEtaria || null,
          totalAlunos: currentStudents.length,
          totalAulas,
          freqPct,
          studentsFreq,
          attendanceHistory
        };

        const res = await fetch('/api/reports/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${store.token}` },
          body: JSON.stringify({ type: 'ebd_class', payload })
        });
        if (!res.ok) throw new Error('Erro ao gerar PDF');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `EBD_${classData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        toast('PDF exportado!');
      } catch (err) {
        toast(err.message || 'Erro ao gerar PDF', 'error');
      } finally {
        btn.innerHTML = orig; btn.disabled = false;
      }
    });
  }

  function renderFrequencyAlerts(sts, attList) {
    if (!sts || !sts.length || !attList || !attList.length) return '';
    const MIN_SESSIONS = 2;
    const THRESHOLD = 50;
    const alerts = [];
    sts.forEach(s => {
      let total = attList.length, present = 0;
      attList.forEach(att => {
        const rec = (att.records || []).find(r => r.ebdStudentId === s.id);
        if (rec && rec.presente === true) present++;
      });
      if (total >= MIN_SESSIONS) {
        const pct = Math.round((present / total) * 100);
        if (pct < THRESHOLD) {
          const person = (store.people || []).find(p => p.id === s.personId) || { name: s.person?.name || 'Aluno' };
          alerts.push({ name: person.name, pct, present, total });
        }
      }
    });
    if (!alerts.length) return '';
    return `<div class="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-amber-600 text-lg">warning</span>
        <p class="text-xs font-bold text-amber-800">Alunos com baixa frequência (abaixo de ${THRESHOLD}%)</p>
      </div>
      <div class="space-y-1">
        ${alerts.map(a => `<div class="flex items-center justify-between text-[11px] text-amber-700">
          <span class="font-medium truncate max-w-[60%]">${a.name}</span>
          <span class="font-bold">${a.present}/${a.total} aulas (${a.pct}%)</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  function renderFrequencyTab(sts, attList) {
    const totalAulas = (attList || []).length;
    if (!sts || !sts.length) {
      return `<div class="flex flex-col items-center justify-center py-12 bg-white border border-dashed rounded-xl">
        <span class="material-symbols-outlined text-4xl text-slate-200 mb-2">person_off</span>
        <p class="text-sm text-slate-400">Nenhum aluno matriculado</p>
      </div>`;
    }
    if (!totalAulas) {
      return `<p class="text-[12px] text-slate-400 text-center py-8 bg-white border border-dashed rounded-xl">Nenhuma chamada registrada. Registre chamadas na aba <b>Chamada</b>.</p>`;
    }

    // Compute per-student stats
    const stats = sts.map(s => {
      const person = (store.people || []).find(p => p.id === s.personId) || { name: s.person?.name || 'Aluno' };
      let present = 0;
      (attList || []).forEach(att => {
        const rec = (att.records || []).find(r => r.ebdStudentId === s.id);
        if (rec && rec.presente === true) present++;
      });
      const pct = Math.round((present / totalAulas) * 100);
      return { name: person.name, present, total: totalAulas, faltas: totalAulas - present, pct };
    }).sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));

    // Summary KPIs
    const avgPct = stats.length ? Math.round(stats.reduce((s, x) => s + x.pct, 0) / stats.length) : 0;
    const highFreq = stats.filter(s => s.pct >= 75).length;
    const lowFreq = stats.filter(s => s.pct < 50).length;
    const kpiColor = avgPct >= 70 ? 'emerald' : avgPct >= 50 ? 'amber' : 'red';

    return `
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="bg-white rounded-xl p-3 border border-slate-100 text-center shadow-sm">
          <p class="text-lg font-extrabold text-${kpiColor}-600">${avgPct}%</p>
          <p class="text-[10px] text-slate-500 mt-0.5">Freq. Média</p>
        </div>
        <div class="bg-white rounded-xl p-3 border border-slate-100 text-center shadow-sm">
          <p class="text-lg font-extrabold text-emerald-600">${highFreq}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">≥ 75% Freq.</p>
        </div>
        <div class="bg-white rounded-xl p-3 border border-slate-100 text-center shadow-sm">
          <p class="text-lg font-extrabold text-red-500">${lowFreq}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">< 50% Freq.</p>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="px-4 py-2 bg-slate-50 border-b border-slate-100 grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Aluno</span>
          <span class="text-center w-10">Pres.</span>
          <span class="text-center w-10">Falt.</span>
          <span class="text-center w-12">Total</span>
          <span class="text-center w-14">Freq.</span>
        </div>
        ${stats.map(s => {
          const bg = s.pct >= 75 ? 'bg-emerald-50 text-emerald-700' : s.pct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
          const barColor = s.pct >= 75 ? 'bg-emerald-500' : s.pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
          return `<div class="px-4 py-2.5 border-b border-slate-50 last:border-0 grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center hover:bg-slate-50 transition">
            <div>
              <p class="text-sm font-semibold text-slate-800 truncate">${s.name}</p>
              <div class="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden w-full max-w-[120px]">
                <div class="h-full ${barColor} rounded-full" style="width:${s.pct}%"></div>
              </div>
            </div>
            <span class="text-center w-10 text-sm font-bold text-emerald-600">${s.present}</span>
            <span class="text-center w-10 text-sm font-medium text-red-400">${s.faltas}</span>
            <span class="text-center w-12 text-[11px] text-slate-400">${s.total}</span>
            <span class="w-14 flex justify-center"><span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ring-1 ring-inset ${bg}">${s.pct}%</span></span>
          </div>`;
        }).join('')}
      </div>

      ${canManage ? `<button id="btn-pdf-class" class="w-full mt-4 flex items-center justify-center gap-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 py-3 rounded-xl text-sm font-bold transition active:scale-95">
        <span class="material-symbols-outlined text-lg">picture_as_pdf</span>Exportar PDF desta Classe
      </button>` : ''}
    `;
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

  function renderAttGrid(sts, clData, state) {
    const profs = [];
    if (clData.professorId) profs.push({ id: 'prof_1', name: clData.professor?.name || 'Professor', role: 'Professor' });
    if (clData.segundoProfessorId) profs.push({ id: 'prof_2', name: clData.segundoProfessor?.name || 'Auxiliar', role: 'Auxiliar' });
    if (clData.terceiroProfessorId) profs.push({ id: 'prof_3', name: clData.terceiroProfessor?.name || 'Auxiliar', role: 'Auxiliar' });

    let html = '';

    if (profs.length > 0) {
      html += `<div class="mb-4">
        <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Professores</h3>
        <div class="space-y-2">
          ${profs.map(p => {
            const cur = state[p.id];
            return `<div class="bg-primary/5 rounded-xl p-3 border border-primary/10 shadow-sm ring-1 ring-primary/5">
              <div class="flex items-center gap-3 mb-2">
                ${avatar(p.name, 'h-8 w-8 !bg-primary/10 !text-primary')}
                <div>
                  <p class="text-sm font-bold truncate text-slate-800">${p.name}</p>
                  <p class="text-[10px] font-medium text-primary uppercase tracking-tight">${p.role}</p>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-1 bg-white/50 p-1 rounded-lg">
                <button class="att-toggle flex flex-col items-center justify-center py-2 rounded text-[10px] font-bold transition ${cur === 'present' ? 'bg-white shadow-sm border border-slate-200 text-primary' : 'text-slate-400 hover:bg-white/50'}" data-person-id="${p.id}" data-status="present">
                  <span class="material-symbols-outlined text-[16px] mb-0.5">check_circle</span>P
                </button>
                <button class="att-toggle flex flex-col items-center justify-center py-2 rounded text-[10px] font-bold transition ${cur === 'absent' ? 'bg-red-50 shadow-sm border border-red-100 text-red-600' : 'text-slate-400 hover:bg-white/50'}" data-person-id="${p.id}" data-status="absent">
                  <span class="material-symbols-outlined text-[16px] mb-0.5">cancel</span>A
                </button>
                <button class="att-toggle flex flex-col items-center justify-center py-2 rounded text-[10px] font-bold transition ${cur === 'justified' ? 'bg-amber-50 shadow-sm border border-amber-100 text-amber-600' : 'text-slate-400 hover:bg-white/50'}" data-person-id="${p.id}" data-status="justified">
                  <span class="material-symbols-outlined text-[16px] mb-0.5">history_edu</span>J
                </button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    if (sts && sts.length > 0) {
      html += `<h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Alunos</h3>
      <div class="space-y-2">
        ${sts.map(s => {
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
        }).join('')}
      </div>`;
    } else {
      html += `<p class="text-[12px] text-slate-400 text-center py-8 bg-white border border-dashed rounded-xl">Matricule alunos para registrar chamada.</p>`;
    }

    return html;
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
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Segundo Assistente</label>
          <select id="ee-professor3" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Nenhum...</option>
            ${users.filter(u => {
              const sr = Array.isArray(u.secondaryRoles) ? u.secondaryRoles : JSON.parse(u.secondaryRoles || '[]');
              return sr.includes('SEGUNDO_PROFESSOR') || u.id === classData.terceiroProfessorId;
            }).map(u => `<option value="${u.id}" ${classData.terceiroProfessorId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
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
        terceiroProfessorId: document.getElementById('ee-professor3').value || null,
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
