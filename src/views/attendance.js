import { store } from '../store.js';
import { avatar, toast } from '../components/ui.js';

export function attendanceView(params) {
  const app = document.getElementById('app');
  const cellId = params?.cellId; const c = store.getCell(cellId);
  if (!c) { app.innerHTML = '<div class="flex-1 flex items-center justify-center text-slate-400">Célula não encontrada</div>'; return }

  const targetDate = params?.date || new Date().toISOString().split('T')[0];
  const mem = store.getCellMembers(cellId);
  const att = {}; mem.forEach(m => { att[m.id] = null });
  let savedCustomFields = {};

  const existingAtt = store.getAttendanceForCell(cellId).find(a => a.date === targetDate);
  if (existingAtt && existingAtt.records) {
    existingAtt.records.forEach(r => { if (att[r.personId] !== undefined) att[r.personId] = r.status });
  }

  // Validation Rules
  const targetDateObj = new Date(targetDate + 'T12:00:00'); // Use mid-day to avoid timezone shifting
  const dayNamesMap = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
  const targetDayName = dayNamesMap[targetDateObj.getDay()];

  const isRightDay = c.meetingDay && c.meetingDay.toLowerCase().startsWith(targetDayName.toLowerCase().slice(0, 3));
  const cancellation = store.isCellCanceledOnDate(c.id, targetDate) || store.isCellCanceledOnDate('all', targetDate);

  let blockedMessage = null;
  const canBypassDay = store.hasRole('ADMIN', 'SUPERVISOR') || (store.hasRole('LIDER_GERACAO') && c.generationId === store.currentUser.generationId);
  if (cancellation) blockedMessage = `Célula cancelada neste dia: ${cancellation.reason}`;
  else if (!isRightDay && !canBypassDay) blockedMessage = `A chamada só pode ser realizada de ${c.meetingDay || '(dia não definido)'}. Você está tentando fazer de ${targetDayName}.`;

  app.innerHTML = `
  <header class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shrink-0 pt-[env(safe-area-inset-top)] transition-colors duration-300">
    <div class="flex flex-col">
      <div class="flex items-center px-4 h-14 gap-3">
        <button onclick="history.back()" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-xl">arrow_back</span></button>
        <div class="flex-1"><span class="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${targetDate.split('-').reverse().join('/')}</span></div>
      </div>
      <div class="px-4 pb-3">
        <h1 class="text-lg font-extrabold leading-tight">${c.name}</h1>
        <p class="text-xs text-slate-500 mt-0.5">Marque a presença do encontro de hoje</p>
        <div class="flex gap-4 mt-3 text-sm font-medium">
          ${blockedMessage ? '' : `
          <div class="flex items-center justify-between w-full">
            <span class="flex items-center gap-1.5 text-primary" id="cnt-p"><span class="w-2 h-2 rounded-full bg-primary"></span><span>0 Presente</span></span>
            <span class="flex items-center gap-1.5 text-slate-400" id="cnt-a"><span class="w-2 h-2 rounded-full bg-slate-400"></span><span>0 Ausente</span></span>
          </div>
          `}
        </div>
      </div>
    </div>
    ${blockedMessage ? `<div class="mx-4 mb-3 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm font-medium flex items-start gap-2"><span class="material-symbols-outlined text-lg">block</span><div>${blockedMessage}</div></div>` : ''}
  </header>
  <div class="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-3 w-full" id="att-list"></div>
  <div class="fixed bottom-0 left-0 right-0 md:left-[260px] z-40 p-4 flex justify-center pointer-events-none">
    <button id="btn-save" class="pointer-events-auto bg-primary text-white px-6 py-3.5 rounded-full font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"><span class="material-symbols-outlined text-lg">save</span>Salvar Presença</button>
  </div>`;

  function render() {
    document.getElementById('att-list').innerHTML = mem.map(m => {
      const s = att[m.id];
      return `<div class="bg-white rounded-xl p-4 border border-slate-100">
        <div class="flex items-center gap-3 mb-3">${avatar(m.name, 'h-9 w-9')}<div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${m.name}</p><p class="text-[11px] text-slate-500">${m.status}</p></div></div>
        <div class="grid grid-cols-3 gap-1 md:gap-2 bg-slate-50 p-1 md:p-1.5 rounded-lg">
          <button class="att-btn flex flex-col items-center py-2 md:py-3 rounded md:rounded-lg text-[10px] md:text-sm font-medium transition ${s === 'present' ? 'bg-white shadow-sm border border-slate-200 text-primary' : 'text-slate-400 hover:bg-white/50'}" data-p="${m.id}" data-s="present"><span class="material-symbols-outlined text-[16px] md:text-xl mb-0.5">check_circle</span>Presente</button>
          <button class="att-btn flex flex-col items-center py-2 md:py-3 rounded md:rounded-lg text-[10px] md:text-sm font-medium transition ${s === 'absent' ? 'bg-red-50 shadow-sm border border-red-100 text-red-600' : 'text-slate-400 hover:bg-white/50'}" data-p="${m.id}" data-s="absent"><span class="material-symbols-outlined text-[16px] md:text-xl mb-0.5">cancel</span>Ausente</button>
          <button class="att-btn flex flex-col items-center py-2 md:py-3 rounded md:rounded-lg text-[10px] md:text-sm font-medium transition ${s === 'justified' ? 'bg-amber-50 shadow-sm border border-amber-100 text-amber-600' : 'text-slate-400 hover:bg-white/50'}" data-p="${m.id}" data-s="justified"><span class="material-symbols-outlined text-[16px] md:text-xl mb-0.5">history_edu</span>Justific.</button>
        </div>
      </div>`;
    }).join('');

    if (!blockedMessage) {
      document.getElementById('cnt-p').querySelector('span:last-child').textContent = `${Object.values(att).filter(v => v === 'present').length} Presentes`;
      document.getElementById('cnt-a').querySelector('span:last-child').textContent = `${Object.values(att).filter(v => v === 'absent').length} Ausentes`;
      document.querySelectorAll('.att-btn').forEach(b => b.onclick = () => { att[b.dataset.p] = b.dataset.s; render() });
    }
  }

  render();

  if (blockedMessage) {
    const btn = document.getElementById('btn-save');
    if (btn) btn.style.display = 'none';
    return;
  }

  document.getElementById('btn-save').onclick = async (e) => {
    const btn = e.currentTarget;
    const orig = btn.innerHTML; btn.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">sync</span> Salvando...'; btn.disabled = true;

    const recs = Object.entries(att).filter(([, v]) => v).map(([pid, s]) => ({ personId: pid, status: s }));
    if (!recs.length) { toast('Marque pelo menos um membro', 'warning'); btn.innerHTML = orig; btn.disabled = false; return }

    try {
      await store.addAttendance({
        cellId, date: targetDate, records: recs, notes: ''
      });
      toast('Presença salva!'); location.hash = `/cell?id=${cellId}`;
    } catch (err) { toast('Erro de conexão ao salvar', 'error'); btn.innerHTML = orig; btn.disabled = false; }
  };
}
