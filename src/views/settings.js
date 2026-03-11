import { store } from '../store.js';
import { header, bottomNav, badge, toast, openModal, closeModal, updateSidebar } from '../components/ui.js';

const RL = { SUPERADMIN: 'Super Administrador', ADMIN: 'Administrador', SUPERVISOR: 'Supervisor', LIDER_GERACAO: 'Líder de Geração', LEADER: 'Líder de Célula', VICE_LEADER: 'Vice-Líder' };
const RC = { SUPERADMIN: 'amber', ADMIN: 'blue', SUPERVISOR: 'purple', LIDER_GERACAO: 'indigo', LEADER: 'green', VICE_LEADER: 'orange' };

export function settingsView() {
  const app = document.getElementById('app'); const u = store.currentUser;
  app.innerHTML = `
  ${header('Configurações', false)}
  <div class="bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 md:px-6 sticky top-14 z-10 shrink-0">
    <div class="flex gap-6 overflow-x-auto no-scrollbar max-w-5xl mx-auto" id="settings-tabs">
      <button class="settings-tab active whitespace-nowrap py-3.5 text-sm font-bold text-primary border-b-2 border-primary transition-colors" data-target="tab-account">Conta & Perfil</button>
      ${['ADMIN', 'SUPERVISOR'].includes(u.role) ? `
      <button class="settings-tab whitespace-nowrap py-3.5 text-sm font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent transition-colors" data-target="tab-team">Equipe</button>
      <button class="settings-tab whitespace-nowrap py-3.5 text-sm font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent transition-colors" data-target="tab-tools">Ferramentas & Acesso</button>
      ${u.role === 'ADMIN' ? `<button class="settings-tab whitespace-nowrap py-3.5 text-sm font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent transition-colors" data-target="tab-system">Sistema &amp; Alertas</button>
      <button class="settings-tab whitespace-nowrap py-3.5 text-sm font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent transition-colors" data-target="tab-custom-fields">Métricas &amp; Campos</button>
      <button class="settings-tab whitespace-nowrap py-3.5 text-sm font-medium text-slate-500 hover:text-slate-800 border-b-2 border-transparent transition-colors" data-target="tab-logs"><span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[15px]">history</span>Logs</span></button>` : ''}
      ` : ''}
    </div>
  </div>

  <div class="flex-1 overflow-y-auto px-4 md:px-6 lg:px-10 py-5 max-w-5xl mx-auto w-full pb-20">
    
    <!-- TAG ACCOUNT -->
    <div id="tab-account" class="tab-content space-y-6">
      <section>
        <div class="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">${u.name.charAt(0)}</div>
            <div class="flex-1"><p class="text-base font-bold">${u.name}</p><p class="text-xs text-slate-500">@${u.username}</p><div class="mt-1">${badge(RL[u.role] || u.role, RC[u.role] || 'slate')}</div></div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button id="btn-name" class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100 border border-slate-100 transition"><span class="material-symbols-outlined text-base text-primary">edit</span>Editar Nome</button>
            <button id="btn-pass" class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100 border border-slate-100 transition"><span class="material-symbols-outlined text-base text-primary">lock_reset</span>Mudar Senha</button>
          </div>
        </div>
      </section>
      <section>
        <button id="btn-logout" class="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 transition shadow-sm"><span class="material-symbols-outlined text-lg">logout</span>Sair da Conta</button>
      </section>
    </div>

    ${['ADMIN', 'SUPERVISOR'].includes(u.role) ? `
    <!-- TAG TEAM -->
    <div id="tab-team" class="tab-content hidden space-y-6">
      <section>
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Gerenciar Usuários</h3>
          <button id="btn-add-user" class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition shadow-sm"><span class="material-symbols-outlined text-[16px]">person_add</span>Adicionar</button>
        </div>
        
        <div class="bg-white rounded-xl border border-slate-100 p-3 mb-4 shadow-sm flex flex-col md:flex-row gap-2">
          <div class="relative flex-1">
            <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input id="team-search" class="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:ring-2 focus:ring-primary/20" placeholder="Buscar por nome..."/>
          </div>
          <select id="team-role-filter" class="md:w-40 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Todos Perfis</option>
            ${(store.currentUser.role === 'ADMIN' ? Object.entries(RL) : Object.entries(RL).filter(([k]) => !['ADMIN', 'SUPERVISOR'].includes(k)))
        .map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
          <select id="team-sort" class="md:w-44 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs outline-none focus:ring-2 focus:ring-primary/20">
            <option value="alpha">Ordem Alfabética</option>
            <option value="role">Por Cargo</option>
          </select>
        </div>

        <div id="team-list"></div>
      </section>
    </div>

    <!-- TAG TOOLS -->
    <div id="tab-tools" class="tab-content hidden space-y-6">
      <section>
        <div class="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100 shadow-sm">
          ${toolLink('groups', 'Gerações', `${(store.generations || []).length} gerações cadastradas`, '#/generations', 'indigo')}
          ${toolLink('description', 'Formulários Customizados', `${store.forms.length} formulários`, '#/forms', 'emerald')}
          ${toolLink('assignment', 'Fila de Triagem', `${store.triageQueue.filter(t => t.status === 'new').length} membros pendentes`, '#/triage', 'orange')}
          ${u.role === 'ADMIN' ? `
          ${toolLink('key', 'API — Chaves de Acesso', 'Gerencie chaves para integração programática', '#/api-keys', 'indigo')}
          ${toolLink('webhook', 'Webhooks', 'Envie eventos para sistemas externos', '#/webhooks', 'purple')}
          ${toolLink('article', 'Documentação da API', 'Referência completa de endpoints', '#/api-docs', 'slate')}` : ''}
        </div>
      </section>
      <section class="pt-2">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Trilhas & Retiros</h3>
          <button id="btn-add-track" class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition shadow-sm"><span class="material-symbols-outlined text-[16px]">add_circle</span>Nova Trilha</button>
        </div>
        <div id="tracks-list"></div>
      </section>
    </div>` : ''}

    <!-- TAG SYSTEM -->
    ${u.role === 'ADMIN' ? `<div id="tab-system" class="tab-content hidden space-y-8">

      <section>
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1 flex items-center gap-2"><span class="material-symbols-outlined text-lg text-primary">domain</span>Informações da Conta</h3>
        <div id="org-account-card" class="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div class="flex items-center justify-center py-4 text-slate-400"><span class="material-symbols-outlined animate-spin text-2xl">progress_activity</span></div>
        </div>
      </section>

      <section>
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1 flex items-center gap-2"><span class="material-symbols-outlined text-lg text-primary">palette</span>Branding & Identidade Visual</h3>
        <form id="branding-form" class="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label class="text-xs font-semibold text-slate-600 mb-1 block">Nome do Sistema</label>
                  <input id="cfg-app-name" type="text" value="${store.systemSettings?.appName || 'Gestão Celular'}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
              </div>
              <div>
                  <label class="text-xs font-semibold text-slate-600 mb-1 block">Cor Primária (Hexadecimal)</label>
                  <div class="flex gap-2">
                    <input id="cfg-primary-color" type="color" value="${store.systemSettings?.primaryColor || '#135bec'}" class="h-9 w-12 p-1 rounded cursor-pointer border border-slate-200 bg-slate-50"/>
                    <input id="cfg-primary-hex" type="text" value="${store.systemSettings?.primaryColor || '#135bec'}" class="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 uppercase"/>
                  </div>
              </div>
          </div>
          <div class="grid grid-cols-1 gap-4">
                  <!-- Logo Container -->
                  <div class="mb-5">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Logo do Sistema (Link Direto)</label>
                    <div class="flex flex-col sm:flex-row gap-3">
                      <div class="flex-1 w-full flex gap-2">
                        <div class="relative flex-1">
                          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">image</span>
                          <input id="cfg-logo-url" type="text" value="${store.systemSettings?.logoUrl || ''}" placeholder="Ex: https://... ou clique ao lado 👉" class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
                        </div>
                        <label class="w-10 h-10 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center cursor-pointer hover:bg-primary hover:text-white transition group relative shrink-0" title="Fazer Upload">
                          <input type="file" id="cfg-logo-upload" accept="image/*" class="hidden">
                          <span class="material-symbols-outlined text-xl">upload</span>
                        </label>
                      </div>
                      <div id="cfg-logo-preview" class="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg ${store.systemSettings?.logoUrl ? '' : 'hidden'} sm:w-64 shrink-0 h-16 w-full">
                        <div class="w-10 h-10 rounded bg-white flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden">
                          <img id="cfg-logo-img" src="${store.systemSettings?.logoUrl || ''}" class="max-w-full max-h-full object-contain" />
                        </div>
                        <button type="button" id="cfg-logo-clear" class="text-[11px] text-red-500 font-semibold hover:underline mt-auto mb-auto ml-auto">Remover</button>
                      </div>
                    </div>
                    <p class="text-[10px] text-slate-400 mt-1">Insira uma URL direta ou faça upload de um arquivo. Para melhor resultado, use uma imagem com fundo transparente (PNG).</p>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                    <div>
                      <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nome da Congregação / Igreja</label>
                      <input id="cfg-congregation-name" type="text" value="${store.systemSettings?.congregationName || ''}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Igreja Metodista"/>
                    </div>
                    <div>
                      <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Núcleo / Região (Nº)</label>
                      <input id="cfg-nucleus" type="text" value="${store.systemSettings?.nucleus || ''}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: 5ª Região"/>
                    </div>
                    <div>
                      <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Pastor Titular / Responsável</label>
                      <input id="cfg-pastor-name" type="text" value="${store.systemSettings?.pastorName || ''}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Pr. João Silva"/>
                    </div>
                    <div>
                      <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Endereço da Sede</label>
                      <input id="cfg-congregation-address" type="text" value="${store.systemSettings?.congregationAddress || ''}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Rua Central, 123 - Centro"/>
                    </div>
                  </div>

                  <div class="border-t border-slate-100 pt-4 mt-4">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Texto / Propósito na Tela de Login</label>
                    <textarea id="cfg-login-msg" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none h-20">${store.systemSettings?.loginMessage || 'Transformando o cuidado pastoral...'}</textarea>
                    <p class="text-[10px] text-slate-400 mt-1">Este texto aparece abaixo do logo na tela de login.</p>
                  </div><button type="submit" class="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-opacity-90 transition mt-2 flex items-center justify-center gap-2"><span class="material-symbols-outlined text-lg">save</span> Salvar Identidade</button>
        </form>
      </section>

      <section>
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1 flex items-center gap-2"><span class="material-symbols-outlined text-lg text-primary">dashboard_customize</span>Alertas Automáticos no Dashboard</h3>
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden" id="dash-actions-section">
          <div class="p-4 space-y-4">
            <div class="flex items-center justify-between gap-4 pb-3 border-b border-slate-50">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0"><span class="material-symbols-outlined text-base">person_alert</span></div>
                <div>
                  <p class="text-sm font-semibold text-slate-800">Sem Visita Prolongada</p>
                  <p class="text-[11px] text-slate-500 leading-snug">Alerta para membros sem visita há muito tempo</p>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <input id="cfg-novisit-days" type="number" min="1" max="365" value="60" class="w-14 px-1 py-1 rounded-md border border-slate-200 bg-slate-50 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-primary/20"/>
                <span class="text-[10px] text-slate-400 font-medium">dias</span>
                <label class="relative inline-flex items-center cursor-pointer ml-1">
                  <input type="checkbox" id="cfg-novisit-en" class="sr-only peer" checked>
                  <div class="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
            <div class="flex items-center justify-between gap-4 pb-3 border-b border-slate-50">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0"><span class="material-symbols-outlined text-base">water_drop</span></div>
                <div>
                  <p class="text-sm font-semibold text-slate-800">Pendentes de Batismo</p>
                  <p class="text-[11px] text-slate-500 leading-snug">Membros listados que ainda não foram às águas</p>
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="cfg-baptism-en" class="sr-only peer" checked>
                <div class="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div class="flex items-center justify-between gap-4 pb-3 border-b border-slate-50">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0"><span class="material-symbols-outlined text-base">route</span></div>
                <div>
                  <p class="text-sm font-semibold text-slate-800">Atraso na Consolidação</p>
                  <p class="text-[11px] text-slate-500 leading-snug">Novos convertidos recém captados</p>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <input id="cfg-cons-days" type="number" min="1" max="90" value="15" class="w-14 px-1 py-1 rounded-md border border-slate-200 bg-slate-50 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-primary/20"/>
                <span class="text-[10px] text-slate-400 font-medium">dias</span>
                <label class="relative inline-flex items-center cursor-pointer ml-1">
                  <input type="checkbox" id="cfg-cons-en" class="sr-only peer" checked>
                  <div class="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 shrink-0"><span class="material-symbols-outlined text-base">handshake</span></div>
                <div>
                  <p class="text-sm font-semibold text-slate-800">Reconciliações</p>
                  <p class="text-[11px] text-slate-500 leading-snug">Pessoas marcadas com perfil de reconciliação</p>
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="cfg-recon-en" class="sr-only peer" checked>
                <div class="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
          <div class="px-4 pb-4">
            <button id="btn-save-dash-cfg" class="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary/90 active:scale-[.98] transition-all"><span class="material-symbols-outlined text-lg">save</span>Salvar Configurações</button>
          </div>
        </div>
      </section>

      <section>
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1 flex items-center gap-2"><span class="material-symbols-outlined text-lg text-emerald-500">notifications_active</span>Push Notifications</h3>
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden" id="notif-cfg-section">
          <div class="p-4 space-y-4">
            <div class="flex items-center justify-between gap-4 pb-3 border-b border-slate-50">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0"><span class="material-symbols-outlined text-base">person_add</span></div>
                <div><p class="text-sm font-semibold text-slate-800">Novo membro na célula</p><p class="text-[11px] text-slate-500">Ao adicionar ou transferir um membro</p></div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="ncfg-newmember" class="sr-only peer" checked>
                <div class="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            <div class="flex items-center justify-between gap-4 pb-3 border-b border-slate-50">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0"><span class="material-symbols-outlined text-base">calendar_add_on</span></div>
                <div><p class="text-sm font-semibold text-slate-800">Nova programação</p><p class="text-[11px] text-slate-500">Quando um evento é adicionado ao calendário</p></div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="ncfg-newevent" class="sr-only peer" checked>
                <div class="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
            <div class="flex items-center justify-between gap-4 pb-3 border-b border-slate-50">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0"><span class="material-symbols-outlined text-base">edit_calendar</span></div>
                <div><p class="text-sm font-semibold text-slate-800">Programação atualizada</p><p class="text-[11px] text-slate-500">Quando a data ou título de um evento muda</p></div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="ncfg-updatedevent" class="sr-only peer" checked>
                <div class="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 shrink-0"><span class="material-symbols-outlined text-base">alarm</span></div>
                <div><p class="text-sm font-semibold text-slate-800">Lembrete diário</p><p class="text-[11px] text-slate-500">Aviso automático de agenda de amanhã</p></div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="ncfg-dailyreminder" class="sr-only peer" checked>
                <div class="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
              </label>
            </div>
          </div>
          <div class="px-4 pb-4">
            <button id="btn-save-notif-cfg" class="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 active:scale-[.98] transition-all"><span class="material-symbols-outlined text-lg">save</span>Salvar Notificações</button>
          </div>
        </div>
      </section>

      <section>
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1 flex items-center gap-2"><span class="material-symbols-outlined text-lg text-primary">backup</span>Backup & Restauração de Dados</h3>
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-6">
          <div class="flex flex-col sm:flex-row items-center gap-4">
            <div class="flex-1">
              <p class="text-sm font-semibold text-slate-800">Exportar Backup Completo</p>
              <p class="text-[11px] text-slate-500 leading-snug">Gera um arquivo JSON contendo todos os dados da igreja (pessoas, células, eventos, logs, etc).</p>
            </div>
            <button id="btn-backup-download" class="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary/90 transition shadow-sm flex items-center justify-center gap-2"><span class="material-symbols-outlined text-lg">download</span> Baixar Backup</button>
          </div>
          
          <div class="border-t border-slate-50 pt-5">
            <div class="flex flex-col sm:flex-row items-center gap-4">
              <div class="flex-1">
                <p class="text-sm font-semibold text-slate-800">Restaurar do Arquivo</p>
                <p class="text-[11px] text-slate-500 leading-snug">Substitui permanentemente TODOS os dados atuais por um arquivo de backup anterior (.json).</p>
              </div>
              <div class="w-full sm:w-auto">
                <input type="file" id="inp-restore-upload" accept=".json" class="hidden">
                <button id="btn-restore-start" class="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-100 text-[13px] font-bold hover:bg-orange-100 transition shadow-sm flex items-center justify-center gap-2"><span class="material-symbols-outlined text-lg">upload_file</span> Restaurar Backup</button>
              </div>
            </div>
          </div>
          <p class="text-[10px] text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100 font-medium"><b>Aviso:</b> A restauração é uma ação destrutiva e reiniciará o servidor para garantir a integridade dos dados.</p>
        </div>
      </section>

      <section class="pb-10">
        <div class="bg-red-50 border border-red-100 rounded-xl p-6 text-center shadow-sm">
          <div class="w-12 h-12 rounded-full bg-red-100 mx-auto flex items-center justify-center text-red-600 mb-3"><span class="material-symbols-outlined text-2xl">warning</span></div>
          <h3 class="text-base font-bold text-red-700">Ação Destrutiva (Reset)</h3>
          <p class="text-xs text-red-500/80 mt-1 max-w-sm mx-auto mb-4 leading-relaxed">Apaga todas as entidades permanentemente: Membros, Eventos, Células. Não há recuperação.</p>
          <button id="btn-reset" class="px-5 py-2 rounded-lg bg-white border border-red-200 text-xs font-bold text-red-600 outline-none hover:bg-red-600 hover:text-white transition shadow-sm"><span class="material-symbols-outlined text-[14px] align-middle mr-1 relative -top-[1px]">delete_forever</span>Deletar tudo</button>
        </div>
      </section>

    </div>
    
    <!-- TAG CUSTOM FIELDS -->
    <div id="tab-custom-fields" class="tab-content hidden space-y-6">
      <section>
        <div class="flex justify-between items-center mb-3 ml-1">
          <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2"><span class="material-symbols-outlined text-lg text-primary">analytics</span>Métricas da Célula</h3>
        </div>
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-5 pb-6">
          <p class="text-xs text-slate-500 mb-4 leading-relaxed">Estes campos aparecerão na aba de métricas de cada célula, onde o líder pode registrar a qualquer momento.</p>
          
          <div id="custom-fields-list" class="space-y-2 mb-4">
             <!-- Fields will be dynamically added here -->
          </div>

          <div class="flex gap-2">
            <input id="new-custom-field-input" type="text" class="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ex: Cestas Básicas, Discipulados..."/>
            <button id="btn-add-custom-field" class="px-4 py-2 rounded-lg bg-primary text-white font-bold text-sm hover:bg-primary/90 transition shrink-0 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">add_circle</span>Adicionar</button>
          </div>
        </div>
      </section>
    </div>

    <!-- TAB LOGS -->
    <div id="tab-logs" class="tab-content hidden space-y-4">
      <section>
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1 flex items-center gap-2"><span class="material-symbols-outlined text-lg text-primary">history</span>Logs de Atividade</h3>
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2" id="log-filters">
            <select id="lf-action" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Todas as ações</option>
              <option value="LOGIN">Login</option>
              <option value="LOGIN_FAIL">Falha de Login</option>
              <option value="CREATE">Criação</option>
              <option value="UPDATE">Edição</option>
              <option value="DELETE">Exclusão</option>
              <option value="EXPORT">Exportação</option>
            </select>
            <select id="lf-resource" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Todos os recursos</option>
              <option value="auth">Autenticação</option>
              <option value="people">Pessoas</option>
              <option value="cells">Células</option>
              <option value="users">Usuários</option>
              <option value="attendance">Chamadas</option>
              <option value="settings">Configurações</option>
            </select>
            <input id="lf-from" type="date" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="De">
            <input id="lf-to" type="date" class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Até">
          </div>
          <div class="flex gap-2">
            <button id="btn-log-filter" class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">filter_list</span>Filtrar</button>
            <button id="btn-log-clear" class="px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition flex items-center gap-1.5 ml-auto"><span class="material-symbols-outlined text-[16px]">delete_sweep</span>Limpar Logs</button>
          </div>
          <div id="logs-table-container" class="overflow-x-auto">
            <div class="flex items-center justify-center py-8 text-slate-400"><span class="material-symbols-outlined animate-spin text-3xl">progress_activity</span></div>
          </div>
        </div>
      </section>
    </div>
    ` : ''}

  </div>
  ${bottomNav('settings')}`;

  renderTeam();
  renderTracks();

  const ACTION_BADGE = {
    LOGIN: { label: 'Login', cls: 'bg-emerald-100 text-emerald-800' },
    LOGIN_FAIL: { label: 'Falha Login', cls: 'bg-red-100 text-red-800' },
    CREATE: { label: 'Criação', cls: 'bg-blue-100 text-blue-800' },
    UPDATE: { label: 'Edição', cls: 'bg-amber-100 text-amber-800' },
    DELETE: { label: 'Exclusão', cls: 'bg-red-100 text-red-700' },
    EXPORT: { label: 'Exportação', cls: 'bg-purple-100 text-purple-800' },
  };
  const RESOURCE_LABEL = { auth: '🔑 Auth', people: '👤 Pessoas', cells: '🏠 Células', users: '👥 Usuários', attendance: '📋 Chamadas', settings: '⚙️ Config' };

  async function initLogs() {
    const container = document.getElementById('logs-table-container');
    if (!container) return;
    container.innerHTML = `<div class="flex items-center justify-center py-8 text-slate-400"><span class="material-symbols-outlined animate-spin text-3xl">progress_activity</span></div>`;

    const filters = {
      action: document.getElementById('lf-action')?.value || '',
      resource: document.getElementById('lf-resource')?.value || '',
      from: document.getElementById('lf-from')?.value || '',
      to: document.getElementById('lf-to')?.value || '',
      limit: 200
    };

    const logs = await store.fetchActivityLogs(filters);

    if (!logs.length) {
      container.innerHTML = `<p class="text-sm text-slate-400 text-center py-8">Nenhum registro encontrado</p>`;
      return;
    }

    const rows = logs.map(l => {
      const ab = ACTION_BADGE[l.action] || { label: l.action, cls: 'bg-slate-100 text-slate-700' };
      const dt = new Date(l.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<tr class="border-b border-slate-100 hover:bg-slate-50 transition">
        <td class="py-2.5 pr-3 text-xs text-slate-500 whitespace-nowrap">${dt}</td>
        <td class="py-2.5 pr-3 text-xs font-medium text-slate-800 whitespace-nowrap">${l.userName || '—'}</td>
        <td class="py-2.5 pr-3"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${ab.cls}">${ab.label}</span></td>
        <td class="py-2.5 pr-3 text-xs text-slate-600 whitespace-nowrap">${RESOURCE_LABEL[l.resource] || l.resource}</td>
        <td class="py-2.5 pr-3 text-xs text-slate-500 max-w-[180px] truncate" title="${l.detail || ''}">${l.detail || '—'}</td>
        <td class="py-2.5 text-[10px] text-slate-400 whitespace-nowrap font-mono">${l.ip || '—'}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `<table class="w-full text-left">
      <thead><tr class="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
        <th class="pb-2 pr-3">Data/Hora</th><th class="pb-2 pr-3">Usuário</th><th class="pb-2 pr-3">Ação</th>
        <th class="pb-2 pr-3">Recurso</th><th class="pb-2 pr-3">Detalhe</th><th class="pb-2">IP</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="text-[10px] text-slate-400 mt-2 text-right">Mostrando ${logs.length} registro(s)</p>`;
  }

  // Tabs routing manual bindings
  document.querySelectorAll('.settings-tab').forEach(btn => {
    btn.onclick = (e) => {
      document.querySelectorAll('.settings-tab').forEach(b => {
        b.classList.remove('active', 'text-primary', 'border-primary');
        b.classList.add('text-slate-500', 'border-transparent');
      });
      const t = e.currentTarget;
      t.classList.remove('text-slate-500', 'border-transparent');
      t.classList.add('active', 'text-primary', 'border-primary');

      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
      document.getElementById(t.dataset.target).classList.remove('hidden');
      if (t.dataset.target === 'tab-logs') initLogs();
    };
  });

  document.getElementById('btn-name')?.addEventListener('click', () => editNameModal());
  document.getElementById('btn-pass')?.addEventListener('click', () => editPassModal());
  document.getElementById('btn-add-user')?.addEventListener('click', () => userModal());

  const tSearch = document.getElementById('team-search');
  const tRole = document.getElementById('team-role-filter');
  const tSort = document.getElementById('team-sort');

  if (tSearch) tSearch.oninput = renderTeam;
  if (tRole) tRole.onchange = renderTeam;
  if (tSort) tSort.onchange = renderTeam;

  document.getElementById('btn-logout')?.addEventListener('click', () => { store.logout(); document.getElementById('sidebar').classList.add('sidebar-hidden'); location.hash = '/login'; toast('Deslogado') });

  if (u.role === 'ADMIN') {
    // Carrega e renderiza informações da conta da organização
    store.fetchOrgSettings().then(org => {
      const card = document.getElementById('org-account-card');
      if (!card) return;

      const PLAN_LABEL = { demo: 'Demo', standard: 'Standard' };
      const PLAN_COLOR = { demo: 'orange', standard: 'emerald' };
      const STATUS_LABEL = { active: 'Ativo', suspended: 'Suspenso' };
      const STATUS_COLOR = { active: 'emerald', suspended: 'red' };

      const plan = org.plan || 'BASIC';
      const status = org.status || 'active';
      const saasDomain = org.subdomain ? `${org.subdomain}` : org.slug;
      const customDomain = org.customDomain || null;
      const createdAt = org.createdAt ? new Date(org.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

      const planCls = {
        slate: 'bg-slate-100 text-slate-700', emerald: 'bg-emerald-100 text-emerald-700',
        orange: 'bg-orange-100 text-orange-700'
      }[PLAN_COLOR[plan] || 'slate'];
      const statusCls = { emerald: 'bg-emerald-100 text-emerald-700', red: 'bg-red-100 text-red-700' }[STATUS_COLOR[status] || 'slate'];
      const cellsCount = store.cells?.length ?? 0;
      const isDemo = plan === 'demo';
      const cellsLimit = isDemo ? 2 : null;

      card.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nome da Organização</p>
            <p class="text-sm font-semibold text-slate-800">${org.name || '—'}</p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Identificador (Slug)</p>
            <p class="text-sm font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block">${org.slug || '—'}</p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Plano</p>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-bold px-2 py-0.5 rounded-full ${planCls}">${PLAN_LABEL[plan] || plan}</span>
              ${isDemo ? `<span class="text-xs text-orange-600 font-semibold">Células: ${cellsCount}/${cellsLimit} — <a href="#" class="underline">Upgrade</a></span>` : `<span class="text-xs text-slate-400">Células: ${cellsCount} / ilimitado</span>`}
            </div>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</p>
            <span class="text-xs font-bold px-2 py-0.5 rounded-full ${statusCls}">${STATUS_LABEL[status] || status}</span>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Subdomínio / URL</p>
            <p class="text-xs text-slate-600">${saasDomain}</p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Domínio Customizado</p>
            <p class="text-xs text-slate-600">${customDomain || '<span class="text-slate-400 italic">Não configurado</span>'}</p>
          </div>
          <div class="sm:col-span-2">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Conta criada em</p>
            <p class="text-xs text-slate-500">${createdAt}</p>
          </div>
        </div>`;
    }).catch(() => {
      const card = document.getElementById('org-account-card');
      if (card) card.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Não foi possível carregar as informações da conta.</p>`;
    });

    document.getElementById('btn-log-filter')?.addEventListener('click', initLogs);
    document.getElementById('btn-log-clear')?.addEventListener('click', async () => {
      if (!confirm('Tem certeza que deseja limpar TODOS os logs? Esta ação não pode ser desfeita.')) return;
      await store.clearActivityLogs();
      toast('Logs limpos!');
      initLogs();
    });

    // Carrega config atual nos inputs
    store.fetchConfig().then(cfg => {
      const nvEn = document.getElementById('cfg-novisit-en');
      const nvDays = document.getElementById('cfg-novisit-days');
      const bpEn = document.getElementById('cfg-baptism-en');
      const cnEn = document.getElementById('cfg-cons-en');
      const cnDays = document.getElementById('cfg-cons-days');
      const rcEn = document.getElementById('cfg-recon-en');
      if (nvEn) nvEn.checked = cfg.noVisit?.enabled !== false;
      if (nvDays) nvDays.value = cfg.noVisit?.days ?? 60;
      if (bpEn) bpEn.checked = cfg.baptism?.enabled !== false;
      if (cnEn) cnEn.checked = cfg.consolidation?.enabled !== false;
      if (cnDays) cnDays.value = cfg.consolidation?.days ?? 15;
      if (rcEn) rcEn.checked = cfg.reconciliation?.enabled !== false;
    });

    // Salvar Branding
    const bForm = document.getElementById('branding-form');
    if (bForm) {
      const cPicker = document.getElementById('cfg-primary-color');
      const cHex = document.getElementById('cfg-primary-hex');
      cPicker.addEventListener('input', e => { cHex.value = e.target.value.toUpperCase(); });
      cHex.addEventListener('input', e => { if (/^#[0-9A-F]{6}$/i.test(e.target.value)) cPicker.value = e.target.value; });

      const fInput = document.getElementById('cfg-logo-upload'); // Changed ID
      const uInput = document.getElementById('cfg-logo-url');
      const pBox = document.getElementById('cfg-logo-preview');
      const pImg = document.getElementById('cfg-logo-img');
      const pClear = document.getElementById('cfg-logo-clear');

      if (fInput) {
        fInput.addEventListener('change', e => {
          if (e.target.files.length) {
            const file = e.target.files[0];
            if (uInput) uInput.value = ''; // Clear URL input if file is selected
            if (pBox && pImg) {
              pImg.src = URL.createObjectURL(file);
              pBox.classList.remove('hidden');
            }
          } else {
            if (pBox && uInput && !uInput.value) pBox.classList.add('hidden');
          }
        });
      }

      if (uInput) {
        uInput.addEventListener('input', e => {
          const val = e.target.value.trim();
          if (val) {
            if (pImg) pImg.src = val;
            if (pBox) pBox.classList.remove('hidden');
            if (fInput) fInput.value = ''; // Clear file input if URL is entered
          } else {
            if (pBox && (!fInput || !fInput.files.length)) pBox.classList.add('hidden');
          }
        });
      }

      if (pClear) {
        pClear.onclick = () => {
          if (uInput) uInput.value = '';
          if (fInput) fInput.value = '';
          if (pBox) pBox.classList.add('hidden');
          if (pImg) pImg.src = '';
        };
      }

      bForm.onsubmit = async (ev) => {
        ev.preventDefault();
        const btn = bForm.querySelector('button[type="submit"]');
        const origText = btn.innerHTML;

        // Capture inputs locally to avoid null errors after await
        const appNameInp = document.getElementById('cfg-app-name');
        const primaryHexInp = document.getElementById('cfg-primary-hex');
        const loginMsgInp = document.getElementById('cfg-login-msg');
        const congNameInp = document.getElementById('cfg-congregation-name');
        const nucleusInp = document.getElementById('cfg-nucleus');
        const pastorNameInp = document.getElementById('cfg-pastor-name');
        const addrInp = document.getElementById('cfg-congregation-address');
        const urlInp = document.getElementById('cfg-logo-url');

        btn.innerHTML = '<span class="material-symbols-outlined animate-spin mr-2">refresh</span> Salvando Identidade...';
        btn.disabled = true;

        try {
          let finalLogoUrl = urlInp?.value.trim() || '';

          if (fInput && fInput.files.length > 0) {
            const uploadRes = await store.uploadSystemLogo(fInput.files[0]);
            finalLogoUrl = uploadRes.url;
          }

          const data = {
            appName: appNameInp?.value.trim() || 'Gestão Celular',
            primaryColor: primaryHexInp?.value.trim() || '#135bec',
            logoUrl: finalLogoUrl,
            loginMessage: loginMsgInp?.value.trim() || '',
            congregationName: congNameInp?.value.trim() || '',
            nucleus: nucleusInp?.value.trim() || '',
            pastorName: pastorNameInp?.value.trim() || '',
            congregationAddress: addrInp?.value.trim() || '',
          };
          await store.updateSystemSettings(data);
          toast('Identidade Visual salva e aplicada!');

          if (fInput) fInput.value = '';
          if (urlInp) urlInp.value = finalLogoUrl;

          // Re-render only if still in settings
          if (location.hash.startsWith('#/settings')) {
            setTimeout(settingsView, 300);
          }
        } catch (e) {
          toast(e.message || 'Erro ao salvar as configurações SaaS', 'error');
        } finally {
          if (btn) {
            btn.innerHTML = origText;
            btn.disabled = false;
          }
        }
      };
    }

    // Salvar configurações
    document.getElementById('btn-save-dash-cfg')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-save-dash-cfg');
      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">refresh</span>Salvando...';
      btn.disabled = true;
      try {
        const dashboardActions = {
          noVisit: { enabled: document.getElementById('cfg-novisit-en').checked, days: parseInt(document.getElementById('cfg-novisit-days').value) || 60 },
          baptism: { enabled: document.getElementById('cfg-baptism-en').checked },
          consolidation: { enabled: document.getElementById('cfg-cons-en').checked, days: parseInt(document.getElementById('cfg-cons-days').value) || 15 },
          reconciliation: { enabled: document.getElementById('cfg-recon-en').checked }
        };
        await store.saveConfig(dashboardActions);
        toast('Configurações salvas!');
      } catch (e) {
        toast('Erro ao salvar configurações', 'error');
      }
      btn.innerHTML = orig;
      btn.disabled = false;
    });

    // Carrega config de Notificações via API
    store.apiFetch('/dash/config').then(full => {
      const nc = full.notificationConfig || {};
      const nm = document.getElementById('ncfg-newmember');
      const ne = document.getElementById('ncfg-newevent');
      const ue = document.getElementById('ncfg-updatedevent');
      const dr = document.getElementById('ncfg-dailyreminder');
      if (nm) nm.checked = nc.newMember?.enabled !== false;
      if (ne) ne.checked = nc.newEvent?.enabled !== false;
      if (ue) ue.checked = nc.updatedEvent?.enabled !== false;
      if (dr) dr.checked = nc.dailyReminder?.enabled !== false;
    }).catch(() => { });

    document.getElementById('btn-save-notif-cfg')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-save-notif-cfg');
      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">refresh</span>Salvando...';
      btn.disabled = true;
      try {
        const notificationConfig = {
          newMember: { enabled: document.getElementById('ncfg-newmember').checked },
          newEvent: { enabled: document.getElementById('ncfg-newevent').checked },
          updatedEvent: { enabled: document.getElementById('ncfg-updatedevent').checked },
          dailyReminder: { enabled: document.getElementById('ncfg-dailyreminder').checked }
        };
        await store.apiFetch('/dash/config', {
          method: 'PUT',
          body: JSON.stringify({ notificationConfig, role: store.currentUser.role })
        });
        toast('Configurações de notificação salvas!');
      } catch (e) {
        toast('Erro ao salvar', 'error');
      }
      btn.innerHTML = orig;
      btn.disabled = false;
    });

    document.getElementById('btn-backup-download')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-backup-download');
      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">refresh</span>Gerando...';
      btn.disabled = true;
      try {
        await store.downloadBackup();
        toast('Backup concluído com sucesso!');
      } catch (e) {
        toast('Erro ao gerar backup', 'error');
      }
      btn.innerHTML = orig;
      btn.disabled = false;
    });

    const inpRestore = document.getElementById('inp-restore-upload');
    document.getElementById('btn-restore-start')?.addEventListener('click', () => inpRestore.click());

    inpRestore?.addEventListener('change', async (e) => {
      if (!e.target.files.length) return;
      const file = e.target.files[0];

      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target.result);

          openModal(`<div class="p-6 text-center">
            <div class="w-16 h-16 rounded-full bg-orange-100 mx-auto mb-4 flex items-center justify-center">
              <span class="material-symbols-outlined text-orange-600 text-4xl">warning</span>
            </div>
            <h3 class="text-lg font-extrabold text-slate-900 mb-2">Confirmar Restauração</h3>
            <p class="text-sm text-slate-600 mb-5">Você está prestes a substituir <b>TODOS OS DADOS</b> do sistema pelo backup:<br><br><span class="text-slate-800 font-bold">${file.name}</span><br><br><span class="text-red-500 font-semibold">Esta ação é irreversível e o servidor será reiniciado.</span></p>
            <div class="flex gap-3">
              <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="flex-1 py-3 border border-slate-200 rounded-xl bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
              <button id="btn-confirm-restore" class="flex-1 py-3 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition shadow-sm">Sim, Restaurar Tudo</button>
            </div>
          </div>`);

          document.getElementById('btn-confirm-restore').onclick = async () => {
            const btn = document.getElementById('btn-confirm-restore');
            btn.innerHTML = '<span class="material-symbols-outlined animate-spin mr-2">refresh</span> Restaurando...';
            btn.disabled = true;
            try {
              await store.restoreBackup(data);
              toast('Restauração concluída! Saindo...');
              setTimeout(() => {
                store.logout();
                location.reload();
              }, 2000);
            } catch (err) {
              toast('Erro na restauração: ' + err.message, 'error');
              closeModal();
            }
          };
        } catch (err) {
          toast('Arquivo de backup inválido', 'error');
        }
        inpRestore.value = ''; // Reset for next selection
      };
      reader.readAsText(file);
    });

    document.getElementById('btn-add-track')?.addEventListener('click', () => trackModal());
    document.getElementById('btn-reset').onclick = () => {
      openModal(`<div class="p-6 text-center">
        <div class="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
          <span class="material-symbols-outlined text-red-600 text-4xl">warning</span>
        </div>
        <h3 class="text-lg font-extrabold text-slate-900 mb-2">Reset Completo do Sistema</h3>
        <p class="text-sm text-slate-600 mb-5">Você está prestes a <b>apagar definitivamente</b> todo o banco de dados da igreja.<br><br><span class="text-red-600 font-bold">Esta ação não pode ser desfeita.</span></p>
        <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6 text-left shadow-inner">
          <label class="text-[11px] font-bold text-slate-500 uppercase block mb-1.5 ml-1">Para confirmar, digite APAGAR</label>
          <input id="inp-confirm-reset" type="text" placeholder="APAGAR" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold uppercase tracking-wide outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20" autocomplete="off" />
        </div>
        <div class="flex gap-3">
          <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="flex-1 py-3 border border-slate-200 rounded-xl bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:shadow-sm transition">Cancelar</button>
          <button id="btn-confirm-factory-reset" class="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm" disabled>Exterminar Dados</button>
        </div>
      </div>`);

      const inp = document.getElementById('inp-confirm-reset');
      const btnConfirm = document.getElementById('btn-confirm-factory-reset');

      inp.oninput = (e) => {
        btnConfirm.disabled = e.target.value.trim().toUpperCase() !== 'APAGAR';
      };

      btnConfirm.onclick = () => {
        btnConfirm.innerHTML = '<span class="material-symbols-outlined animate-spin mr-2">refresh</span> Apagando...';
        setTimeout(() => store.resetSystem(), 600);
      };
    };

    // --- Custom Fields Logic (Auto-Save via dedicated endpoint) ---
    let editingFields = [];

    // Fetch current fields from dedicated endpoint first
    async function loadCellFields() {
      // Always fetch fresh fields from dedicated endpoint
      const rawFields = await store.getCellFields();
      editingFields = (rawFields || '').split(',').map(s => s.trim()).filter(Boolean);
      renderCustomFieldsList();
    }

    async function saveCustomFields() {
      try {
        await store.saveCellFields(editingFields.join(', '));
        const statusEl = document.getElementById('cf-status');
        if (statusEl) {
          statusEl.textContent = 'Salvo ✓';
          setTimeout(() => {
            const el = document.getElementById('cf-status');
            if (el) el.textContent = '';
          }, 2000);
        }
      } catch (e) {
        toast('Erro ao salvar métrica', 'error');
      }
    }

    function renderCustomFieldsList() {
      const container = document.getElementById('custom-fields-list');
      if (!container) return;
      if (editingFields.length === 0) {
        container.innerHTML = '<div class="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">Nenhuma métrica cadastrada</div>';
        return;
      }
      container.innerHTML = editingFields.map((f, i) => `
        <div class="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-lg group transition hover:border-slate-200 hover:bg-slate-100">
          <div class="flex items-center gap-2"><span class="material-symbols-outlined text-slate-400 text-base">drag_indicator</span><span class="text-sm font-semibold text-slate-700">${f}</span></div>
          <button type="button" class="btn-remove-cf w-7 h-7 flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition" data-idx="${i}"><span class="material-symbols-outlined text-lg">delete</span></button>
        </div>
      `).join('');

      // Add or reuse the inline status element
      let statusEl = document.getElementById('cf-status');
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'cf-status';
        statusEl.className = 'text-xs text-green-600 font-semibold text-right px-1 h-4 transition-all';
        container.after(statusEl);
      }

      document.querySelectorAll('.btn-remove-cf').forEach(btn => {
        btn.onclick = async () => {
          editingFields.splice(parseInt(btn.dataset.idx, 10), 1);
          renderCustomFieldsList();
          await saveCustomFields();
        };
      });
    }

    loadCellFields(); // fetch from dedicated /api/settings/cell-fields

    async function addField() {
      const inp = document.getElementById('new-custom-field-input');
      const val = inp?.value?.trim();
      if (!val) return;
      if (editingFields.includes(val)) { toast('Este campo já existe', 'warning'); return; }
      editingFields.push(val);
      inp.value = '';
      inp.focus();
      renderCustomFieldsList();
      await saveCustomFields();
    }

    document.getElementById('btn-add-custom-field')?.addEventListener('click', addField);
    document.getElementById('new-custom-field-input')?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') addField();
    });
  }
}

function renderTeam() {
  const q = document.getElementById('team-search')?.value.toLowerCase() || '';
  const rf = document.getElementById('team-role-filter')?.value || '';
  const sort = document.getElementById('team-sort')?.value || 'alpha';

  let others = store.users.filter(u => u.id !== store.currentUser.id);

  if (q) others = others.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  if (rf) others = others.filter(u => u.role === rf);

  const roleWeight = { ADMIN: 1, SUPERVISOR: 2, LIDER_GERACAO: 3, LEADER: 4, VICE_LEADER: 5 };

  others.sort((a, b) => {
    if (sort === 'role') {
      const wa = roleWeight[a.role] || 99, wb = roleWeight[b.role] || 99;
      if (wa !== wb) return wa - wb;
    }
    return a.name.localeCompare(b.name);
  });

  const list = document.getElementById('team-list');
  if (!list) return;

  list.innerHTML = others.length ? `
  <div class="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100">${others.map(u => `
    <div class="flex items-center gap-3 p-3.5 group">
      <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">${u.name.charAt(0)}</div>
      <div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${u.name}</p><p class="text-[11px] text-slate-500 truncate">@${u.username}</p></div>
      ${badge(RL[u.role] || u.role, RC[u.role] || 'slate')}
      <button class="btn-eu w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-primary hover:bg-primary/10 transition" data-id="${u.id}" title="Editar usuário"><span class="material-symbols-outlined text-[16px]">edit</span></button>
      ${store.currentUser.role === 'ADMIN' && u.id !== store.currentUser.id ? `<button class="btn-ru w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-amber-600 hover:bg-amber-50 transition" data-id="${u.id}" title="Redefinir senha"><span class="material-symbols-outlined text-[16px]">lock_reset</span></button>` : ''}
      <button class="btn-du w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50 transition" data-id="${u.id}" title="Excluir usuário"><span class="material-symbols-outlined text-[16px]">delete</span></button>
    </div>`).join('')}</div>` : `<div class="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-8 text-center"><span class="material-symbols-outlined text-3xl text-slate-200 mb-1">group_add</span><p class="text-sm text-slate-400">Nenhum usuário encontrado</p></div>`;

  document.querySelectorAll('.btn-eu').forEach(b => b.onclick = () => userModal(b.dataset.id));
  document.querySelectorAll('.btn-ru').forEach(b => b.onclick = () => resetPasswordModal(b.dataset.id));
  document.querySelectorAll('.btn-du').forEach(b => b.onclick = () => {
    const usr = store.getUser(b.dataset.id); if (!usr) return;
    if (store.currentUser.role === 'SUPERVISOR' && ['ADMIN', 'SUPERVISOR'].includes(usr.role)) {
      toast('Sem permissão para excluir este usuário', 'error'); return;
    }
    openModal(`<div class="p-6 text-center"><div class="w-14 h-14 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center"><span class="material-symbols-outlined text-red-600 text-3xl">person_remove</span></div><h3 class="text-lg font-bold mb-1">Excluir Usuário</h3><p class="text-sm text-slate-500">${usr.name}</p><p class="text-xs text-slate-400 mb-5">@${usr.username}</p><div class="flex gap-3"><button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="flex-1 py-2.5 rounded-lg bg-slate-100 text-sm font-semibold hover:bg-slate-200">Cancelar</button><button id="btn-confirm-del" class="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Excluir</button></div></div>`);
    document.getElementById('btn-confirm-del').onclick = async () => { await store.deleteUser(usr.id); closeModal(); toast('Usuário excluído'); renderTeam() };
  });
}

function resetPasswordModal(userId) {
  const usr = store.getUser(userId);
  if (!usr) return;
  openModal(`
    <div class="p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-amber-600 text-xl">lock_reset</span>
        </div>
        <div>
          <h3 class="text-base font-bold">Redefinir Senha</h3>
          <p class="text-xs text-slate-500">${usr.name} (@${usr.username})</p>
        </div>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Nova Senha</label>
          <input id="inp-new-pass" type="password" minlength="6" placeholder="Mínimo 6 caracteres" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Confirmar Nova Senha</label>
          <input id="inp-confirm-pass" type="password" minlength="6" placeholder="Repita a nova senha" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="flex-1 py-2.5 rounded-lg bg-slate-100 text-sm font-semibold hover:bg-slate-200">Cancelar</button>
        <button id="btn-confirm-reset-pass" class="flex-1 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600">Redefinir</button>
      </div>
    </div>`);

  document.getElementById('btn-confirm-reset-pass').onclick = async () => {
    const newPassword = document.getElementById('inp-new-pass').value;
    const confirm = document.getElementById('inp-confirm-pass').value;
    if (!newPassword || newPassword.length < 6) { toast('A senha deve ter no mínimo 6 caracteres', 'error'); return; }
    if (newPassword !== confirm) { toast('As senhas não coincidem', 'error'); return; }
    try {
      await store.apiFetch(`/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) });
      closeModal();
      toast(`Senha de ${usr.name} redefinida com sucesso!`);
    } catch (e) {
      toast(e.message || 'Erro ao redefinir senha', 'error');
    }
  };
}

function editNameModal() {
  openModal(`<div class="p-6"><div class="flex justify-between items-center mb-5"><h3 class="text-base font-bold">Editar Nome</h3><button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button></div>
  <input id="inp-n" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20 mb-4" value="${store.currentUser.name}"/>
  <button id="btn-sn" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition">Salvar</button></div>`);
  document.getElementById('btn-sn').onclick = async () => { const n = document.getElementById('inp-n').value.trim(); if (!n) { toast('Nome vazio', 'error'); return } await store.updateUser(store.currentUser.id, { name: n }); closeModal(); toast('Nome atualizado!'); settingsView() };
}

function editPassModal() {
  openModal(`<div class="p-6"><div class="flex justify-between items-center mb-5"><h3 class="text-base font-bold">Alterar Senha</h3><button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button></div>
  <div class="space-y-3">
    <div class="relative">
      <input id="inp-op" type="password" placeholder="Senha atual" class="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
      <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors" onclick="const i = this.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; this.firstElementChild.textContent = i.type === 'password' ? 'visibility' : 'visibility_off'"><span class="material-symbols-outlined text-lg">visibility</span></button>
    </div>
    <div class="relative">
      <input id="inp-np" type="password" placeholder="Nova senha" class="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
      <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors" onclick="const i = this.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; this.firstElementChild.textContent = i.type === 'password' ? 'visibility' : 'visibility_off'"><span class="material-symbols-outlined text-lg">visibility</span></button>
    </div>
    <div class="relative">
      <input id="inp-cp" type="password" placeholder="Confirmar nova senha" class="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
      <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors" onclick="const i = this.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; this.firstElementChild.textContent = i.type === 'password' ? 'visibility' : 'visibility_off'"><span class="material-symbols-outlined text-lg">visibility</span></button>
    </div>
    <button id="btn-sp" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition mt-1">Alterar Senha</button>
  </div></div>`);
  document.getElementById('btn-sp').onclick = async () => {
    const o = document.getElementById('inp-op').value, n = document.getElementById('inp-np').value, c = document.getElementById('inp-cp').value;
    if (!o) { toast('Digite a senha atual', 'error'); return }
    if (n.length < 4) { toast('Mínimo 4 caracteres', 'error'); return }
    if (n !== c) { toast('Senhas não coincidem', 'error'); return }

    const btn = document.getElementById('btn-sp');
    const orig = btn.innerHTML; btn.innerHTML = 'Processando...'; btn.disabled = true;

    try {
      await store.changePassword(store.currentUser.id, o, n);
      closeModal(); toast('Senha alterada!');
    } catch (err) {
      toast(err.message || 'Erro ao alterar senha', 'error');
      btn.innerHTML = orig; btn.disabled = false;
    }
  };
}

function userModal(id) {
  const e = id ? store.getUser(id) : null;
  if (e && store.currentUser.role === 'SUPERVISOR' && ['ADMIN', 'SUPERVISOR'].includes(e.role)) {
    toast('Sem permissão para editar este usuário', 'error'); return;
  }
  const allowedRoles = store.currentUser.role === 'ADMIN'
    ? Object.entries(RL).filter(([k]) => k !== 'SUPERADMIN')
    : Object.entries(RL).filter(([k]) => ['LIDER_GERACAO', 'LEADER', 'VICE_LEADER'].includes(k));

  openModal(`<div class="p-6"><div class="flex justify-between items-center mb-5"><h3 class="text-base font-bold">${e ? 'Editar' : 'Novo'} Usuário</h3><button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button></div>
  <form id="user-form" class="space-y-3">
    <input id="uf-name" placeholder="Nome completo" value="${e?.name || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
    <input id="uf-username" type="text" placeholder="Nome de usuário (sem espaços)" value="${e?.username || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
    <div class="relative">
      ${!e ? `<input id="uf-pass" type="password" placeholder="Senha inicial" class="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" required/>` : (store.currentUser.role === 'ADMIN' ? `<input id="uf-pass" type="password" placeholder="Nova senha (deixe vazio para manter)" class="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/>` : '')}
      ${!e || store.currentUser.role === 'ADMIN' ? `<button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors" onclick="const i = this.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; this.firstElementChild.textContent = i.type === 'password' ? 'visibility' : 'visibility_off'"><span class="material-symbols-outlined text-lg">visibility</span></button>` : ''}
    </div>
    <div><p class="text-xs font-semibold text-slate-600 mb-1.5">Função</p><div class="grid grid-cols-2 gap-1.5" id="role-grid">${allowedRoles.map(([k, v]) => `<button type="button" class="role-opt flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition ${(e?.role || 'LEADER') === k ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'border-slate-200 text-slate-500 hover:border-slate-300'}" data-r="${k}"><span class="material-symbols-outlined text-[16px]">${k === 'ADMIN' ? 'shield_person' : k === 'SUPERVISOR' ? 'supervisor_account' : k === 'LIDER_GERACAO' ? 'groups' : 'person'}</span>${v}</button>`).join('')}</div><input type="hidden" id="uf-role" value="${e?.role || 'LEADER'}"/></div>
    <div id="gen-div" class="${(e?.role === 'LIDER_GERACAO') ? '' : 'hidden'} mt-3">
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Geração (Obrigatório para Líder de Geração)</label>
        <select id="uf-generation" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20">
           <option value="">— Selecione —</option>
           ${(store.generations || []).map(g => `<option value="${g.id}" ${e?.generationId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
        </select>
    </div>
    <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition mt-1">${e ? 'Salvar' : 'Criar'}</button>
  </form></div>`);
  document.querySelectorAll('.role-opt').forEach(b => b.onclick = () => {
    document.querySelectorAll('.role-opt').forEach(x => { x.classList.remove('border-primary', 'bg-primary/10', 'text-primary', 'ring-1', 'ring-primary'); x.classList.add('border-slate-200', 'text-slate-500') });
    b.classList.add('border-primary', 'bg-primary/10', 'text-primary', 'ring-1', 'ring-primary'); b.classList.remove('border-slate-200', 'text-slate-500');
    document.getElementById('uf-role').value = b.dataset.r;
    const genDiv = document.getElementById('gen-div');
    if (genDiv) {
      if (b.dataset.r === 'LIDER_GERACAO') genDiv.classList.remove('hidden'); else genDiv.classList.add('hidden');
    }
  });
  document.getElementById('user-form').onsubmit = async ev => {
    ev.preventDefault();
    const btn = ev.target.querySelector('button[type="submit"]');
    const origText = btn.innerHTML;
    btn.innerHTML = 'Salvando...'; btn.disabled = true;

    const n = document.getElementById('uf-name').value.trim();
    const un = document.getElementById('uf-username').value.trim().toLowerCase().replace(/\\s+/g, '');
    const r = document.getElementById('uf-role').value;
    const gen = document.getElementById('uf-generation')?.value || null;

    if (!n || !un) { toast('Preencha nome e usuário', 'error'); btn.innerHTML = origText; btn.disabled = false; return }
    if (r === 'LIDER_GERACAO' && !gen) { toast('Selecione uma geração', 'error'); btn.innerHTML = origText; btn.disabled = false; return; }

    try {
      if (e) {
        const updatePayload = { name: n, username: un, role: r, generationId: gen };
        const pwField = document.getElementById('uf-pass');
        if (pwField && pwField.value.trim().length > 0) {
          if (pwField.value.length < 4) { toast('Senha min. 4 chars', 'error'); btn.innerHTML = origText; btn.disabled = false; return; }
          updatePayload.password = pwField.value;
        }
        await store.updateUser(id, updatePayload);
        if (id === store.currentUser.id) settingsView();
        toast('Atualizado!');
      }
      else {
        const pw = document.getElementById('uf-pass').value;
        if (!pw || pw.length < 4) { toast('Senha min. 4 chars', 'error'); btn.innerHTML = origText; btn.disabled = false; return }
        if (store.users.find(u => u.username === un)) { toast('Usuário já existe', 'error'); btn.innerHTML = origText; btn.disabled = false; return }
        await store.addUser({ name: n, username: un, password: pw, role: r, generationId: gen, avatar: null });
        toast('Usuário criado!')
      }
      closeModal(); renderTeam();
    } catch (err) {
      toast('Servidor indisponível', 'error');
      btn.innerHTML = origText; btn.disabled = false;
    }
  };
}

function toolLink(icon, title, desc, href, color) {
  return `<a href="${href}" class="flex items-center gap-3 p-3.5 hover:bg-slate-50 transition group"><div class="w-9 h-9 rounded-full bg-${color}-100 flex items-center justify-center text-${color}-600"><span class="material-symbols-outlined text-lg">${icon}</span></div><div class="flex-1"><p class="text-sm font-semibold">${title}</p><p class="text-[11px] text-slate-500">${desc}</p></div><span class="material-symbols-outlined text-slate-300 group-hover:text-primary text-lg">chevron_right</span></a>`;
}

// ── Tracks (Spiritual & Retreats) ──
function renderTracks() {
  const container = document.getElementById('tracks-list');
  if (!container) return;
  const tracks = store.tracks || [];
  const fixedIds = ['t-waterBaptism', 't-holySpiritBaptism', 't-leadersSchool', 't-encounter'];

  container.innerHTML = tracks.length ? `
  <div class="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100">${tracks.map(t => {
    const isFixed = fixedIds.includes(t.id);
    return `<div class="flex items-center gap-3 p-3.5 group">
      <div class="w-9 h-9 rounded-lg bg-${t.color}-100 flex items-center justify-center text-${t.color}-600 text-base"><span class="material-symbols-outlined">${t.icon}</span></div>
      <div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${t.name}</p><div class="flex items-center gap-1.5 mt-0.5"><span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-empty border border-slate-200 text-slate-500">${t.category}</span></div></div>
      <button class="btn-et w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-primary hover:bg-primary/10 transition" data-id="${t.id}"><span class="material-symbols-outlined text-[16px]">edit</span></button>
      ${isFixed ? `<div class="w-7 h-7 flex items-center justify-center text-slate-200" title="Trilha padrão do sistema (fixa)"><span class="material-symbols-outlined text-[16px]">lock</span></div>` : `<button class="btn-dt w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50 transition" data-id="${t.id}"><span class="material-symbols-outlined text-[16px]">delete</span></button>`}
    </div>`;
  }).join('')}</div>` : `<div class="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-8 text-center"><span class="material-symbols-outlined text-3xl text-slate-200 mb-1">route</span><p class="text-sm text-slate-400">Nenhuma trilha configurada</p></div>`;

  document.getElementById('btn-add-track')?.addEventListener('click', () => trackModal());
  document.querySelectorAll('.btn-et').forEach(b => b.onclick = () => trackModal(b.dataset.id));
  document.querySelectorAll('.btn-dt').forEach(b => b.onclick = () => {
    const t = store.tracks.find(x => x.id === b.dataset.id); if (!t) return;
    openModal(`<div class="p-6 text-center"><div class="w-14 h-14 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center"><span class="material-symbols-outlined text-red-600 text-3xl">delete_forever</span></div><h3 class="text-lg font-bold mb-1">Excluir Trilha</h3><p class="text-sm text-slate-500">${t.name}</p><p class="text-xs text-red-400 mb-5 mt-2 font-medium">Os membros que possuíam essa trilha marcada não a exibirão mais no perfil.</p><div class="flex gap-3"><button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="flex-1 py-2.5 rounded-lg bg-slate-100 text-sm font-semibold hover:bg-slate-200">Cancelar</button><button id="btn-confirm-del-track" class="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Excluir</button></div></div>`);
    document.getElementById('btn-confirm-del-track').onclick = async () => { await store.deleteTrack(t.id); closeModal(); toast('Trilha excluída'); renderTracks() };
  });
}

function trackModal(id) {
  const t = id ? store.tracks.find(x => x.id === id) : null;
  const colors = ['blue', 'emerald', 'orange', 'purple', 'sky', 'rose', 'amber', 'indigo'];
  const icons = ['water_drop', 'local_fire_department', 'school', 'volunteer_activism', 'workspace_premium', 'menu_book', 'verified', 'stars', 'favorite'];

  const target = t?.targetMetadata ? JSON.parse(t.targetMetadata) : { everyone: true, statuses: [], generations: [] };

  openModal(`<div class="p-5 md:p-6 max-h-[90vh] overflow-y-auto"><div class="flex justify-between items-center mb-5"><h3 class="text-base font-bold">${t ? 'Editar' : 'Nova'} Trilha</h3><button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button></div>
  <form id="track-form" class="space-y-4">
    <div><label class="text-xs font-semibold text-slate-600 mb-1 block">Nome do Marco/Evento</label><input id="tf-name" placeholder="Ex: Acampamento Jovem" value="${t?.name || ''}" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20"/></div>
    <div>
      <label class="text-xs font-semibold text-slate-600 mb-1 block">Categoria</label>
      <select id="tf-cat" class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/20" ${t && ['t-waterBaptism', 't-holySpiritBaptism', 't-leadersSchool', 't-encounter'].includes(t.id) ? 'disabled title="A categoria desta trilha padrão não pode ser alterada"' : ''}>
        <option value="espiritual" ${t?.category === 'espiritual' ? 'selected' : ''}>Vida Espiritual (Batismos, Escolas)</option>
        <option value="retiros" ${t?.category === 'retiros' ? 'selected' : ''}>Retiros e Acampamentos</option>
      </select>
    </div>
    
    <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
      <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Público Alvo</p>
      
      <label class="flex items-center gap-2 cursor-pointer group">
        <input type="checkbox" id="target-everyone" ${target.everyone ? 'checked' : ''} class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"/>
        <span class="text-sm font-semibold group-hover:text-primary transition-colors">Disponível para todos</span>
      </label>
      
      <div id="target-specific" class="${target.everyone ? 'opacity-40 pointer-events-none' : ''} space-y-3 transition-opacity">
        <div>
          <p class="text-[10px] font-semibold text-slate-500 mb-1.5 uppercase">Por Status</p>
          <div class="flex flex-wrap gap-2">
            ${['Membro', 'Líder', 'Vice-Líder', 'Visitante', 'Novo Convertido', 'Reconciliação'].map(s => `
              <label class="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-primary/30 transition-colors">
                <input type="checkbox" name="target-status" value="${s}" ${target.statuses?.includes(s) ? 'checked' : ''} class="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary"/>
                <span class="text-xs font-medium">${s}</span>
              </label>
            `).join('')}
          </div>
        </div>
        
        <div>
          <p class="text-[10px] font-semibold text-slate-500 mb-1.5 uppercase">Por Geração</p>
          <div class="flex flex-wrap gap-2">
            ${(store.generations || []).map(g => `
              <label class="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-primary/30 transition-colors">
                <input type="checkbox" name="target-gen" value="${g.id}" ${target.generations?.includes(g.id) ? 'checked' : ''} class="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary"/>
                <span class="text-xs font-medium">${g.name}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1.5 block">Ícone</label>
          <div class="flex flex-wrap gap-2" id="icon-picker">
            ${icons.map(i => `<button type="button" class="icon-opt w-9 h-9 rounded-lg border flex items-center justify-center transition ${t?.icon === i || (!t && i === icons[0]) ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'border-slate-200 text-slate-400 hover:border-slate-300'}" data-i="${i}"><span class="material-symbols-outlined">${i}</span></button>`).join('')}
          </div><input type="hidden" id="tf-icon" value="${t?.icon || icons[0]}"/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1.5 block">Cor</label>
          <div class="flex flex-wrap gap-2" id="color-picker">
            ${colors.map(c => `<button type="button" class="color-opt w-8 h-8 rounded-full bg-${c}-500 ring-offset-2 transition ${t?.color === c || (!t && c === colors[0]) ? 'ring-2 ring-slate-400 scale-90' : 'hover:scale-110'}" data-c="${c}"></button>`).join('')}
          </div><input type="hidden" id="tf-color" value="${t?.color || colors[0]}"/>
        </div>
    </div>
    <button type="submit" class="w-full bg-primary text-white py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition mt-2">${t ? 'Salvar Alterações' : 'Criar Trilha'}</button>
  </form></div>`);

  const everyoneInp = document.getElementById('target-everyone');
  const targetSpec = document.getElementById('target-specific');
  everyoneInp.onchange = () => {
    if (everyoneInp.checked) {
      targetSpec.classList.add('opacity-40', 'pointer-events-none');
      document.querySelectorAll('input[name="target-status"], input[name="target-gen"]').forEach(i => i.checked = false);
    } else {
      targetSpec.classList.remove('opacity-40', 'pointer-events-none');
    }
  };

  document.querySelectorAll('.icon-opt').forEach(b => b.onclick = () => {
    document.querySelectorAll('.icon-opt').forEach(x => { x.classList.remove('border-primary', 'bg-primary/10', 'text-primary', 'ring-1', 'ring-primary'); x.classList.add('border-slate-200', 'text-slate-400') });
    b.classList.add('border-primary', 'bg-primary/10', 'text-primary', 'ring-1', 'ring-primary'); b.classList.remove('border-slate-200', 'text-slate-400');
    document.getElementById('tf-icon').value = b.dataset.i;
  });

  document.querySelectorAll('.color-opt').forEach(b => b.onclick = () => {
    document.querySelectorAll('.color-opt').forEach(x => { x.classList.remove('ring-2', 'ring-slate-400', 'scale-90'); x.classList.add('hover:scale-110') });
    b.classList.add('ring-2', 'ring-slate-400', 'scale-90'); b.classList.remove('hover:scale-110');
    document.getElementById('tf-color').value = b.dataset.c;
  });

  document.getElementById('track-form').onsubmit = async ev => {
    ev.preventDefault();
    const n = document.getElementById('tf-name').value.trim();
    if (!n) { toast('Dê um nome à trilha', 'error'); return; }

    const targetMeta = {
      everyone: document.getElementById('target-everyone').checked,
      statuses: Array.from(document.querySelectorAll('input[name="target-status"]:checked')).map(i => i.value),
      generations: Array.from(document.querySelectorAll('input[name="target-gen"]:checked')).map(i => i.value)
    };

    const payload = {
      name: n,
      category: document.getElementById('tf-cat').value,
      icon: document.getElementById('tf-icon').value,
      color: document.getElementById('tf-color').value,
      targetMetadata: JSON.stringify(targetMeta)
    };
    if (t) { await store.updateTrack(id, payload); toast('Atualizado!') }
    else { await store.addTrack(payload); toast('Trilha criada!') }
    closeModal(); renderTracks();
  };
}

// ── Forms ──
export function formsView() {
  const app = document.getElementById('app');
  app.innerHTML = `${header('Formulários', true)}<div class="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3 md:max-w-2xl">
  ${store.forms.map(f => `<div class="bg-white rounded-xl p-4 border border-slate-100"><div class="flex items-center gap-3 mb-2"><div class="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600"><span class="material-symbols-outlined text-lg">description</span></div><div class="flex-1"><h3 class="text-sm font-semibold">${f.name}</h3><div class="flex gap-2 mt-0.5">${badge(f.status === 'ativo' ? 'Ativo' : 'Inativo', f.status === 'ativo' ? 'green' : 'slate')}<span class="text-[11px] text-slate-400">${f.fields.length} campos</span></div></div></div></div>`).join('')}
  </div>`;
}

// ── Triage ──
export function triageView() {
  const app = document.getElementById('app');
  const pending = store.triageQueue.filter(t => t.status === 'new' || t.status === 'pendente' || t.status === 'forwarded_generation');
  const done = store.triageQueue.filter(t => t.status === 'done' || t.status === 'rejected');
  app.innerHTML = `${header('Triagem', true)}<div class="flex-1 overflow-y-auto px-4 md:px-6 lg:px-10 py-4 space-y-5 max-w-5xl mx-auto w-full">
  <section>
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pendentes (${pending.length})</h3>
    </div>
    <div class="space-y-2">${pending.length ? pending.map(t => tCard(t)).join('') : '<div class="text-center py-8 bg-white rounded-xl border border-slate-100"><span class="material-symbols-outlined text-3xl text-slate-200">assignment_turned_in</span><p class="text-sm text-slate-400 mt-1">Nenhum registro pendente</p></div>'}</div>
  </section>
  ${done.length ? `<section>
    <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Processados (${done.length})</h3>
    <div class="space-y-2">${done.map(t => tCard(t, true)).join('')}</div>
  </section>` : ''}
  </div>`;

  document.querySelectorAll('.triage-card').forEach(card => {
    card.addEventListener('click', () => openTriageDetail(card.dataset.id));
  });
}

function tCard(t, processed = false) {
  const f = store.forms.find(x => x.id === t.formId);
  const statusBadge = f?.personStatus
    ? `<span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${f.personStatus === 'Novo Convertido' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'}">${f.personStatus}</span>`
    : '<span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Triagem</span>';
  const nameKey = Object.keys(t.data).find(k => k.toLowerCase().includes('nome'));
  const name = nameKey ? t.data[nameKey] : 'Anônimo';
  const phoneKey = Object.keys(t.data).find(k => k.toLowerCase().includes('tele') || k.toLowerCase().includes('whats') || k.toLowerCase().includes('celular'));
  const phone = phoneKey ? t.data[phoneKey] : '';
  const doneBadge = t.status === 'done' ? '<span class="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">✓ ACEITO</span>' :
    t.status === 'rejected' ? '<span class="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">✕ REJEITADO</span>' :
      t.status === 'forwarded_generation' ? '<span class="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">➟ DEL. GERAÇÃO</span>' : '';

  return `<div class="triage-card bg-white rounded-xl p-4 border border-slate-100 hover:border-primary/30 transition cursor-pointer group" data-id="${t.id}">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-primary text-sm font-bold">${(name[0] || '?').toUpperCase()}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2"><p class="text-sm font-semibold truncate">${name}</p>${statusBadge}${doneBadge}</div>
        <p class="text-[11px] text-slate-400 mt-0.5">${phone ? phone + ' • ' : ''}${t.formName || 'Formulário'} • ${new Date(t.submittedAt || t.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      <span class="material-symbols-outlined text-slate-300 group-hover:text-primary text-lg transition">chevron_right</span>
    </div>
  </div>`;
}

function openTriageDetail(id) {
  const t = store.triageQueue.find(x => x.id === id);
  if (!t) return;
  const f = store.forms.find(x => x.id === t.formId);
  const nameKey = Object.keys(t.data).find(k => k.toLowerCase().includes('nome'));
  const name = nameKey ? t.data[nameKey] : '';
  const phoneKey = Object.keys(t.data).find(k => k.toLowerCase().includes('tele') || k.toLowerCase().includes('whats') || k.toLowerCase().includes('celular'));
  const phone = phoneKey ? t.data[phoneKey] : '';
  const birthKey = Object.keys(t.data).find(k => k.toLowerCase().includes('nascimento') || k.toLowerCase().includes('nasc'));
  let birthdate = birthKey ? t.data[birthKey] : '';
  if (birthdate && birthdate.includes('/')) {
    const parts = birthdate.split('/');
    if (parts.length === 3) birthdate = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const addressKey = Object.keys(t.data).find(k => k.toLowerCase().includes('endereço') || k.toLowerCase().includes('endereco') || k.toLowerCase().includes('rua') || k.toLowerCase().includes('bairro'));
  const address = addressKey ? t.data[addressKey] : '';

  // --- Mapeamento de Decisão ---
  const decisionKey = Object.keys(t.data).find(k => k.toLowerCase().includes('decisão') || k.toLowerCase().includes('decisao'));
  const decisionValue = decisionKey ? t.data[decisionKey] : '';
  let mappedStatus = f?.personStatus || 'Novo Convertido';

  // Se for apenas triagem (sem status fixo no form), tenta deduzir pela resposta
  if (!f?.personStatus && decisionValue) {
    if (decisionValue.toLowerCase().includes('jesus') || decisionValue.toLowerCase().includes('converte')) {
      mappedStatus = 'Novo Convertido';
    } else if (decisionValue.toLowerCase().includes('reconcilia')) {
      mappedStatus = 'Reconciliação';
    }
  }

  const isDone = t.status === 'done' || t.status === 'rejected';
  const statusLabel = f?.personStatus || 'Sem status definido (Apenas Triagem)';
  const statusColor = (f?.personStatus || mappedStatus) === 'Novo Convertido' ? 'emerald' : (f?.personStatus || mappedStatus) === 'Reconciliação' ? 'purple' : 'slate';

  openModal(`<div class="p-5 md:p-6 max-h-[85vh] overflow-y-auto">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-base font-bold">Detalhes da Triagem</h3>
      <button onclick="document.getElementById('modal-overlay').classList.add('hidden')" class="p-1 rounded-full hover:bg-slate-100"><span class="material-symbols-outlined text-slate-400">close</span></button>
    </div>
    <div class="flex items-center gap-3 mb-4 p-3 rounded-xl bg-${statusColor}-50 border border-${statusColor}-100">
      <div class="w-10 h-10 rounded-full bg-${statusColor}-100 flex items-center justify-center text-${statusColor}-700 font-bold text-sm">${(name[0] || '?').toUpperCase()}</div>
      <div class="flex-1">
        <p class="text-sm font-bold text-${statusColor}-800">${name || 'Sem nome'}</p>
        <p class="text-[11px] text-${statusColor}-600">${statusLabel} • ${t.formName || 'Formulário'}</p>
      </div>
    </div>
    <div class="mb-4">
      <p class="text-xs font-semibold text-slate-600 mb-2">Dados enviados</p>
      <div class="space-y-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
        ${Object.entries(t.data)
      .filter(([k]) => k !== 'generationId')
      .map(([k, v]) => `<div class="flex justify-between items-start gap-2">
          <span class="text-[11px] font-medium text-slate-500 shrink-0">${k}</span>
          <span class="text-[11px] text-right font-semibold text-slate-700 ${k === decisionKey ? 'text-primary' : ''}">${v || '<span class="text-slate-300 italic">vazio</span>'}</span>
        </div>`).join('')}
      </div>
    </div>
    ${!isDone ? `<form id="triage-action" class="space-y-3">
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Nome (corrigir se necessário)</label>
        <input id="tr-name" value="${name}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Nome completo"/>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Telefone</label>
          <input id="tr-phone" value="${phone}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="(00) 00000-0000"/>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600 mb-1 block">Data Nascimento</label>
          <input id="tr-birth" type="date" value="${birthdate}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Endereço</label>
        <input id="tr-address" value="${address}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Rua, Bairro, CEP"/>
      </div>
      
      ${!f?.personStatus ? `
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Definir Status da Pessoa</label>
        <select id="tr-status" class="w-full px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition">
          <option value="Novo Convertido" ${mappedStatus === 'Novo Convertido' ? 'selected' : ''}>Novo Convertido</option>
          <option value="Reconciliação" ${mappedStatus === 'Reconciliação' ? 'selected' : ''}>Reconciliação</option>
          <option value="Visitante" ${mappedStatus === 'Visitante' ? 'selected' : ''}>Visitante</option>
          <option value="Membro" ${mappedStatus === 'Membro' ? 'selected' : ''}>Membro</option>
        </select>
        ${decisionKey ? `<p class="text-[10px] text-primary mt-1 font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">info</span> Mapeado via campo "${decisionKey}"</p>` : ''}
      </div>
      ` : ''}

      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">Atribuir à Célula</label>
        <select id="tr-cell" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">— Sem célula (definir depois) —</option>
          ${store.getVisibleCells().map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      ${store.hasRole('ADMIN', 'SUPERVISOR') && t.status !== 'forwarded_generation' ? `
      <div>
        <label class="text-xs font-semibold text-slate-600 mb-1 block">OU Delegar à Geração (Encaminha para Líderes de Geração)</label>
        <select id="tr-generation" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20">
           <option value="">— Selecione uma Geração —</option>
           ${(store.generations || []).map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
        </select>
      </div>` : ''}
      <div class="flex gap-2 pt-2">
        <button type="submit" class="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-emerald-700 active:scale-[.98] transition-all flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-lg">check</span>Aceitar</button>
        <button type="button" id="tr-reject" class="flex-1 bg-red-50 text-red-600 py-2.5 rounded-lg text-sm font-bold hover:bg-red-100 active:scale-[.98] transition-all flex items-center justify-center gap-1.5 border border-red-100"><span class="material-symbols-outlined text-lg">close</span>Rejeitar</button>
      </div>
    </form>` : `<div class="text-center py-4">
      <span class="text-xs font-medium px-2.5 py-1 rounded-full ${t.status === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">${t.status === 'done' ? '✓ Aceito e processado' : '✕ Rejeitado'}</span>
    </div>`}
  </div>`);

  if (!isDone) {
    document.getElementById('triage-action').onsubmit = async e => {
      e.preventDefault();
      const trName = document.getElementById('tr-name').value.trim() || name || 'Sem nome';
      const trPhone = document.getElementById('tr-phone').value.trim();
      const trBirth = document.getElementById('tr-birth').value;
      const trAddress = document.getElementById('tr-address').value.trim();
      const trCell = document.getElementById('tr-cell').value;
      const trStatusSelect = document.getElementById('tr-status');
      const trStatus = trStatusSelect ? trStatusSelect.value : (f?.personStatus || 'Novo Convertido');
      const trGenSelect = document.getElementById('tr-generation');
      const trGeneration = trGenSelect ? trGenSelect.value : '';

      if (trGeneration) {
        t.status = 'forwarded_generation';
        await store.updateTriage(t.id, 'forwarded_generation', { generationId: trGeneration });
        closeModal();
        toast('Encaminhado para a equipe da Geração!');
        triageView();
        return;
      }

      const extraData = {};
      if (f?.fields) {
        f.fields.forEach(field => {
          if (field.isExtra && t.data[field.name] !== undefined) {
            extraData[field.name] = t.data[field.name];
          }
        });
      }

      const personData = {
        name: trName, phone: trPhone, birthdate: trBirth, address: trAddress,
        status: trStatus,
        cellId: trCell || undefined,
        createdAt: new Date().toISOString(),
        formData: t.data,
        extraData: Object.keys(extraData).length ? JSON.stringify(extraData) : null,
        tracksData: {},
        discipleship: { primeiroContato: { done: true, date: new Date().toISOString().split('T')[0] } }
      };
      await store.addPerson(personData);
      t.status = 'done';
      await store.updateTriage(t.id, 'done');
      closeModal();
      toast('Pessoa cadastrada com sucesso!');
      triageView();
    };
    document.getElementById('tr-reject')?.addEventListener('click', () => {
      openModal(`<div class="p-6 text-center">
        <div class="w-14 h-14 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center"><span class="material-symbols-outlined text-red-600 text-3xl">delete_forever</span></div>
        <h3 class="text-lg font-bold mb-1">Rejeitar Triagem?</h3>
        <p class="text-sm text-slate-500 mb-5">Tem certeza que deseja rejeitar este cadastro? Esta ação marcará o registro como rejeitado.</p>
        <div class="flex gap-3">
          <button id="btn-cancel-reject" class="flex-1 py-2.5 rounded-lg bg-slate-100 text-sm font-semibold hover:bg-slate-200 transition">Cancelar</button>
          <button id="btn-confirm-reject" class="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Sim, Rejeitar</button>
        </div>
      </div>`);

      document.getElementById('btn-cancel-reject').onclick = () => {
        // Just close the confirmation modal and re-open the triage detail
        openTriageDetail(t.id);
      };

      document.getElementById('btn-confirm-reject').onclick = async () => {
        t.status = 'rejected';
        await store.updateTriage(t.id, 'rejected');
        closeModal();
        toast('Registro rejeitado', 'warning');
        triageView();
      };
    });
  }
}
