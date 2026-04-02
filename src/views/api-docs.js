import { store } from '../store.js';

export function apiDocsView() {
    const app = document.getElementById('app');
    const BASE = window.location.origin;

    // ── Paleta de métodos ────────────────────────────────────────────────────────
    const MC = {
        GET:    { bg: 'bg-blue-100 dark:bg-blue-900/40',   text: 'text-blue-700 dark:text-blue-300',   border: 'border-blue-200 dark:border-blue-700' },
        POST:   { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-700' },
        PUT:    { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700' },
        DELETE: { bg: 'bg-red-100 dark:bg-red-900/40',     text: 'text-red-600 dark:text-red-400',     border: 'border-red-200 dark:border-red-700' },
        PATCH:  { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-700' },
    };

    // ── Grupos de endpoints ──────────────────────────────────────────────────────
    const groups = [
        {
            id: 'membros', icon: 'people', label: 'Membros', color: 'indigo',
            permission: 'read_membros / write_membros',
            description: 'CRUD completo de membros da organização.',
            endpoints: [
                {
                    method: 'GET', path: '/api/v1/membros',
                    summary: 'Listar membros',
                    permission: 'read_membros',
                    description: 'Retorna lista paginada de membros. Inclui o objeto `cell` com nome da célula.',
                    query: [
                        { name: 'status',  type: 'string',  required: false, desc: 'Filtrar por status: Visitante, Membro, Congregado, Afastado…' },
                        { name: 'cellId',  type: 'string',  required: false, desc: 'ID da célula para filtrar membros vinculados' },
                        { name: 'page',    type: 'integer', required: false, desc: 'Número da página (padrão: 1)' },
                        { name: 'limit',   type: 'integer', required: false, desc: 'Itens por página (padrão: 50)' },
                    ],
                    response: `{
  "success": true,
  "data": [
    {
      "id": "clxyz123",
      "name": "João Silva",
      "phone": "11999990000",
      "email": "joao@email.com",
      "birthdate": "1990-05-15",
      "address": "Rua das Flores, 10",
      "status": "Membro",
      "cellId": "clcell456",
      "cell": { "id": "clcell456", "name": "Célula Norte" },
      "createdAt": "2024-01-10T14:00:00Z"
    }
  ],
  "meta": { "total": 42, "page": 1, "limit": 50 }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/membros?status=Membro&page=1" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
                {
                    method: 'GET', path: '/api/v1/membros/:id',
                    summary: 'Buscar membro por ID',
                    permission: 'read_membros',
                    description: 'Retorna detalhes completos de um membro, incluindo célula e trilhas espirituais.',
                    params: [{ name: 'id', type: 'string', required: true, desc: 'ID do membro (cuid)' }],
                    response: `{
  "success": true,
  "data": {
    "id": "clxyz123",
    "name": "João Silva",
    "phone": "11999990000",
    "status": "Membro",
    "cell": { "id": "clcell456", "name": "Célula Norte" },
    "personTracks": [
      { "id": "...", "completedAt": null, "track": { "name": "Discipulado" } }
    ]
  }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/membros/clxyz123" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
                {
                    method: 'POST', path: '/api/v1/membros',
                    summary: 'Criar membro',
                    permission: 'write_membros',
                    description: 'Cria um novo membro. Dispara o webhook `membro.created`.',
                    body: [
                        { name: 'name',      type: 'string',  required: true,  desc: 'Nome completo' },
                        { name: 'phone',     type: 'string',  required: false, desc: 'Telefone' },
                        { name: 'email',     type: 'string',  required: false, desc: 'E-mail' },
                        { name: 'birthdate', type: 'string',  required: false, desc: 'Data de nascimento (YYYY-MM-DD)' },
                        { name: 'address',   type: 'string',  required: false, desc: 'Endereço' },
                        { name: 'status',    type: 'string',  required: false, desc: 'Status (padrão: Visitante)' },
                        { name: 'cellId',    type: 'string',  required: false, desc: 'ID da célula' },
                    ],
                    response: `{ "success": true, "data": { "id": "clnew789", "name": "Maria Souza", "status": "Visitante", ... } }`,
                    curl: `curl -X POST "${BASE}/api/v1/membros" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Maria Souza","phone":"11988887777","birthdate":"1995-03-20","status":"Visitante"}'`,
                },
                {
                    method: 'PUT', path: '/api/v1/membros/:id',
                    summary: 'Atualizar membro',
                    permission: 'write_membros',
                    description: 'Atualiza os dados de um membro. Dispara o webhook `membro.updated`. Envie apenas os campos a alterar.',
                    params: [{ name: 'id', type: 'string', required: true, desc: 'ID do membro' }],
                    body: [
                        { name: 'name',      type: 'string', required: false, desc: 'Nome completo' },
                        { name: 'phone',     type: 'string', required: false, desc: 'Telefone' },
                        { name: 'status',    type: 'string', required: false, desc: 'Novo status' },
                        { name: 'cellId',    type: 'string', required: false, desc: 'ID da nova célula (null para desvincular)' },
                    ],
                    response: `{ "success": true, "data": { "id": "clxyz123", "status": "Membro", ... } }`,
                    curl: `curl -X PUT "${BASE}/api/v1/membros/clxyz123" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"Membro","cellId":"clcell456"}'`,
                },
                {
                    method: 'DELETE', path: '/api/v1/membros/:id',
                    summary: 'Remover membro',
                    permission: 'write_membros',
                    description: 'Remove permanentemente um membro. Dispara o webhook `membro.deleted`.',
                    params: [{ name: 'id', type: 'string', required: true, desc: 'ID do membro' }],
                    response: `{ "success": true, "message": "Membro removido com sucesso." }`,
                    curl: `curl -X DELETE "${BASE}/api/v1/membros/clxyz123" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
            ]
        },
        {
            id: 'celulas', icon: 'groups', label: 'Células', color: 'rose',
            permission: 'read_celulas',
            description: 'Consulta de células e seus membros.',
            endpoints: [
                {
                    method: 'GET', path: '/api/v1/celulas',
                    summary: 'Listar células',
                    permission: 'read_celulas',
                    description: 'Retorna células da organização com contagem de membros e geração vinculada.',
                    query: [
                        { name: 'status', type: 'string',  required: false, desc: 'Filtrar por status: ativa, inativa' },
                        { name: 'page',   type: 'integer', required: false, desc: 'Página (padrão: 1)' },
                        { name: 'limit',  type: 'integer', required: false, desc: 'Itens por página (padrão: 50)' },
                    ],
                    response: `{
  "success": true,
  "data": [
    {
      "id": "clcell456",
      "name": "Célula Norte",
      "status": "ativa",
      "meetingDay": "Quarta",
      "meetingTime": "19:30",
      "generation": { "id": "gen01", "name": "Geração Alpha" },
      "_count": { "people": 12 }
    }
  ],
  "meta": { "total": 8, "page": 1, "limit": 50 }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/celulas?status=ativa" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
                {
                    method: 'GET', path: '/api/v1/celulas/:id',
                    summary: 'Buscar célula por ID',
                    permission: 'read_celulas',
                    description: 'Retorna detalhes de uma célula incluindo líder e vice-líder com nome e telefone.',
                    params: [{ name: 'id', type: 'string', required: true, desc: 'ID da célula' }],
                    response: `{
  "success": true,
  "data": {
    "id": "clcell456",
    "name": "Célula Norte",
    "lider": { "id": "user01", "name": "Pedro Santos", "phone": "11977770000" },
    "vice":  { "id": "user02", "name": "Ana Lima",     "phone": "11966660000" },
    "generation": { "id": "gen01", "name": "Geração Alpha" },
    "_count": { "people": 12 }
  }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/celulas/clcell456" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
                {
                    method: 'GET', path: '/api/v1/celulas/:id/membros',
                    summary: 'Membros de uma célula',
                    permission: 'read_celulas',
                    description: 'Lista paginada de membros vinculados a uma célula específica.',
                    params: [{ name: 'id', type: 'string', required: true, desc: 'ID da célula' }],
                    query: [
                        { name: 'page',  type: 'integer', required: false, desc: 'Página (padrão: 1)' },
                        { name: 'limit', type: 'integer', required: false, desc: 'Itens por página (padrão: 100)' },
                    ],
                    response: `{
  "success": true,
  "data": [
    { "id": "clxyz123", "name": "João Silva", "phone": "11999990000", "status": "Membro" }
  ],
  "meta": { "total": 12, "page": 1, "limit": 100, "celula": { "id": "clcell456", "name": "Célula Norte" } }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/celulas/clcell456/membros" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
            ]
        },
        {
            id: 'eventos', icon: 'event', label: 'Eventos', color: 'green',
            permission: 'read_eventos / write_eventos',
            description: 'Gerenciamento de eventos do calendário.',
            endpoints: [
                {
                    method: 'GET', path: '/api/v1/eventos',
                    summary: 'Listar eventos',
                    permission: 'read_eventos',
                    description: 'Retorna eventos da organização, opcionalmente filtrados por período.',
                    query: [
                        { name: 'from',  type: 'string (YYYY-MM-DD)', required: false, desc: 'Data inicial' },
                        { name: 'to',    type: 'string (YYYY-MM-DD)', required: false, desc: 'Data final' },
                        { name: 'page',  type: 'integer', required: false, desc: 'Página (padrão: 1)' },
                        { name: 'limit', type: 'integer', required: false, desc: 'Itens por página (padrão: 50)' },
                    ],
                    response: `{
  "success": true,
  "data": [
    {
      "id": "clevt001",
      "title": "Culto de Domingo",
      "date": "2024-12-01",
      "startTime": "19:00",
      "location": "Sede Central",
      "type": "event",
      "color": "blue",
      "recurrence": "weekly"
    }
  ],
  "meta": { "total": 10, "page": 1, "limit": 50 }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/eventos?from=2024-12-01&to=2024-12-31" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
                {
                    method: 'POST', path: '/api/v1/eventos',
                    summary: 'Criar evento',
                    permission: 'write_eventos',
                    description: 'Cria um novo evento no calendário. Dispara o webhook `evento.created`.',
                    body: [
                        { name: 'title',       type: 'string',  required: true,  desc: 'Título do evento' },
                        { name: 'date',        type: 'string (YYYY-MM-DD)', required: true, desc: 'Data do evento' },
                        { name: 'startTime',   type: 'string (HH:MM)', required: false, desc: 'Hora de início' },
                        { name: 'endTime',     type: 'string (HH:MM)', required: false, desc: 'Hora de término' },
                        { name: 'description', type: 'string',  required: false, desc: 'Descrição' },
                        { name: 'location',    type: 'string',  required: false, desc: 'Local' },
                        { name: 'color',       type: 'string',  required: false, desc: 'Cor (blue, green, red, purple…). Padrão: blue' },
                        { name: 'type',        type: 'string',  required: false, desc: 'Tipo: event, birthday, reminder. Padrão: event' },
                        { name: 'recurrence',  type: 'string',  required: false, desc: 'Recorrência: none, weekly, monthly. Padrão: none' },
                        { name: 'icon',        type: 'string',  required: false, desc: 'Ícone Material Symbols' },
                    ],
                    response: `{ "success": true, "data": { "id": "clevt002", "title": "Culto de Domingo", "date": "2024-12-01", ... } }`,
                    curl: `curl -X POST "${BASE}/api/v1/eventos" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Culto de Domingo","date":"2024-12-01","startTime":"19:00","location":"Sede Central"}'`,
                },
                {
                    method: 'PUT', path: '/api/v1/eventos/:id',
                    summary: 'Atualizar evento',
                    permission: 'write_eventos',
                    description: 'Atualiza os dados de um evento existente.',
                    params: [{ name: 'id', type: 'string', required: true, desc: 'ID do evento' }],
                    body: [
                        { name: 'title', type: 'string', required: false, desc: 'Novo título' },
                        { name: 'date',  type: 'string (YYYY-MM-DD)', required: false, desc: 'Nova data' },
                    ],
                    response: `{ "success": true, "data": { "id": "clevt001", "title": "Culto Atualizado", ... } }`,
                    curl: `curl -X PUT "${BASE}/api/v1/eventos/clevt001" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Culto Atualizado","startTime":"20:00"}'`,
                },
                {
                    method: 'DELETE', path: '/api/v1/eventos/:id',
                    summary: 'Remover evento',
                    permission: 'write_eventos',
                    description: 'Remove um evento permanentemente.',
                    params: [{ name: 'id', type: 'string', required: true, desc: 'ID do evento' }],
                    response: `{ "success": true }`,
                    curl: `curl -X DELETE "${BASE}/api/v1/eventos/clevt001" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
            ]
        },
        {
            id: 'frequencias', icon: 'checklist', label: 'Frequências', color: 'amber',
            permission: 'read_frequencia',
            description: 'Registros de presença nas reuniões de células.',
            endpoints: [
                {
                    method: 'GET', path: '/api/v1/frequencias',
                    summary: 'Listar frequências',
                    permission: 'read_frequencia',
                    description: 'Retorna registros de presença em reuniões de célula, incluindo lista de presença por pessoa.',
                    query: [
                        { name: 'cellId', type: 'string',  required: false, desc: 'Filtrar por ID de célula' },
                        { name: 'from',   type: 'string (YYYY-MM-DD)', required: false, desc: 'Data inicial' },
                        { name: 'to',     type: 'string (YYYY-MM-DD)', required: false, desc: 'Data final' },
                        { name: 'page',   type: 'integer', required: false, desc: 'Página (padrão: 1)' },
                        { name: 'limit',  type: 'integer', required: false, desc: 'Itens por página (padrão: 50)' },
                    ],
                    response: `{
  "success": true,
  "data": [
    {
      "id": "attnd001",
      "date": "2024-11-20",
      "cellId": "clcell456",
      "cell": { "id": "clcell456", "name": "Célula Norte" },
      "records": [
        { "personId": "clxyz123", "status": "present" },
        { "personId": "clxyz124", "status": "absent" }
      ]
    }
  ],
  "meta": { "total": 24, "page": 1, "limit": 50 }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/frequencias?cellId=clcell456&from=2024-11-01" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
            ]
        },
        {
            id: 'aniversariantes', icon: 'cake', label: 'Aniversariantes', color: 'pink',
            permission: 'read_membros',
            description: 'Consulta de aniversariantes por período.',
            endpoints: [
                {
                    method: 'GET', path: '/api/v1/aniversariantes',
                    summary: 'Listar aniversariantes',
                    permission: 'read_membros',
                    description: 'Retorna membros que fazem aniversário no período informado, com dados da célula, líder e vice.',
                    query: [
                        { name: 'when', type: 'string', required: false, desc: '`today` · `tomorrow` · `week` (próximos 7 dias) · `today+tomorrow` (padrão)' },
                    ],
                    response: `{
  "success": true,
  "data": [
    {
      "isToday": true,
      "pessoa": {
        "id": "clxyz123",
        "name": "João Silva",
        "phone": "11999990000",
        "birthdate": "1990-05-15",
        "status": "Membro"
      },
      "celula": { "id": "clcell456", "name": "Célula Norte", "meetingDay": "Quarta", "meetingTime": "19:30" },
      "lider": { "id": "user01", "name": "Pedro Santos", "phone": "11977770000" },
      "vice":  { "id": "user02", "name": "Ana Lima",     "phone": "11966660000" }
    }
  ],
  "meta": { "total": 2, "when": "today+tomorrow" }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/aniversariantes?when=week" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
            ]
        },
        {
            id: 'stats', icon: 'bar_chart', label: 'Estatísticas', color: 'cyan',
            permission: 'read_membros',
            description: 'Resumo geral da organização.',
            endpoints: [
                {
                    method: 'GET', path: '/api/v1/stats',
                    summary: 'Estatísticas gerais',
                    permission: 'read_membros',
                    description: 'Retorna totais da organização: membros, células, eventos e distribuição de status.',
                    response: `{
  "success": true,
  "data": {
    "totalMembros": 142,
    "totalCelulas": 12,
    "celulasAtivas": 10,
    "totalEventos": 38,
    "membrosPorStatus": {
      "Visitante": 20,
      "Membro": 95,
      "Congregado": 18,
      "Afastado": 9
    }
  }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/stats" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
            ]
        },
        {
            id: 'financeiro', icon: 'payments', label: 'Financeiro', color: 'emerald',
            permission: 'read_financeiro',
            badge: 'Requer módulo financeiro habilitado',
            description: 'Acesso às doações registradas. Requer que o módulo financeiro esteja ativo na organização.',
            endpoints: [
                {
                    method: 'GET', path: '/api/v1/financeiro/doacoes',
                    summary: 'Listar doações',
                    permission: 'read_financeiro',
                    description: 'Retorna dízimos e ofertas. Valores em centavos + campo `amountFormatted` (R$ formatado). Retorna 403 se módulo financeiro desabilitado.',
                    query: [
                        { name: 'from',  type: 'string (YYYY-MM-DD)', required: false, desc: 'Data inicial' },
                        { name: 'to',    type: 'string (YYYY-MM-DD)', required: false, desc: 'Data final' },
                        { name: 'type',  type: 'string',  required: false, desc: 'Tipo: Dízimo, Oferta, Missões…' },
                        { name: 'page',  type: 'integer', required: false, desc: 'Página (padrão: 1)' },
                        { name: 'limit', type: 'integer', required: false, desc: 'Itens por página (padrão: 50)' },
                    ],
                    response: `{
  "success": true,
  "data": [
    {
      "id": "don001",
      "type": "Dízimo",
      "amount": 15000,
      "amountFormatted": "R$ 150,00",
      "date": "2024-11-10",
      "paymentMethod": "PIX",
      "pessoa": { "id": "clxyz123", "name": "João Silva" },
      "fundo": { "id": "fund01", "name": "Fundo Geral" }
    }
  ],
  "meta": { "total": 87, "page": 1, "limit": 50 }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/financeiro/doacoes?from=2024-01-01&type=D%C3%ADzimo" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
            ]
        },
        {
            id: 'ebd', icon: 'school', label: 'EBD', color: 'violet',
            permission: 'read_ebd',
            badge: 'Requer módulo EBD habilitado',
            description: 'Escola Bíblica Dominical — turmas e chamadas. Requer que o módulo EBD esteja ativo na organização.',
            endpoints: [
                {
                    method: 'GET', path: '/api/v1/ebd/turmas',
                    summary: 'Listar turmas EBD',
                    permission: 'read_ebd',
                    description: 'Retorna turmas da EBD com professor, segundo professor e contagem de alunos.',
                    query: [
                        { name: 'ativo',  type: 'boolean', required: false, desc: '`true` = ativas, `false` = inativas' },
                        { name: 'page',   type: 'integer', required: false, desc: 'Página (padrão: 1)' },
                        { name: 'limit',  type: 'integer', required: false, desc: 'Itens por página (padrão: 50)' },
                    ],
                    response: `{
  "success": true,
  "data": [
    {
      "id": "ebdcls01",
      "name": "Juvenis",
      "faixaEtaria": "12-17",
      "sala": "Sala 3",
      "ativo": true,
      "professor": { "id": "user10", "name": "Carlos Mendes" },
      "segundoProfessor": null,
      "_count": { "students": 15 }
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 50 }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/ebd/turmas?ativo=true" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
                {
                    method: 'GET', path: '/api/v1/ebd/turmas/:id/chamadas',
                    summary: 'Chamadas de uma turma',
                    permission: 'read_ebd',
                    description: 'Retorna registros de presença da turma EBD, com lista de alunos e presença individual.',
                    params: [{ name: 'id', type: 'string', required: true, desc: 'ID da turma EBD' }],
                    query: [
                        { name: 'from',  type: 'string (YYYY-MM-DD)', required: false, desc: 'Data inicial' },
                        { name: 'to',    type: 'string (YYYY-MM-DD)', required: false, desc: 'Data final' },
                        { name: 'page',  type: 'integer', required: false, desc: 'Página (padrão: 1)' },
                        { name: 'limit', type: 'integer', required: false, desc: 'Itens por página (padrão: 50)' },
                    ],
                    response: `{
  "success": true,
  "data": [
    {
      "id": "attnd_ebd01",
      "data": "2024-11-10",
      "presentes": 11,
      "totalAlunos": 15,
      "records": [
        { "presente": true, "justificado": false, "pessoa": { "id": "clxyz123", "name": "João Silva" } }
      ]
    }
  ],
  "meta": { "total": 8, "page": 1, "limit": 50, "turma": { "id": "ebdcls01", "name": "Juvenis" } }
}`,
                    curl: `curl -X GET "${BASE}/api/v1/ebd/turmas/ebdcls01/chamadas?from=2024-11-01" \\
  -H "Authorization: Bearer sk_live_SEU_TOKEN"`,
                },
            ]
        },
    ];

    // ── Permissões ────────────────────────────────────────────────────────────────
    const permissions = [
        { key: 'read_membros',    desc: 'Leitura de membros e aniversariantes' },
        { key: 'write_membros',   desc: 'Criação, edição e exclusão de membros' },
        { key: 'read_celulas',    desc: 'Leitura de células e seus membros' },
        { key: 'read_eventos',    desc: 'Leitura de eventos' },
        { key: 'write_eventos',   desc: 'Criação, edição e exclusão de eventos' },
        { key: 'read_frequencia', desc: 'Leitura de registros de frequência' },
        { key: 'read_turmas',     desc: 'Leitura de turmas (legado — use read_celulas)' },
        { key: 'read_financeiro', desc: 'Leitura de doações (requer módulo financeiro ativo)' },
        { key: 'read_ebd',        desc: 'Leitura de turmas e chamadas da EBD (requer módulo EBD ativo)' },
    ];

    // ── Webhooks ──────────────────────────────────────────────────────────────────
    const webhookEvents = [
        { id: 'membro.created',                label: 'Membro criado',                trigger: 'POST /api/v1/membros' },
        { id: 'membro.updated',                label: 'Membro atualizado',             trigger: 'PUT /api/v1/membros/:id' },
        { id: 'membro.deleted',                label: 'Membro removido',               trigger: 'DELETE /api/v1/membros/:id' },
        { id: 'membro.status.changed',         label: 'Status do membro alterado',     trigger: 'Edição via painel' },
        { id: 'celula.created',                label: 'Célula criada',                 trigger: 'Painel admin' },
        { id: 'celula.updated',                label: 'Célula atualizada',             trigger: 'Painel admin' },
        { id: 'evento.created',                label: 'Evento criado',                 trigger: 'POST /api/v1/eventos · Painel' },
        { id: 'evento.updated',                label: 'Evento atualizado',             trigger: 'PUT /api/v1/eventos/:id · Painel' },
        { id: 'evento.deleted',                label: 'Evento removido',               trigger: 'DELETE /api/v1/eventos/:id · Painel' },
        { id: 'frequencia.registrada',         label: 'Frequência registrada',         trigger: 'Registro de chamada via painel' },
        { id: 'notificacao.aniversario',       label: 'Aniversário de membro',         trigger: 'Job diário (birthdayService)' },
        { id: 'notificacao.membro_adicionado', label: 'Membro adicionado à célula',    trigger: 'Vinculação de membro à célula' },
        { id: 'notificacao.reuniao_celula',    label: 'Lembrete de reunião de célula', trigger: 'Job periódico' },
        { id: 'financial.doacao.created',      label: 'Doação registrada',             trigger: 'Criação de doação via painel/API' },
    ];

    // ── Helpers de renderização ───────────────────────────────────────────────────
    const methodBadge = (m) =>
        `<span class="inline-flex items-center text-xs font-bold font-mono px-2.5 py-1 rounded-md ${MC[m].bg} ${MC[m].text}">${m}</span>`;

    const renderTable = (rows, cols) => `
        <table class="w-full text-sm border-collapse">
          <thead><tr class="border-b border-gray-200 dark:border-gray-700">
            ${cols.map(c => `<th class="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">${c}</th>`).join('')}
          </tr></thead>
          <tbody>${rows.map(r => `<tr class="border-b border-gray-100 dark:border-gray-800 last:border-0">
            ${cols.map(c => `<td class="py-2 pr-4 align-top">${r[c.toLowerCase()] ?? ''}</td>`).join('')}
          </tr>`).join('')}</tbody>
        </table>`;

    const renderParams = (params) => `
        <div class="mb-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Path Parameters</p>
          <div class="space-y-1.5">
            ${params.map(p => `
            <div class="flex flex-wrap items-start gap-2 text-sm">
              <code class="text-purple-600 dark:text-purple-400 font-mono w-36 flex-shrink-0">{${p.name}}</code>
              <span class="text-gray-400 text-xs italic w-20 flex-shrink-0">${p.type}</span>
              <span class="text-red-500 text-xs w-20 flex-shrink-0">obrigatório</span>
              <span class="text-gray-500 dark:text-gray-400">${p.desc}</span>
            </div>`).join('')}
          </div>
        </div>`;

    const renderQuery = (query) => `
        <div class="mb-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Query Parameters</p>
          <div class="space-y-1.5">
            ${query.map(p => `
            <div class="flex flex-wrap items-start gap-2 text-sm">
              <code class="text-blue-600 dark:text-blue-400 font-mono w-36 flex-shrink-0">${p.name}</code>
              <span class="text-gray-400 text-xs italic w-36 flex-shrink-0">${p.type}</span>
              <span class="${p.required ? 'text-red-500' : 'text-gray-400'} text-xs w-20 flex-shrink-0">${p.required ? 'obrigatório' : 'opcional'}</span>
              <span class="text-gray-500 dark:text-gray-400">${p.desc}</span>
            </div>`).join('')}
          </div>
        </div>`;

    const renderBody = (body) => `
        <div class="mb-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Request Body <span class="text-gray-400 font-normal normal-case">(application/json)</span></p>
          <div class="space-y-1.5">
            ${body.map(p => `
            <div class="flex flex-wrap items-start gap-2 text-sm">
              <code class="text-green-600 dark:text-green-400 font-mono w-36 flex-shrink-0">${p.name}</code>
              <span class="text-gray-400 text-xs italic w-36 flex-shrink-0">${p.type}</span>
              <span class="${p.required ? 'text-red-500' : 'text-gray-400'} text-xs w-20 flex-shrink-0">${p.required ? 'obrigatório' : 'opcional'}</span>
              <span class="text-gray-500 dark:text-gray-400">${p.desc}</span>
            </div>`).join('')}
          </div>
        </div>`;

    const renderEndpoint = (ep, groupId, idx) => {
        const id = `ep-${groupId}-${idx}`;
        const m = MC[ep.method];
        return `
        <div class="endpoint-card border ${m.border} bg-white dark:bg-gray-800/60 rounded-xl overflow-hidden mb-3">
          <button class="ep-header w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left" data-target="${id}">
            ${methodBadge(ep.method)}
            <code class="text-sm font-mono text-gray-900 dark:text-white font-medium flex-1">${ep.path}</code>
            <span class="text-sm text-gray-500 dark:text-gray-400 hidden md:block mr-2">${ep.summary}</span>
            <span class="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-mono hidden lg:block">${ep.permission}</span>
            <span class="material-symbols-outlined text-gray-400 text-lg ml-2 ep-chevron transition-transform duration-200">expand_more</span>
          </button>
          <div id="${id}" class="ep-body hidden border-t ${m.border} bg-gray-50 dark:bg-gray-900/40 p-5">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-5">${ep.description}</p>
            ${ep.params ? renderParams(ep.params) : ''}
            ${ep.query  ? renderQuery(ep.query)   : ''}
            ${ep.body   ? renderBody(ep.body)      : ''}
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Exemplo (cURL)</p>
                  <button onclick="copyCode(this)" data-text="${ep.curl.replace(/"/g, '&quot;')}" class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1 transition-colors">
                    <span class="material-symbols-outlined text-sm">content_copy</span> Copiar
                  </button>
                </div>
                <pre class="bg-gray-900 dark:bg-black rounded-xl p-4 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">${ep.curl}</pre>
              </div>
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Resposta <span class="text-green-500 font-normal normal-case">200 OK</span></p>
                <pre class="bg-gray-900 dark:bg-black rounded-xl p-4 text-xs font-mono text-yellow-300 overflow-x-auto whitespace-pre-wrap leading-relaxed h-full">${ep.response}</pre>
              </div>
            </div>
          </div>
        </div>`;
    };

    // ── Renderiza a página ────────────────────────────────────────────────────────
    app.innerHTML = `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">

      <!-- Top bar -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onclick="history.back()" class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="flex items-center gap-2 flex-1">
            <div class="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span class="material-symbols-outlined text-white text-base">api</span>
            </div>
            <div>
              <span class="font-bold text-gray-900 dark:text-white text-sm">API Reference</span>
              <span class="ml-2 text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full">v1</span>
            </div>
          </div>
          <div class="relative hidden md:block">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">search</span>
            <input id="search-docs" type="text" placeholder="Buscar endpoint…" class="pl-9 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64">
          </div>
          <a href="${BASE}/api/v1" target="_blank" class="hidden md:flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 transition-colors">
            <span class="material-symbols-outlined text-sm">open_in_new</span> Base URL
          </a>
        </div>
      </div>

      <div class="max-w-7xl mx-auto w-full flex-1 flex gap-0 md:gap-6 px-4 py-6">

        <!-- Sidebar -->
        <aside class="hidden md:block w-52 flex-shrink-0">
          <nav class="sticky top-20 space-y-0.5">
            <a href="#section-auth" class="doc-nav flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors">
              <span class="material-symbols-outlined text-base text-indigo-500">lock</span> Autenticação
            </a>
            ${groups.map(g => `
            <a href="#section-${g.id}" class="doc-nav flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors">
              <span class="material-symbols-outlined text-base text-${g.color}-500">${g.icon}</span>
              ${g.label}
              <span class="ml-auto text-xs text-gray-400">${g.endpoints.length}</span>
            </a>`).join('')}
            <a href="#section-webhooks" class="doc-nav flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors">
              <span class="material-symbols-outlined text-base text-purple-500">webhook</span> Webhooks
              <span class="ml-auto text-xs text-gray-400">14</span>
            </a>
            <a href="#section-permissions" class="doc-nav flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors">
              <span class="material-symbols-outlined text-base text-gray-500">shield</span> Permissões
            </a>
            <a href="#section-errors" class="doc-nav flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors">
              <span class="material-symbols-outlined text-base text-red-400">error</span> Erros
            </a>
          </nav>
        </aside>

        <!-- Main content -->
        <main class="flex-1 min-w-0 space-y-10">

          <!-- Autenticação -->
          <section id="section-auth">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                <span class="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-lg">lock</span>
              </div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Autenticação</h2>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <p class="text-sm text-gray-600 dark:text-gray-400">Todas as requisições à API v1 requerem um cabeçalho <code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono text-indigo-600 dark:text-indigo-400">Authorization</code> com sua <strong>API Key</strong>:</p>
              <pre class="bg-gray-900 dark:bg-black rounded-xl p-4 text-sm font-mono text-green-400">Authorization: Bearer sk_live_SUA_API_KEY</pre>
              <p class="text-sm text-gray-600 dark:text-gray-400">As API Keys são geradas em <strong>Configurações → Ferramentas &amp; Acesso → API — Chaves de Acesso</strong>. Cada chave tem um conjunto de permissões configurável.</p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                ${[['200','OK','green'],['400','Bad Request','amber'],['401','Não autorizado','red'],['403','Sem permissão','orange'],['404','Não encontrado','gray'],['429','Rate limit','purple'],['500','Erro interno','rose']].map(([code, label, color]) => `
                <div class="bg-${color}-50 dark:bg-${color}-900/20 rounded-xl p-3 text-center">
                  <p class="text-lg font-bold text-${color}-600 dark:text-${color}-400">${code}</p>
                  <p class="text-xs text-gray-500">${label}</p>
                </div>`).join('')}
              </div>
              <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
                <span class="material-symbols-outlined text-amber-500 flex-shrink-0">info</span>
                <p class="text-sm text-amber-800 dark:text-amber-300">Rate limit: <strong>100 requisições/minuto</strong> por API Key. Ao exceder, a API retorna HTTP 429. Implemente backoff exponencial em integrações de produção.</p>
              </div>
            </div>
          </section>

          <!-- Grupos de endpoints -->
          ${groups.map(g => `
          <section id="section-${g.id}" class="endpoint-section">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-9 h-9 bg-${g.color}-100 dark:bg-${g.color}-900/30 rounded-lg flex items-center justify-center">
                <span class="material-symbols-outlined text-${g.color}-600 dark:text-${g.color}-400 text-lg">${g.icon}</span>
              </div>
              <div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">${g.label}</h2>
                ${g.badge ? `<span class="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">${g.badge}</span>` : ''}
              </div>
              <span class="ml-auto text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">${g.permission}</span>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">${g.description}</p>
            ${g.endpoints.map((ep, idx) => renderEndpoint(ep, g.id, idx)).join('')}
          </section>`).join('')}

          <!-- Webhooks -->
          <section id="section-webhooks">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-9 h-9 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <span class="material-symbols-outlined text-purple-600 dark:text-purple-400 text-lg">webhook</span>
              </div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Webhooks</h2>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
              <p class="text-sm text-gray-600 dark:text-gray-400">Configure webhooks em <strong>Configurações → Webhooks</strong>. Cada payload é assinado com HMAC-SHA256 usando o <code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">secret</code> do webhook.</p>

              <!-- Assinatura -->
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Verificação da Assinatura</p>
                <pre class="bg-gray-900 dark:bg-black rounded-xl p-4 text-xs font-mono text-green-400 overflow-x-auto">// Node.js
const crypto = require('crypto');
const sig = crypto.createHmac('sha256', SEU_SECRET)
                   .update(rawBody)
                   .digest('hex');
if (req.headers['x-webhook-signature'] !== 'sha256=' + sig) {
  return res.status(401).send('Assinatura inválida');
}</pre>
              </div>

              <!-- Payload -->
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Estrutura do Payload</p>
                <pre class="bg-gray-900 dark:bg-black rounded-xl p-4 text-xs font-mono text-yellow-300 overflow-x-auto">{
  "id": "evt_uuid",
  "event": "membro.created",
  "apiVersion": "2026-04-02",
  "organizationId": "org_cuid",
  "timestamp": 1710000000,
  "data": { ... }
}</pre>
              </div>

              <!-- Eventos -->
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Eventos disponíveis (${webhookEvents.length})</p>
                <div class="grid md:grid-cols-2 gap-2">
                  ${webhookEvents.map(e => `
                  <div class="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                    <div class="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-1.5"></div>
                    <div>
                      <code class="text-xs font-mono text-purple-600 dark:text-purple-400">${e.id}</code>
                      <p class="text-xs text-gray-500 mt-0.5">${e.label}</p>
                      <p class="text-xs text-gray-400 italic">${e.trigger}</p>
                    </div>
                  </div>`).join('')}
                </div>
              </div>

              <!-- Retry -->
              <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
                <span class="material-symbols-outlined text-blue-500 flex-shrink-0">replay</span>
                <div class="text-sm text-blue-800 dark:text-blue-300">
                  <p class="font-semibold mb-1">Retry automático</p>
                  <p>Em caso de falha (timeout ou HTTP fora de 2xx), o sistema tenta reenviar automaticamente com backoff: <strong>1min → 5min → 30min → 2h → 5h</strong> (máximo 5 tentativas). Reenvio manual disponível em <strong>Configurações → Webhooks → Logs → Entregas com Falha</strong>.</p>
                </div>
              </div>
            </div>
          </section>

          <!-- Permissões -->
          <section id="section-permissions">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <span class="material-symbols-outlined text-gray-500 text-lg">shield</span>
              </div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Permissões</h2>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-56">Permissão</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                  ${permissions.map(p => `
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                    <td class="px-5 py-3"><code class="text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">${p.key}</code></td>
                    <td class="px-5 py-3 text-gray-600 dark:text-gray-400">${p.desc}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </section>

          <!-- Erros -->
          <section id="section-errors">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-9 h-9 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <span class="material-symbols-outlined text-red-500 text-lg">error</span>
              </div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">Tratamento de Erros</h2>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <p class="text-sm text-gray-600 dark:text-gray-400">Todos os erros seguem o mesmo formato:</p>
              <pre class="bg-gray-900 dark:bg-black rounded-xl p-4 text-sm font-mono text-red-400">{ "success": false, "error": "Mensagem descritiva do erro." }</pre>
              <div class="overflow-x-auto">
                <table class="w-full text-sm border-collapse">
                  <thead><tr class="border-b border-gray-200 dark:border-gray-700">
                    <th class="text-left py-2 pr-6 text-xs font-semibold text-gray-500 uppercase">Código</th>
                    <th class="text-left py-2 pr-6 text-xs font-semibold text-gray-500 uppercase">Significado</th>
                    <th class="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Ação recomendada</th>
                  </tr></thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                    ${[
                        ['400', 'Bad Request', 'Verifique os campos obrigatórios e formatos de dados'],
                        ['401', 'API Key inválida ou ausente', 'Verifique o cabeçalho Authorization'],
                        ['403', 'Sem permissão / módulo desabilitado', 'Verifique as permissões da API Key ou se o módulo está ativo'],
                        ['404', 'Recurso não encontrado', 'Confirme o ID enviado'],
                        ['429', 'Rate limit excedido (100/min)', 'Implemente backoff e retry'],
                        ['500', 'Erro interno do servidor', 'Tente novamente; se persistir, contate o suporte'],
                    ].map(([code, sig, action]) => `
                    <tr>
                      <td class="py-2.5 pr-6 font-mono font-bold text-red-500">${code}</td>
                      <td class="py-2.5 pr-6 text-gray-700 dark:text-gray-300">${sig}</td>
                      <td class="py-2.5 text-gray-500 dark:text-gray-400">${action}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- Footer -->
          <div class="text-center py-6 text-gray-400 text-xs border-t border-gray-200 dark:border-gray-700">
            SGI API v1 · Base URL: <code class="font-mono">${BASE}/api/v1/</code>
          </div>

        </main>
      </div>
    </div>`;

    // ── Interatividade ────────────────────────────────────────────────────────────

    // Expandir/colapsar endpoints
    document.querySelectorAll('.ep-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.target);
            const chevron = btn.querySelector('.ep-chevron');
            const open = !target.classList.contains('hidden');
            target.classList.toggle('hidden', open);
            chevron.style.transform = open ? '' : 'rotate(180deg)';
        });
    });

    // Copiar código
    window.copyCode = (btn) => {
        const text = btn.getAttribute('data-text');
        navigator.clipboard.writeText(text).then(() => {
            const orig = btn.innerHTML;
            btn.innerHTML = '<span class="material-symbols-outlined text-sm text-green-500">check</span> Copiado!';
            setTimeout(() => { btn.innerHTML = orig; }, 1800);
        });
    };

    // Busca de endpoints
    document.getElementById('search-docs')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.endpoint-card').forEach(card => {
            const text = card.innerText.toLowerCase();
            card.style.display = (!q || text.includes(q)) ? '' : 'none';
        });
        document.querySelectorAll('.endpoint-section').forEach(section => {
            const visible = [...section.querySelectorAll('.endpoint-card')].some(c => c.style.display !== 'none');
            section.style.display = (!q || visible) ? '' : 'none';
        });
    });

    // Scroll suave para âncoras do sidebar
    document.querySelectorAll('.doc-nav').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const id = a.getAttribute('href').slice(1);
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}
