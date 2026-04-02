import { store } from '../store.js';
import { navigate } from '../router.js';

const PERMISSIONS = [
    { id: 'read_membros',    label: 'Leitura — Membros' },
    { id: 'write_membros',   label: 'Escrita — Membros' },
    { id: 'read_eventos',    label: 'Leitura — Eventos' },
    { id: 'write_eventos',   label: 'Escrita — Eventos' },
    { id: 'read_frequencia', label: 'Leitura — Frequência' },
    { id: 'read_celulas',    label: 'Leitura — Células' },
    { id: 'write_celulas',   label: 'Escrita — Células' },
    { id: 'read_financeiro', label: 'Leitura — Financeiro' },
    { id: 'read_ebd',        label: 'Leitura — EBD' },
];

export function apiKeysView() {
    const app = document.getElementById('app');
    app.innerHTML = `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div class="max-w-4xl mx-auto px-4 py-8">

        <!-- Header -->
        <div class="flex items-center justify-between mb-8">
          <div>
            <button onclick="history.back()" class="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-2 transition-colors">
              <span class="material-symbols-outlined text-base">arrow_back</span> Voltar
            </button>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-indigo-500">key</span> API — Chaves de Acesso
            </h1>
            <p class="text-gray-500 dark:text-gray-400 mt-1 text-sm">Gerencie as chaves de API para integração programática.</p>
          </div>
          <button id="btn-create-key" class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium text-sm transition-all shadow-lg hover:shadow-indigo-200 dark:hover:shadow-none">
            <span class="material-symbols-outlined text-sm">add</span> Nova Chave
          </button>
        </div>

        <!-- Info box -->
        <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mb-6 flex gap-3">
          <span class="material-symbols-outlined text-amber-500 mt-0.5">warning</span>
          <p class="text-sm text-amber-800 dark:text-amber-300">As chaves de API são exibidas <strong>apenas uma vez</strong> no momento da criação. Guarde-as em local seguro.</p>
        </div>

        <!-- Keys list -->
        <div id="keys-list" class="space-y-3">
          <div class="flex justify-center py-8"><span class="material-symbols-outlined animate-spin text-gray-400">refresh</span></div>
        </div>
      </div>
    </div>

    <!-- Modal Criar Chave -->
    <div id="modal-create" class="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div class="p-6">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Nova Chave de API</h2>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da chave</label>
          <input id="key-name" type="text" placeholder="Ex: Integração App Mobile" class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissões</label>
          <div class="grid grid-cols-1 gap-2 mb-4">
            ${PERMISSIONS.map(p => `
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="perm-${p.id}" class="rounded accent-indigo-600"> 
                <span class="text-sm text-gray-700 dark:text-gray-300">${p.label}</span>
              </label>`).join('')}
          </div>
          <div class="flex gap-2 justify-end">
            <button id="btn-cancel-create" class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
            <button id="btn-confirm-create" class="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium">Criar Chave</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Exibir Chave Gerada -->
    <div id="modal-show-key" class="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div class="p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <span class="material-symbols-outlined text-green-600">check_circle</span>
            </div>
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">Chave Criada!</h2>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Copie sua chave agora. <strong class="text-red-500">Ela não será exibida novamente.</strong></p>
          <div class="bg-gray-900 dark:bg-black rounded-xl p-3 flex items-center gap-2 mb-4 overflow-auto">
            <code id="generated-key" class="text-green-400 text-xs font-mono flex-1 break-all"></code>
            <button id="btn-copy-key" class="flex-shrink-0 text-gray-400 hover:text-white transition-colors" title="Copiar">
              <span class="material-symbols-outlined text-lg">content_copy</span>
            </button>
          </div>
          <button id="btn-close-show-key" class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm">Entendido, chave copiada</button>
        </div>
      </div>
    </div>`;

    loadKeys();
    bindEvents();
}

async function loadKeys() {
    try {
        const r = await fetch('/api/admin/api-keys', { headers: { Authorization: `Bearer ${store.token}` } });
        const json = await r.json();
        const list = document.getElementById('keys-list');
        if (!json.data || json.data.length === 0) {
            list.innerHTML = `<div class="text-center py-12 text-gray-400"><span class="material-symbols-outlined text-5xl block mb-3">key_off</span><p>Nenhuma chave criada ainda.</p></div>`;
            return;
        }
        list.innerHTML = json.data.map(k => {
            const statusColor = k.status === 'active' ? 'text-green-600 bg-green-50 dark:bg-green-900/30' : 'text-red-500 bg-red-50 dark:bg-red-900/30';
            const statusLabel = k.status === 'active' ? 'Ativa' : 'Revogada';
            const lastUsed = k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString('pt-BR') : 'Nunca';
            const created = new Date(k.createdAt).toLocaleDateString('pt-BR');
            return `
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold text-gray-900 dark:text-white">${k.name}</h3>
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}">${statusLabel}</span>
                  </div>
                  <code class="text-xs text-gray-500 dark:text-gray-400 font-mono">${k.keyPrefix}</code>
                  <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">calendar_today</span> Criado: ${created}</span>
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">history</span> Último uso: ${lastUsed}</span>
                  </div>
                  <div class="flex flex-wrap gap-1 mt-2">
                    ${k.permissions.split(',').map(p => `<span class="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">${p.trim()}</span>`).join('')}
                  </div>
                </div>
                ${k.status === 'active' ? `
                <button onclick="revokeKey('${k.id}')" class="flex-shrink-0 text-sm text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-1 rounded-lg transition-colors">
                  Revogar
                </button>` : `
                <button onclick="deleteKey('${k.id}')" class="flex-shrink-0 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-1 rounded-lg transition-colors">
                  Remover
                </button>`}
              </div>
            </div>`;
        }).join('');
    } catch (err) {
        document.getElementById('keys-list').innerHTML = `<p class="text-red-500 text-sm">Erro ao carregar chaves.</p>`;
    }
}

function bindEvents() {
    document.getElementById('btn-create-key').onclick = () => document.getElementById('modal-create').classList.remove('hidden');
    document.getElementById('btn-cancel-create').onclick = () => document.getElementById('modal-create').classList.add('hidden');
    document.getElementById('btn-confirm-create').onclick = createKey;
    document.getElementById('btn-close-show-key').onclick = () => {
        document.getElementById('modal-show-key').classList.add('hidden');
        loadKeys();
    };
    document.getElementById('btn-copy-key').onclick = () => {
        const key = document.getElementById('generated-key').textContent;
        navigator.clipboard.writeText(key).then(() => {
            const btn = document.getElementById('btn-copy-key');
            btn.innerHTML = '<span class="material-symbols-outlined text-lg text-green-400">check</span>';
            setTimeout(() => { btn.innerHTML = '<span class="material-symbols-outlined text-lg">content_copy</span>'; }, 2000);
        });
    };

    window.revokeKey = async (id) => {
        if (!confirm('Revogar esta chave? Requisições usando ela vão falhar imediatamente.')) return;
        await fetch(`/api/admin/api-keys/${id}/revoke`, { method: 'PATCH', headers: { Authorization: `Bearer ${store.token}` } });
        loadKeys();
    };
    window.deleteKey = async (id) => {
        if (!confirm('Remover permanentemente esta chave?')) return;
        await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${store.token}` } });
        loadKeys();
    };
}

async function createKey() {
    const name = document.getElementById('key-name').value.trim();
    if (!name) { alert('Digite um nome para a chave.'); return; }
    const permissions = PERMISSIONS.filter(p => document.getElementById(`perm-${p.id}`).checked).map(p => p.id);
    if (permissions.length === 0) { alert('Selecione ao menos uma permissão.'); return; }

    const btn = document.getElementById('btn-confirm-create');
    btn.textContent = 'Criando...'; btn.disabled = true;
    try {
        const r = await fetch('/api/admin/api-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${store.token}` },
            body: JSON.stringify({ name, permissions })
        });
        const json = await r.json();
        if (!json.success) throw new Error(json.error);
        document.getElementById('modal-create').classList.add('hidden');
        document.getElementById('generated-key').textContent = json.data.key;
        document.getElementById('modal-show-key').classList.remove('hidden');
        document.getElementById('key-name').value = '';
        PERMISSIONS.forEach(p => document.getElementById(`perm-${p.id}`).checked = false);
    } catch (err) {
        alert('Erro ao criar chave: ' + err.message);
    } finally {
        btn.textContent = 'Criar Chave'; btn.disabled = false;
    }
}
