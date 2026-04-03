const https = require('https');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlYWE0MjU5Mi0yNjY0LTQxZGMtOWIyOC00NWYzMjcwZTVhZTciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2RjMTc1ZjQtNGQ5Zi00MWYzLTg4MDQtNjM4ZmM2MmJhYTNiIiwiaWF0IjoxNzc1MTYyMzM1fQ.xWlCpNubWYPfiYte5ujhy26YcldF0lTi5fWbjzQjau4';
const WORKFLOW_ID = 'sBozgJz6piBlMkTi';
const WEBHOOK_PATH = '9431d1d4-13d3-4a72-ba9b-0b9737c36b8a';
const EVO_URL = 'https://evolution.familiapaz1.com.br/message/sendText/Paz1';
const EVO_KEY = '580CE64C637C-47BC-ADEB-3583E1C1F844';

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

const ANIVERSARIO_CODE = `const body = $input.first().json.body;
const data = body.data;
const dest = [];
const hoje = data.isToday ? '🎂 *Hoje*' : '📅 Em breve';
const msg = hoje + ' é o aniversário de *' + data.pessoa.name + '*! 🎉\\nCélula: ' + (data.celula?.name || 'Sem célula');
if (data.lider?.phone) {
  dest.push({ destinatario_tipo: 'lider_celula', destinatario_nome: data.lider.name, telefone: data.lider.phone, evento_tipo: body.event, organizationId: body.organizationId, pessoa_nome: data.pessoa.name, celula_nome: data.celula?.name || '', isToday: data.isToday, mensagem: msg });
}
for (const lg of (data.liderGeracao || [])) {
  if (lg.phone) dest.push({ destinatario_tipo: 'lider_geracao', destinatario_nome: lg.name, telefone: lg.phone, evento_tipo: body.event, organizationId: body.organizationId, pessoa_nome: data.pessoa.name, celula_nome: data.celula?.name || '', isToday: data.isToday, mensagem: msg });
}
for (const sv of (data.supervisores || [])) {
  if (sv.phone) dest.push({ destinatario_tipo: 'supervisor', destinatario_nome: sv.name, telefone: sv.phone, evento_tipo: body.event, organizationId: body.organizationId, pessoa_nome: data.pessoa.name, celula_nome: data.celula?.name || '', isToday: data.isToday, mensagem: msg });
}
return dest.map(d => ({ json: d }));`;

const EVENTO_CODE = `const body = $input.first().json.body;
const data = body.data;
const evento = data.evento;
const categoria = data.categoria || 'local';
const destinatarios = data.destinatarios || [];
const dataEvento = evento.date ? new Date(evento.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : '';
const horaStr = evento.startTime ? ' às ' + evento.startTime : '';
const localStr = evento.location ? '\\n📍 ' + evento.location : '';
const escopo = categoria === 'geral' ? '🌐 Evento Geral' : '🏘️ Evento Local';
const msg = '📅 *Nova programação!*\\n\\n*' + evento.title + '*\\n' + escopo + '\\n🗓️ ' + dataEvento + horaStr + localStr + '\\n\\nFique atento à programação!';
const roles = ['LEADER', 'VICE_LEADER', 'LIDER_GERACAO', 'SUPERVISOR'];
const filtrados = destinatarios.filter(d => roles.includes(d.role) && d.phone);
return filtrados.map(d => ({
  json: {
    destinatario_tipo: d.role.toLowerCase(),
    destinatario_nome: d.name,
    telefone: d.phone,
    evento_tipo: body.event,
    organizationId: body.organizationId,
    evento_titulo: evento.title,
    evento_data: evento.date,
    evento_hora: evento.startTime || '',
    evento_local: evento.location || '',
    evento_categoria: categoria,
    mensagem: msg
  }
}));`;

const workflow = {
    name: 'CRM Celular - Notificações WhatsApp',
    nodes: [
        {
            parameters: { httpMethod: 'POST', path: WEBHOOK_PATH, options: {} },
            type: 'n8n-nodes-base.webhook', typeVersion: 2.1,
            position: [0, 0], id: 'e258cfce-d01b-40fc-bb74-b7ec150cc86b',
            name: 'Webhook CRM', webhookId: WEBHOOK_PATH
        },
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
        { parameters: { jsCode: MEMBRO_CODE }, type: 'n8n-nodes-base.code', typeVersion: 2, position: [700, -280], id: 'code-membro-adicionado', name: 'Preparar Notif. Membro' },
        { parameters: { jsCode: ANIVERSARIO_CODE }, type: 'n8n-nodes-base.code', typeVersion: 2, position: [700, 0], id: 'code-aniversario', name: 'Preparar Notif. Aniversário' },
        { parameters: { jsCode: EVENTO_CODE }, type: 'n8n-nodes-base.code', typeVersion: 2, position: [700, 280], id: 'code-evento', name: 'Preparar Notif. Evento' },
        makeEvoNode('evo-membro',      'WhatsApp - Membro Adicionado', 1060, -280),
        makeEvoNode('evo-aniversario', 'WhatsApp - Aniversário',       1060,    0),
        makeEvoNode('evo-evento',      'WhatsApp - Evento',            1060,  280)
    ],
    connections: {
        'Webhook CRM':                { main: [[{ node: 'Tipo de Evento',               type: 'main', index: 0 }]] },
        'Tipo de Evento':             { main: [[{ node: 'Preparar Notif. Membro',        type: 'main', index: 0 }], [{ node: 'Preparar Notif. Aniversário', type: 'main', index: 0 }], [{ node: 'Preparar Notif. Evento', type: 'main', index: 0 }]] },
        'Preparar Notif. Membro':     { main: [[{ node: 'WhatsApp - Membro Adicionado', type: 'main', index: 0 }]] },
        'Preparar Notif. Aniversário':{ main: [[{ node: 'WhatsApp - Aniversário',        type: 'main', index: 0 }]] },
        'Preparar Notif. Evento':     { main: [[{ node: 'WhatsApp - Evento',             type: 'main', index: 0 }]] }
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
