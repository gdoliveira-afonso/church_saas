const https = require('https');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlYWE0MjU5Mi0yNjY0LTQxZGMtOWIyOC00NWYzMjcwZTVhZTciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2RjMTc1ZjQtNGQ5Zi00MWYzLTg4MDQtNjM4ZmM2MmJhYTNiIiwiaWF0IjoxNzc1MTYyMzM1fQ.xWlCpNubWYPfiYte5ujhy26YcldF0lTi5fWbjzQjau4';
const WORKFLOW_ID = 'sBozgJz6piBlMkTi';
const WEBHOOK_PATH = '9431d1d4-13d3-4a72-ba9b-0b9737c36b8a';
const EVO_URL = 'https://evolution.familiapaz1.com.br/message/sendText/Paz1';
const EVO_KEY = '580CE64C637C-47BC-ADEB-3583E1C1F844';
const CRM_BASE_URL = 'http://crm_celular_backend:3000';
const CRM_API_KEY = 'COLOQUE_SUA_API_KEY_AQUI'; // usuário deve atualizar

function makeEvoNode(id, name, posX, posY) {
    return {
        parameters: {
            method: 'POST',
            url: EVO_URL,
            sendHeaders: true,
            headerParameters: { parameters: [{ name: 'apikey', value: EVO_KEY }] },
            sendBody: true,
            specifyBody: 'keypair',
            bodyParameters: {
                parameters: [
                    { name: 'number', value: "={{ ('55' + $json.telefone).replace(/\\D/g, '') }}" },
                    { name: 'text',   value: '={{ $json.mensagem }}' }
                ]
            },
            options: {}
        },
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.4,
        position: [posX, posY],
        id: id,
        name: name
    };
}

const MEMBRO_CODE = `const body = $input.first().json.body;
const data = body.data;
if (!data.lider || !data.lider.phone) return [];
const statusLabel = {
  NOVO_CONVERTIDO: 'Novo Convertido',
  RECONCILIACAO: 'Reconciliação',
  MEMBRO: 'Membro',
  VISITANTE: 'Visitante'
};
const status = statusLabel[data.pessoa.status] || data.pessoa.status;
return [{
  json: {
    destinatario_tipo: 'lider_celula',
    destinatario_nome: data.lider.name,
    telefone: data.lider.phone,
    evento_tipo: body.event,
    organizationId: body.organizationId,
    membro_nome: data.pessoa.name,
    membro_status: status,
    membro_telefone: data.pessoa.phone || '',
    celula_nome: data.celula?.name || '',
    adicionado_em: data.adicionadoEm,
    mensagem: '✨ *Novo membro na célula!* ✨\\n\\n👤 *Nome:* ' + data.pessoa.name + '\\n📌 *Status:* ' + status + '\\n🏘️ *Célula:* ' + (data.celula?.name || '') + '\\n\\n🙌 Que Deus abençoe essa nova caminhada!'
  }
}];`;

const ANIVERSARIO_PREP_CODE = `const webhookBody = $('Webhook CRM').first().json.body;
const aniversario = webhookBody.data;
const contatos = $input.first().json.data;
const hoje = aniversario.isToday ? '🎂 *Hoje*' : '📅 Em breve';
const celulaNome = contatos.celula?.name || aniversario.celula?.name || '';
const msg = hoje + ' é o aniversário de *' + aniversario.pessoa.name + '*! 🎉\\nCélula: ' + celulaNome;
const dest = [];
if (contatos.lider?.phone) dest.push({ tipo: 'lider_celula', nome: contatos.lider.name, telefone: contatos.lider.phone });
if (contatos.vice?.phone) dest.push({ tipo: 'vice_lider', nome: contatos.vice.name, telefone: contatos.vice.phone });
for (const lg of (contatos.liderGeracao || [])) { if (lg.phone) dest.push({ tipo: 'lider_geracao', nome: lg.name, telefone: lg.phone }); }
for (const sv of (contatos.supervisores || [])) { if (sv.phone) dest.push({ tipo: 'supervisor', nome: sv.name, telefone: sv.phone }); }
return dest.map(d => ({ json: { destinatario_tipo: d.tipo, destinatario_nome: d.nome, telefone: d.telefone, mensagem: msg } }));`;

const EVENTO_PREP_CODE = `const webhookBody = $('Webhook CRM').first().json.body;
const eventoData = webhookBody.data.evento;
const lideranca = $input.first().json.data || [];
const dataEvento = eventoData.date ? new Date(eventoData.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : '';
const horaStr = eventoData.startTime ? ' às ' + eventoData.startTime : '';
const localStr = eventoData.location ? '\\n📍 ' + eventoData.location : '';
const msg = '📅 *Nova programação!*\\n\\n*' + eventoData.title + '*\\n🗓️ ' + dataEvento + horaStr + localStr + '\\n\\nFique atento à programação!';
return lideranca.filter(c => c.phone).map(c => ({ json: { destinatario_tipo: c.role.toLowerCase(), destinatario_nome: c.name, telefone: c.phone, mensagem: msg } }));`;

const workflow = {
    name: 'CRM Celular - Notificações WhatsApp',
    nodes: [
        // 1. Webhook de entrada
        {
            parameters: { httpMethod: 'POST', path: WEBHOOK_PATH, options: {} },
            type: 'n8n-nodes-base.webhook', typeVersion: 2.1,
            position: [0, 0], id: 'e258cfce-d01b-40fc-bb74-b7ec150cc86b',
            name: 'Webhook CRM', webhookId: WEBHOOK_PATH
        },
        // 2. Switch por tipo de evento
        {
            parameters: {
                rules: {
                    values: [
                        { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, combinator: 'and', conditions: [{ leftValue: '={{ $json.body.event }}', rightValue: 'notificacao.membro_adicionado', operator: { type: 'string', operation: 'equals' } }] }, renameOutput: true, outputKey: 'Membro Adicionado' },
                        { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, combinator: 'and', conditions: [{ leftValue: '={{ $json.body.event }}', rightValue: 'notificacao.aniversario', operator: { type: 'string', operation: 'equals' } }] }, renameOutput: true, outputKey: 'Aniversário' },
                        { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, combinator: 'and', conditions: [{ leftValue: '={{ $json.body.event }}', rightValue: 'evento.criado', operator: { type: 'string', operation: 'equals' } }] }, renameOutput: true, outputKey: 'Evento Criado' }
                    ]
                },
                options: {}
            },
            type: 'n8n-nodes-base.switch', typeVersion: 3.2,
            position: [320, 0], id: 'switch-tipo-evento', name: 'Tipo de Evento'
        },
        // 3. Membro adicionado — prepara notificação (dados já vêm no payload)
        { parameters: { jsCode: MEMBRO_CODE }, type: 'n8n-nodes-base.code', typeVersion: 2, position: [700, -300], id: 'code-membro-adicionado', name: 'Preparar Notif. Membro' },
        // 4. WhatsApp membro
        makeEvoNode('evo-membro', 'WhatsApp - Membro Adicionado', 1060, -300),
        // 5. Aniversário — busca contatos dinamicamente na API do CRM
        {
            parameters: {
                method: 'GET',
                url: CRM_BASE_URL + '/api/v1/celulas/={{ $json.body.data.celula.id }}/contatos-notificacao',
                sendHeaders: true,
                headerParameters: { parameters: [{ name: 'Authorization', value: 'Bearer ' + CRM_API_KEY }] },
                options: {}
            },
            type: 'n8n-nodes-base.httpRequest', typeVersion: 4.4,
            position: [700, 0], id: 'http-buscar-contatos-aniversario', name: 'Buscar Contatos Aniversário'
        },
        // 6. Prepara notificação de aniversário com contatos dinâmicos
        { parameters: { jsCode: ANIVERSARIO_PREP_CODE }, type: 'n8n-nodes-base.code', typeVersion: 2, position: [1060, 0], id: 'code-aniversario', name: 'Preparar Notif. Aniversário' },
        // 7. WhatsApp aniversário
        makeEvoNode('evo-aniversario', 'WhatsApp - Aniversário', 1420, 0),
        // 8. Evento — busca toda a liderança da org dinamicamente
        {
            parameters: {
                method: 'GET',
                url: CRM_BASE_URL + '/api/v1/lideranca/contatos',
                sendHeaders: true,
                headerParameters: { parameters: [{ name: 'Authorization', value: 'Bearer ' + CRM_API_KEY }] },
                options: {}
            },
            type: 'n8n-nodes-base.httpRequest', typeVersion: 4.4,
            position: [700, 300], id: 'http-buscar-lideranca', name: 'Buscar Liderança'
        },
        // 9. Prepara notificação de evento com liderança dinâmica
        { parameters: { jsCode: EVENTO_PREP_CODE }, type: 'n8n-nodes-base.code', typeVersion: 2, position: [1060, 300], id: 'code-evento', name: 'Preparar Notif. Evento' },
        // 10. WhatsApp evento
        makeEvoNode('evo-evento', 'WhatsApp - Evento', 1420, 300)
    ],
    connections: {
        'Webhook CRM':                    { main: [[{ node: 'Tipo de Evento',                   type: 'main', index: 0 }]] },
        'Tipo de Evento':                 { main: [
            [{ node: 'Preparar Notif. Membro',        type: 'main', index: 0 }],
            [{ node: 'Buscar Contatos Aniversário',   type: 'main', index: 0 }],
            [{ node: 'Buscar Liderança',              type: 'main', index: 0 }]
        ]},
        'Preparar Notif. Membro':         { main: [[{ node: 'WhatsApp - Membro Adicionado',     type: 'main', index: 0 }]] },
        'Buscar Contatos Aniversário':    { main: [[{ node: 'Preparar Notif. Aniversário',      type: 'main', index: 0 }]] },
        'Preparar Notif. Aniversário':    { main: [[{ node: 'WhatsApp - Aniversário',           type: 'main', index: 0 }]] },
        'Buscar Liderança':               { main: [[{ node: 'Preparar Notif. Evento',           type: 'main', index: 0 }]] },
        'Preparar Notif. Evento':         { main: [[{ node: 'WhatsApp - Evento',                type: 'main', index: 0 }]] }
    },
    settings: { executionOrder: 'v1' }
};

const body = JSON.stringify(workflow);

const options = {
    hostname: 'n8n.familiapaz1.com.br',
    path: `/api/v1/workflows/${WORKFLOW_ID}`,
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const j = JSON.parse(data);
            if (j.id) console.log('✅ Workflow atualizado: id=' + j.id + ' nodes=' + j.nodes.length);
            else console.log('❌ Erro:', data.substring(0, 500));
        } catch (e) { console.log('❌ Parse error:', data.substring(0, 500)); }
    });
});
req.on('error', e => console.error('❌ Request error:', e.message));
req.write(body);
req.end();
