# Story APP-3 — Backend: DeviceToken + Push Notification Service

**Epic:** EPIC-APP
**Fase:** 2 — Push Notifications
**Esforço:** 12 horas
**Prioridade:** P1
**Assignee:** @dev + @data-engineer
**Status:** Blocked (aguarda APP-1)

---

## User Story

**Como** sistema do CRM,
**Quero** armazenar tokens de dispositivos dos usuários e enviar notificações push via Firebase,
**Para** que notificações cheguem no celular mesmo com o app fechado.

---

## Contexto

Hoje as notificações existem apenas dentro do sistema (model `Notification` no banco, exibidas quando o usuário está logado). Para notificações push, o servidor precisa:

1. Armazenar o `FCM token` de cada dispositivo registrado
2. Quando uma `Notification` é criada, também enviar push via Firebase FCM
3. Limpar tokens inválidos (dispositivo desinstalou o app)

O Firebase FCM HTTP v1 API é o gateway — uma única integração no servidor funciona para Android e iOS.

---

## Acceptance Criteria

### AC-1: Model DeviceToken no banco
- [ ] `server/prisma/schema.prisma` — adicionar modelo:
  ```prisma
  model DeviceToken {
    id             String   @id @default(cuid())
    userId         String
    organizationId String
    token          String   @unique
    platform       String   // "android" | "ios" | "web"
    createdAt      DateTime @default(now())
    updatedAt      DateTime @updatedAt
    user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
    @@index([userId])
    @@index([organizationId])
  }
  ```
- [ ] Relação reversa adicionada em `User` e `Organization`
- [ ] Migration criada e testada: `npx prisma migrate dev --name add_device_token`
- [ ] Rollback script em `server/prisma/rollbacks/`

### AC-2: Endpoints de gerenciamento de token
- [ ] `POST /api/notifications/device-token`
  - Auth: `authenticateToken` (requer login)
  - Body: `{ token: string, platform: "android"|"ios" }`
  - Ação: upsert — se token já existe, atualizar; se não, criar
  - Response: `{ success: true }`
- [ ] `DELETE /api/notifications/device-token`
  - Auth: `authenticateToken`
  - Body: `{ token: string }`
  - Ação: deletar o token (logout — usuário desativa notificações)
  - Response: `{ success: true }`

### AC-3: Serviço de Push Notification
- [ ] `server/lib/pushNotification.js` criado:
  ```javascript
  // sendPushToUser(userId, { title, body, data })
  // - Busca todos os DeviceTokens do usuário
  // - Chama Firebase FCM HTTP v1 API para cada token
  // - Remove tokens inválidos (erro 404 do FCM = token expirado)
  // - Silencia erros (não bloquear fluxo principal)
  ```
- [ ] Usa autenticação via Google Service Account (não a chave legada FCM)
- [ ] `server/.env.example` atualizado com:
  ```
  FCM_PROJECT_ID=
  FCM_SERVICE_ACCOUNT_KEY=  # JSON da service account em uma linha
  ```

### AC-4: Integração com criação de Notification
- [ ] `server/routes/notifications.js` (ou onde Notification é criada) — após `prisma.notification.create(...)`, chamar `sendPushToUser(userId, { title, body, data })`
- [ ] `data` deve incluir `{ type: 'NOTIFICATION', url: '/notifications' }` para o app saber para onde navegar
- [ ] Push é enviado de forma assíncrona (não bloqueia a resposta HTTP)
- [ ] Se FCM não está configurado (`FCM_PROJECT_ID` vazio), push é silenciosamente ignorado

### AC-5: Push para notificações de aniversário e eventos
- [ ] `server/services/birthdayNotification.js` — após criar Notification, também chama `sendPushToUser`
- [ ] Verificar demais pontos do sistema onde `prisma.notification.create` é chamado e adicionar push

### AC-6: Configuração Firebase
- [ ] `docs/operations/FIREBASE-SETUP.md` criado com instruções passo a passo:
  1. Criar projeto no Firebase Console
  2. Adicionar app Android (package: `com.crmcelular.app`)
  3. Adicionar app iOS (bundle ID: `com.crmcelular.app`)
  4. Baixar `google-services.json` → colocar em `android/app/`
  5. Baixar `GoogleService-Info.plist` → colocar em `ios/App/App/`
  6. Gerar Service Account Key → configurar `FCM_PROJECT_ID` e `FCM_SERVICE_ACCOUNT_KEY` no server/.env
  7. Configurar APNs Auth Key no Firebase Console (para iOS)

---

## Notas de Implementação

**Firebase FCM HTTP v1 (autenticação via Service Account):**
```javascript
// server/lib/pushNotification.js
const { GoogleAuth } = require('google-auth-library');

const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.FCM_SERVICE_ACCOUNT_KEY || '{}'),
  scopes: ['https://www.googleapis.com/auth/firebase.messaging']
});

async function sendPush(token, { title, body, data = {} }) {
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const projectId = process.env.FCM_PROJECT_ID;

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          ),
          android: { priority: 'high' },
          apns: {
            payload: { aps: { sound: 'default', badge: 1 } }
          }
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json();
    // Token inválido → remover do banco
    if (err.error?.status === 'NOT_FOUND') {
      await prisma.deviceToken.delete({ where: { token } }).catch(() => {});
    }
    throw new Error(err.error?.message || 'FCM error');
  }
}

async function sendPushToUser(userId, notification) {
  if (!process.env.FCM_PROJECT_ID) return; // FCM não configurado
  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  await Promise.allSettled(tokens.map(dt => sendPush(dt.token, notification)));
}

module.exports = { sendPushToUser };
```

**Dependência a adicionar:**
```bash
# em server/
npm install google-auth-library
```

---

## Arquivos a Criar/Modificar

**Criar:**
- `server/lib/pushNotification.js`
- `server/prisma/rollbacks/rollback_20260317_device_token.sql`
- `docs/operations/FIREBASE-SETUP.md`

**Modificar:**
- `server/prisma/schema.prisma`
- `server/routes/notifications.js`
- `server/services/birthdayNotification.js` (se existir)
- `server/.env.example`
- `server/package.json` — adicionar `google-auth-library`

---

## Definition of Done

- [ ] `POST /api/notifications/device-token` salva token no banco
- [ ] `sendPushToUser` envia mensagem real para um dispositivo de teste
- [ ] Push chega no dispositivo de teste (Android) com o app fechado
- [ ] Tokens inválidos são removidos automaticamente
- [ ] Se `FCM_PROJECT_ID` não configurado, sistema funciona normalmente sem push
- [ ] `docs/operations/FIREBASE-SETUP.md` completo e testado
- [ ] Commit: `feat: add DeviceToken model, FCM push notification service [APP-3]`
