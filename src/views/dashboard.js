import { store } from '../store.js';
import { bottomNav, badge, isDark, toggleTheme, openModal, impersonationBanner } from '../components/ui.js';

export async function dashboardView() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="flex items-center justify-center p-12 text-slate-400"><span class="material-symbols-outlined animate-spin mr-2">refresh</span> Carregando dashboard...</div>';

  const m = await store.fetchMetrics();
  const u = store.currentUser;
  if (!m || !u) return;
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  app.innerHTML = `
  ${impersonationBanner()}
  <header class="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 md:px-6 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] transition-colors duration-300">
    <div class="flex items-center justify-between h-full">
      <div class="flex items-center gap-3">
        <div class="relative"><div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">${u.name.charAt(0)}</div><div class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></div></div>
        <div><p class="text-[11px] font-medium text-slate-400">${getGreeting()},</p><h1 class="text-sm font-bold text-slate-900 dark:text-white leading-tight">${u.name}</h1></div>
      </div>
      <div class="flex items-center gap-1">
        <div class="relative">
          <button onclick="window.__toggleNotifications(this)" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary transition-colors">
            <span class="material-symbols-outlined text-lg">notifications</span>
            ${(store.getNotifications() || []).length > 0 ? `<span class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>` : ''}
          </button>
        </div>
        <button id="header-theme" class="relative w-9 h-9 flex md:hidden items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-500 transition-colors"><span class="material-symbols-outlined theme-icon text-xl">${isDark() ? 'light_mode' : 'dark_mode'}</span></button>
        <button onclick="window.__globalLogout()" class="w-9 h-9 flex md:hidden items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors" title="Sair"><span class="material-symbols-outlined text-xl">logout</span></button>
      </div>
    </div>
  </header>
  <div class="flex-1 overflow-y-auto">
    <div class="px-4 md:px-6 lg:px-10 py-5 space-y-6 max-w-7xl mx-auto w-full">
      <section>
        <div class="flex items-center justify-between mb-3"><h2 class="text-base font-bold md:text-lg">Visão Geral</h2>${badge('Hoje', 'blue')}</div>
        <div class="grid grid-cols-2 ${store.hasRole('ADMIN', 'SUPERVISOR', 'LIDER_GERACAO') ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3">
          ${kpi('groups', 'Total Membros', m.total, `${m.newConverts} novos`, 'blue')}
          ${store.systemSettings?.cellsEnabled !== false && store.hasRole('ADMIN', 'SUPERVISOR', 'LIDER_GERACAO') ? kpi('diversity_3', 'Células Ativas', m.cells, `${store.people.filter(p => !p.cellId).length} sem célula`, 'indigo') : ''}
          ${kpi('water_drop', 'Batizados', m.waterBaptism + '%', `${m.total - Math.round(m.waterBaptism * m.total / 100)} pendentes`, 'sky')}
          ${kpi('volunteer_activism', 'Encontros', m.encounter + '%', `${m.total - Math.round(m.encounter * m.total / 100)} pendentes`, 'emerald')}
        </div>
      </section>
      
      ${store.systemSettings?.ebdEnabled === true ? (() => {
        const attendance = store.ebdAttendance || [];
        const totalAlunos = (store.ebdClasses || []).reduce((s, c) => s + (c._count?.students || 0), 0);

        let totalRec = 0, totalPresent = 0;
        attendance.forEach(a => {
            (a.records || []).forEach(r => { totalRec++; if (r.presente) totalPresent++; });
        });
        const avgPresence = totalRec > 0 ? Math.round((totalPresent / totalRec) * 100) : 0;
        return `
        <section>
          <div class="flex items-center justify-between mb-3"><h2 class="text-base font-bold md:text-lg">Escola Bíblica Dominical (EBD)</h2></div>
          <div class="grid grid-cols-2 gap-3">
            ${kpi('school', 'Alunos Matriculados', totalAlunos, `${(store.ebdClasses || []).length} classes ativas`, 'blue')}
            ${kpi('how_to_reg', 'Média de Presença', `${avgPresence}%`, `${attendance.length} aulas registradas`, 'amber')}
          </div>
        </section>
        `;
      })() : ''}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <section>
            <h3 class="text-base font-bold mb-3 flex items-center gap-2"><span class="material-symbols-outlined text-primary">calendar_month</span> Programação da Semana</h3>
            <div class="bg-white rounded-2xl border border-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
              ${(() => {
      const schedule = store.getWeeklySchedule();
      const todayStr = new Date().toISOString().split('T')[0];
      return schedule.map((day, idx) => {
        if (!day.events.length) return '';
        const d = new Date(day.date + 'T12:00:00');
        const isToday = day.date === todayStr;
        const dayName = d.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0];
        const dayNum = d.getDate();
        const monthName = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

        return `
                    <div class="p-4 ${idx !== 0 ? 'border-t border-slate-50' : ''}">
                      <div class="flex gap-4">
                        <div class="flex flex-col items-center justify-center min-w-[48px] h-12 rounded-xl ${isToday ? 'bg-primary text-white' : 'bg-slate-50 text-slate-400'}">
                          <span class="text-[10px] font-bold uppercase leading-none mb-1">${dayName.slice(0, 3)}</span>
                          <span class="text-lg font-extrabold leading-none">${dayNum}</span>
                        </div>
                        <div class="flex-1 space-y-2">
                          ${day.events.filter(ev => ev.type !== 'cell' || store.systemSettings?.cellsEnabled !== false).map(ev => {
          let icon = 'event';
          let color = 'blue';
          let label = ev.title;
          let time = ev.time || 'Dia todo';

          if (ev.type === 'birthday') { icon = 'cake'; color = 'pink'; }
          else if (ev.type === 'cell') { icon = 'home'; color = 'indigo'; label = `Célula: ${ev.title}`; }
          else { color = ev.color || 'blue'; icon = ev.icon || 'event'; }

          return `
                              <div class="flex items-center justify-between group cursor-pointer" onclick="location.hash='/calendar'">
                                <div class="flex items-center gap-3">
                                  <div class="w-2 h-2 rounded-full bg-${color}-500"></div>
                                  <div>
                                    <p class="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">${label}</p>
                                    <p class="text-[11px] text-slate-400 font-medium">${time}</p>
                                  </div>
                                </div>
                                <span class="material-symbols-outlined text-slate-200 group-hover:text-slate-400 transition-colors text-lg">chevron_right</span>
                              </div>
                            `;
        }).join('')}
                        </div>
                      </div>
                    </div>
                  `;
      }).join('') || '<div class="p-8 text-center text-slate-400"><p class="text-sm">Nenhuma programação esta semana</p></div>';
    })()}
            </div>
          </section>

          <section>
            <h3 class="text-base font-bold mb-3">Ação Requerida</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${(() => {
      const cfg = store.config || {};
      const cards = [];
      if (cfg.noVisit?.enabled !== false && m.noVisit)
        cards.push(actionCard('ac-novisit', 'person_alert', 'orange', `Sem Visita >${cfg.noVisit?.days ?? 60}d`, `<b>${m.noVisit}</b> pessoas em situação de abandono.`, 'Urgente'));
      if (cfg.baptism?.enabled !== false && m.total - Math.round(m.waterBaptism * m.total / 100))
        cards.push(actionCard('ac-baptism', 'water_drop', 'blue', 'Pendentes de Batismo', `<b>${m.total - Math.round(m.waterBaptism * m.total / 100)}</b> pessoas não batizadas.`));
      if (cfg.consolidation?.enabled !== false && m.delayedConsolidations)
        cards.push(actionCard('ac-cons', 'route', 'amber', 'Atraso na Consolidação', `<b>${m.delayedConsolidations}</b> novos convertidos pendentes.`, 'Atenção'));
      if (cfg.reconciliation?.enabled !== false && m.reconciliations)
        cards.push(actionCard('ac-recon', 'handshake', 'purple', 'Reconciliações', `<b>${m.reconciliations}</b> em acompanhamento.`, 'Novo'));
      if (!cards.length)
        cards.push(`<div class="text-center py-8 bg-white rounded-xl border border-slate-100 col-span-2"><span class="material-symbols-outlined text-3xl text-slate-200 mb-2">inbox</span><p class="text-sm text-slate-400">Nenhuma ação pendente</p></div>`);
      return cards.join('');
    })()}
            </div>
          </section>
        </div>

        <aside class="space-y-6">
          ${store.hasRole('ADMIN', 'SUPERVISOR', 'LIDER_GERACAO') ? `<section>
            <div class="flex items-center justify-between mb-3"><h3 class="text-base font-bold">Triagem</h3><a href="#/triage" class="text-xs font-semibold text-primary">Ver tudo</a></div>
            ${store.triageQueue.filter(t => t.status === 'new' || t.status === 'forwarded_generation').length ? store.triageQueue.filter(t => t.status === 'new' || t.status === 'forwarded_generation').slice(0, 5).map(t => {
      const f = store.forms.find(x => x.id === t.formId);
      const formNameValue = t.data['Nome'] || t.data['Nome Completo'] || t.data['name'] || Object.values(t.data)[0];
      const displayStr = formNameValue ? String(formNameValue).trim() : 'Anônimo';
      return `<div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 mb-2 hover:border-primary/30 cursor-pointer transition" onclick="location.hash='/triage'"><div class="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-primary font-bold text-sm">${displayStr.charAt(0).toUpperCase()}</div><div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${displayStr}</p><p class="text-[11px] text-slate-500">${f?.name || 'Formulário'}</p></div><span class="material-symbols-outlined text-slate-300 text-lg">chevron_right</span></div>`
    }).join('') : '<div class="text-center py-8 bg-white rounded-xl border border-slate-100"><span class="material-symbols-outlined text-3xl text-slate-200">assignment_turned_in</span><p class="text-sm text-slate-400 mt-1">Triagem vazia</p></div>'}
          </section>`: ''}
        </aside>
      </div>
    </div>
  </div>
  ${bottomNav('home')}`;
  document.getElementById('header-theme')?.addEventListener('click', toggleTheme);

  // Bind Actions
  if (m.actionLists) {
    document.getElementById('ac-novisit')?.addEventListener('click', () => openActionModal('Sem Visita', m.actionLists.noVisit, 'orange'));
    document.getElementById('ac-baptism')?.addEventListener('click', () => openActionModal('Pendentes de Batismo', m.actionLists.pendingBaptism, 'blue'));
    document.getElementById('ac-cons')?.addEventListener('click', () => openActionModal('Atraso na Consolidação', m.actionLists.delayedConsolidation, 'amber'));
    document.getElementById('ac-recon')?.addEventListener('click', () => openActionModal('Reconciliações', m.actionLists.reconciliations, 'purple'));
  }
}

function openActionModal(title, peopleList, color) {
  openModal(`<div class="p-5 md:p-6 flex flex-col max-h-[85vh]">
    <div class="flex justify-between items-center mb-4 shrink-0">
      <h3 class="text-base font-bold text-${color}-700 flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-${color}-500"></span>${title}</h3>
      <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button>
    </div>
    <div class="overflow-y-auto pr-2 space-y-3 flex-1 pb-4">
      ${peopleList.length ? peopleList.map(p => {
    const c = p.cellId ? store.getCell(p.cellId) : null;
    return `<div class="p-3 border border-slate-100 rounded-xl bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p class="text-sm font-bold text-slate-800">${p.name}</p>
            <p class="text-xs text-slate-500 mt-0.5">${c?.name || 'Sem Célula'} ${p.phone ? `• ${p.phone}` : ''}</p>
          </div>
          <div class="flex gap-2 shrink-0">
            ${p.phone ? `<a href="https://wa.me/55${p.phone.replace(/\D/g, '')}" target="_blank" class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition"><span class="material-symbols-outlined text-[18px]">chat</span></a>` : ''}
            <a href="#/profile?id=${p.id}" onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="px-3 py-1.5 rounded-lg bg-white border border-${color}-200 text-${color}-700 text-xs font-bold hover:bg-${color}-50 transition">Ver Ficha</a>
          </div>
        </div>`;
  }).join('') : `<p class="text-sm text-slate-500 text-center py-4">Nenhuma pessoa listada.</p>`}
    </div>
  </div>`);
}

function kpi(icon, label, val, sub, color) {
  return `<div class="bg-white rounded-xl p-4 border border-slate-100 hover:shadow-sm transition group">
    <div class="w-8 h-8 rounded-lg bg-${color}-50 flex items-center justify-center text-${color}-600 mb-3"><span class="material-symbols-outlined text-lg">${icon}</span></div>
    <p class="text-[11px] font-medium text-slate-400">${label}</p>
    <p class="text-xl font-extrabold text-slate-900 mt-0.5">${val}</p>
    <p class="text-[11px] text-slate-400 mt-1">${sub}</p>
  </div>`;
}
function actionCard(id, icon, color, title, desc, tag = '') {
  return `<div id="${id}" class="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:border-primary/30 transition cursor-pointer">
    <div class="w-9 h-9 rounded-full bg-${color}-100 flex items-center justify-center text-${color}-600 shrink-0"><span class="material-symbols-outlined text-lg">${icon}</span></div>
    <div class="flex-1 min-w-0"><div class="flex items-center justify-between"><h4 class="text-sm font-semibold">${title}</h4>${tag ? `<span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-${color}-100 text-${color}-700">${tag}</span>` : ''}</div><p class="text-xs text-slate-500 mt-0.5">${desc}</p></div>
  </div>`;
}
