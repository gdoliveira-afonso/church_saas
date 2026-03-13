export function apiDocsView() {
    const app = document.getElementById('app');
    const BASE_URL = window.location.origin;

    const endpoints = [
        {
            group: 'Membros',
            icon: 'people',
            color: 'indigo',
            items: [
                {
                    method: 'GET', path: '/api/v1/membros',
                    permission: 'read_membros',
                    description: 'Retorna a lista paginada de membros cadastrados.',
                    query: [
                        { name: 'status', desc: 'Filtrar por status (Visitante, Membro, etc.)' },
                        { name: 'cellId', desc: 'Filtrar por célula' },
                        { name: 'page', desc: 'Página (padrão: 1)' },
                        { name: 'limit', desc: 'Itens por página (padrão: 50)' },
                    ],
                    example: `curl -X GET ${BASE_URL}/api/v1/membros \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                    response: `{
  "success": true,
  "data": [
    {
      "id": "clxyz123",
      "name": "João Silva",
      "phone": "11999990000",
      "status": "Membro",
      "cellId": "clcell456",
      "cell": { "id": "clcell456", "name": "Célula Norte" }
    }
  ],
  "meta": { "total": 42, "page": 1, "limit": 50 }
}`
                },
                {
                    method: 'GET', path: '/api/v1/membros/:id',
                    permission: 'read_membros',
                    description: 'Retorna os detalhes de um membro específico.',
                    example: `curl -X GET ${BASE_URL}/api/v1/membros/clxyz123 \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                    response: `{ "success": true, "data": { "id": "clxyz123", "name": "João Silva", ... } }`
                },
                {
                    method: 'POST', path: '/api/v1/membros',
                    permission: 'write_membros',
                    description: 'Cria um novo membro no sistema.',
                    body: [
                        { name: 'name', type: 'string', required: true, desc: 'Nome completo' },
                        { name: 'phone', type: 'string', required: false, desc: 'Telefone' },
                        { name: 'email', type: 'string', required: false, desc: 'E-mail' },
                        { name: 'status', type: 'string', required: false, desc: 'Status (padrão: Visitante)' },
                        { name: 'cellId', type: 'string', required: false, desc: 'ID da célula' },
                    ],
                    example: `curl -X POST ${BASE_URL}/api/v1/membros \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Maria Souza", "phone": "11988887777", "status": "Visitante"}'`,
                    response: `{ "success": true, "data": { "id": "clnew789", "name": "Maria Souza", ... } }`
                },
                {
                    method: 'PUT', path: '/api/v1/membros/:id',
                    permission: 'write_membros',
                    description: 'Atualiza os dados de um membro existente.',
                    example: `curl -X PUT ${BASE_URL}/api/v1/membros/clxyz123 \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "Membro", "cellId": "clcell456"}'`,
                    response: `{ "success": true, "data": { "id": "clxyz123", "status": "Membro", ... } }`
                },
                {
                    method: 'DELETE', path: '/api/v1/membros/:id',
                    permission: 'write_membros',
                    description: 'Remove um membro permanentemente do sistema.',
                    example: `curl -X DELETE ${BASE_URL}/api/v1/membros/clxyz123 \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                    response: `{ "success": true, "message": "Membro removido com sucesso." }`
                },
            ]
        },
        {
            group: 'Eventos',
            icon: 'event',
            color: 'green',
            items: [
                {
                    method: 'GET', path: '/api/v1/eventos',
                    permission: 'read_eventos',
                    description: 'Retorna a lista de eventos cadastrados.',
                    query: [
                        { name: 'from', desc: 'Data inicial (YYYY-MM-DD)' },
                        { name: 'to', desc: 'Data final (YYYY-MM-DD)' },
                        { name: 'page', desc: 'Página' },
                        { name: 'limit', desc: 'Limite por página' },
                    ],
                    example: `curl -X GET "${BASE_URL}/api/v1/eventos?from=2024-01-01&to=2024-12-31" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                    response: `{ "success": true, "data": [...], "meta": { "total": 10 } }`
                },
                {
                    method: 'POST', path: '/api/v1/eventos',
                    permission: 'write_eventos',
                    description: 'Cria um novo evento.',
                    body: [
                        { name: 'title', type: 'string', required: true, desc: 'Título do evento' },
                        { name: 'date', type: 'string (YYYY-MM-DD)', required: true, desc: 'Data do evento' },
                        { name: 'startTime', type: 'string (HH:MM)', required: false, desc: 'Hora de início' },
                        { name: 'location', type: 'string', required: false, desc: 'Local' },
                    ],
                    example: `curl -X POST ${BASE_URL}/api/v1/eventos \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Culto de Domingo", "date": "2024-12-01", "startTime": "19:00"}'`,
                    response: `{ "success": true, "data": { "id": "clevt001", "title": "Culto de Domingo", ... } }`
                },
            ]
        },
        {
            group: 'Frequências',
            icon: 'checklist',
            color: 'amber',
            items: [
                {
                    method: 'GET', path: '/api/v1/frequencias',
                    permission: 'read_frequencia',
                    description: 'Retorna registros de frequência de células com lista de presença.',
                    query: [
                        { name: 'cellId', desc: 'Filtrar por célula' },
                        { name: 'from', desc: 'Data inicial' },
                        { name: 'to', desc: 'Data final' },
                    ],
                    example: `curl -X GET ${BASE_URL}/api/v1/frequencias \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                    response: `{ "success": true, "data": [{ "id": "...", "cellId": "...", "date": "2024-11-20", "records": [...] }] }`
                },
            ]
        },
        {
            group: 'Turmas (Células)',
            icon: 'groups',
            color: 'rose',
            items: [
                {
                    method: 'GET', path: '/api/v1/turmas',
                    permission: 'read_membros',
                    description: 'Retorna as células/turmas cadastradas.',
                    example: `curl -X GET ${BASE_URL}/api/v1/turmas \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                    response: `{ "success": true, "data": [{ "id": "...", "name": "Célula Norte", ... }] }`
                },
            ]
        },
    ];

    const methodColors = {
        GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
        POST: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
        PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
        DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
        PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
    };

    const renderEndpoint = (ep) => `
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
      <div class="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors" onclick="toggleEndpoint(this)">
        <span class="text-xs font-bold font-mono px-2.5 py-1 rounded-lg whitespace-nowrap ${methodColors[ep.method]}">${ep.method}</span>
        <code class="text-sm font-mono text-gray-900 dark:text-white font-medium">${ep.path}</code>
        <span class="ml-auto text-xs text-gray-400 hidden md:block">${ep.permission}</span>
        <span class="material-symbols-outlined text-gray-400 text-base transition-transform">expand_more</span>
      </div>
      <div class="ep-body hidden border-t border-gray-100 dark:border-gray-700 p-5">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${ep.description}</p>
        ${ep.query ? `<div class="mb-4"><p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Query Parameters</p>${ep.query.map(q => `<div class="flex gap-2 text-sm mb-1"><code class="text-purple-600 dark:text-purple-400 w-28 flex-shrink-0">${q.name}</code><span class="text-gray-500">${q.desc}</span></div>`).join('')}</div>` : ''}
        ${ep.body ? `<div class="mb-4"><p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Body (JSON)</p>${ep.body.map(b => `<div class="flex gap-2 text-sm mb-1"><code class="text-purple-600 dark:text-purple-400 w-28 flex-shrink-0">${b.name}</code><span class="text-gray-400 text-xs mr-2 mt-0.5">${b.type}</span>${b.required ? '<span class="text-red-400 text-xs">obrigatório</span>' : ''}<span class="text-gray-500 ml-1">${b.desc}</span></div>`).join('')}</div>` : ''}
        <div class="mb-3">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Exemplo de Requisição</p>
          <pre class="bg-gray-900 dark:bg-black rounded-xl p-4 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap">${ep.example}</pre>
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Resposta</p>
          <pre class="bg-gray-900 dark:bg-black rounded-xl p-4 text-xs font-mono text-yellow-300 overflow-x-auto whitespace-pre-wrap">${ep.response}</pre>
        </div>
      </div>
    </div>`;

    app.innerHTML = `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div class="max-w-4xl mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-10">
          <button onclick="history.back()" class="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-3 transition-colors">
            <span class="material-symbols-outlined text-base">arrow_back</span> Voltar
          </button>
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
              <span class="material-symbols-outlined text-white text-lg">api</span>
            </div>
            <div>
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white">API Reference</h1>
              <span class="text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full">v1</span>
            </div>
          </div>
          <p class="text-gray-500 dark:text-gray-400 max-w-2xl">Documentação completa da API pública do Gestão Celular (SGI v1.1). Use esta API para integrar o sistema com outras ferramentas e automações.</p>
        </div>

        <!-- Autenticação -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-indigo-500">lock</span> Autenticação
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Todas as requisições devem incluir um cabeçalho <code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">Authorization</code> com sua API Key:</p>
          <pre class="bg-gray-900 dark:bg-black rounded-xl p-4 text-xs font-mono text-green-400 overflow-x-auto mb-4">Authorization: Bearer sk_live_SUA_API_KEY</pre>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
              <p class="text-2xl font-bold text-green-600">200</p><p class="text-xs text-gray-500">OK</p>
            </div>
            <div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
              <p class="text-2xl font-bold text-red-500">401</p><p class="text-xs text-gray-500">API Key inválida</p>
            </div>
            <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
              <p class="text-2xl font-bold text-amber-600">429</p><p class="text-xs text-gray-500">Rate limit (100/min)</p>
            </div>
          </div>
        </div>

        <!-- Webhooks -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-purple-500">webhook</span> Webhooks
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Cada payload enviado inclui uma assinatura HMAC-SHA256 no cabeçalho <code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">X-Webhook-Signature</code>. Use o <code class="text-purple-600 text-xs font-mono">secret</code> do seu webhook para validar a autenticidade.</p>
          <pre class="bg-gray-900 dark:bg-black rounded-xl p-4 text-xs font-mono text-yellow-300 overflow-x-auto mb-4">{
  "event": "membro.created",
  "timestamp": 1710000000,
  "data": {
    "id": "clxyz123",
    "name": "João Silva",
    "status": "Visitante"
  }
}</pre>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            ${['membro.created', 'membro.updated', 'membro.deleted', 'evento.created', 'frequencia.registrada'].map(e => `<div class="flex items-center gap-2 text-sm"><span class="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0"></span><code class="font-mono text-purple-600 dark:text-purple-400 text-xs">${e}</code></div>`).join('')}
          </div>
        </div>

        <!-- Endpoints por grupo -->
        ${endpoints.map(group => `
        <div class="mb-8">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-${group.color}-500">${group.icon}</span> ${group.group}
          </h2>
          ${group.items.map(renderEndpoint).join('')}
        </div>`).join('')}

        <!-- Footer -->
        <div class="text-center py-8 text-gray-400 text-sm border-t border-gray-200 dark:border-gray-700 mt-6">
          <p>SGI API v1.1 · Base URL: <code class="font-mono text-xs">${BASE_URL}/api/v1/</code></p>
        </div>
      </div>
    </div>`;

    window.toggleEndpoint = (el) => {
        const body = el.nextElementSibling;
        const icon = el.querySelector('.material-symbols-outlined:last-child');
        body.classList.toggle('hidden');
        icon.style.transform = body.classList.contains('hidden') ? '' : 'rotate(180deg)';
    };
}
