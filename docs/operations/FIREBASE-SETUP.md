# Configuração Firebase — Push Notifications (FCM)

Guia para ativar as push notifications no SGI via Firebase Cloud Messaging (FCM HTTP v1).

---

## Pré-requisitos

- Conta Google / Google Firebase
- Arquivo `google-services.json` já no projeto Android (`android/app/google-services.json`)
- Acesso ao servidor para editar variáveis de ambiente

---

## 1. Obter o ID do Projeto Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Selecione seu projeto
3. Vá em **Configurações do Projeto** (ícone de engrenagem) → **Geral**
4. Copie o **ID do projeto** (ex: `sgi-igreja-12345`)

---

## 2. Gerar a Service Account Key

1. No Console Firebase → **Configurações do Projeto** → aba **Contas de serviço**
2. Clique em **Gerar nova chave privada**
3. Um arquivo JSON será baixado (ex: `sgi-firebase-adminsdk.json`)

> **⚠️ IMPORTANTE:** Nunca commite este arquivo no repositório. Guarde-o com segurança.

---

## 3. Configurar variáveis de ambiente no servidor

Edite o arquivo `.env` do servidor:

```bash
# ID do projeto Firebase
FCM_PROJECT_ID=sgi-igreja-12345

# Conteúdo do JSON da service account em uma única linha
FCM_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key_id":"..."}
```

### Como converter o JSON para uma linha (Linux/Mac):

```bash
cat sgi-firebase-adminsdk.json | tr -d '\n'
```

### Como converter (Windows PowerShell):

```powershell
(Get-Content sgi-firebase-adminsdk.json -Raw) -replace "`r`n|`n","" | Set-Clipboard
```

---

## 4. Reiniciar o servidor

```bash
docker-compose restart backend
# ou
pm2 restart sgi-backend
```

Você verá no log que o push está ativo quando o primeiro token for registrado:
```
[Push] FCM inicializado para projeto: sgi-igreja-12345
```

---

## 5. Como funciona

### Fluxo completo:

```
App Android abre → Capacitor solicita permissão de notificação
→ FCM retorna token único do dispositivo
→ App envia token para POST /api/notifications/device-token
→ Token salvo em DeviceToken (banco de dados)

Evento acontece (ex: aniversário, nova programação)
→ Servidor cria Notification (in-app)
→ Servidor busca DeviceTokens dos destinatários
→ Servidor envia push via FCM HTTP v1
→ Android exibe a notificação no sistema
```

### Endpoints de gerenciamento de token:

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/notifications/device-token` | Registra token do dispositivo |
| `DELETE` | `/api/notifications/device-token` | Remove token (logout) |

### Endpoints de notificações in-app:

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/notifications` | Lista notificações do usuário |
| `PATCH` | `/api/notifications/:id/read` | Marca uma como lida |
| `POST` | `/api/notifications/read-all` | Marca todas como lidas |

---

## 6. Quando push é enviado

Push notifications são disparadas automaticamente em:

| Evento | Destinatários |
|--------|---------------|
| Nova programação criada | Todos os líderes e vice-líderes |
| Programação atualizada (data/título) | Todos os líderes e vice-líderes |
| Lembrete diário de eventos | Todos os líderes e vice-líderes |
| Aniversário de membro (hoje/amanhã) | Líder da célula + líderes de geração + supervisores |

---

## 7. Tokens inválidos

Tokens são removidos automaticamente quando o FCM retorna `UNREGISTERED` (dispositivo desinstalou o app ou o token expirou). Não é necessária manutenção manual.

---

## 8. Testar sem push (desenvolvimento)

Se `FCM_PROJECT_ID` estiver vazio, o sistema funciona normalmente sem push. Nenhum erro é lançado — as notificações in-app continuam funcionando.

---

## Troubleshooting

| Problema | Causa provável | Solução |
|----------|---------------|---------|
| Push não chega | FCM_PROJECT_ID vazio | Verificar .env |
| `google-auth-library` não encontrado | Dependência não instalada | `cd server && npm install` |
| Token sempre inválido | Projeto Firebase errado | Confirmar `FCM_PROJECT_ID` |
| JSON inválido | Quebras de linha no KEY | Converter para uma linha (passo 3) |
