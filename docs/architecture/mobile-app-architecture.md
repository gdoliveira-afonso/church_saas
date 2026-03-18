# Arquitetura — Aplicativo Mobile CRM Celular
## Android + iOS com Conexão por URL (Jellyfin Pattern)

**Data:** 2026-03-17
**Versão:** 1.0
**Autor:** @architect (Aria)
**Status:** Aprovado para planejamento

---

## 1. Decisão Arquitetural — Framework do App

### Opções Avaliadas

| Opção | Reuso do Frontend | Push Nativo | App Store | Esforço | Recomendação |
|-------|------------------|-------------|-----------|---------|-------------|
| **Capacitor** | ✅ 100% | ✅ | ✅ | Baixo | ✅ **ESCOLHIDA** |
| React Native | ❌ Reescrita total | ✅ | ✅ | Muito alto | ❌ |
| Flutter | ❌ Reescrita total | ✅ | ✅ | Muito alto | ❌ |
| PWA | ✅ 100% | ⚠️ iOS limitado | ❌ Sem store | Mínimo | ❌ |

### Por que Capacitor?

**Capacitor** (Ionic) é um runtime nativo que empacota o frontend web existente em um app nativo para Android e iOS. É exatamente o que projetos como Bitwarden, Nextcloud Talk e AppFlowy Mobile usam.

**Vantagens para este projeto:**
- O frontend já é uma SPA completa com roteador e estado próprios — funciona dentro do Capacitor sem reescrita
- `@capacitor/push-notifications` entrega notificações nativas do sistema operacional
- `@capacitor/preferences` para armazenamento seguro da URL do servidor
- Publicável na Google Play Store e Apple App Store
- Build: um único comando gera APK/AAB (Android) e IPA (iOS)

---

## 2. Arquitetura Geral

```
┌─────────────────────────────────────────────────────────┐
│                   DISPOSITIVO MÓVEL                     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              App Nativo (Capacitor Shell)         │   │
│  │                                                  │   │
│  │  ┌────────────────────────────────────────────┐  │   │
│  │  │  Tela de Conexão (nativa)                  │  │   │
│  │  │  "Digite a URL do seu servidor CRM"        │  │   │
│  │  │  [ https://central.minhaigreja.com  ] [→]  │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  │                        ↓ (salva URL)              │   │
│  │  ┌────────────────────────────────────────────┐  │   │
│  │  │  WebView (frontend SPA existente)          │  │   │
│  │  │  Carrega de: bundle local                  │  │   │
│  │  │  API calls → URL do servidor configurado   │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  │                                                  │   │
│  │  Plugins Nativos:                                │   │
│  │  • @capacitor/push-notifications                 │   │
│  │  • @capacitor/preferences (URL storage)          │   │
│  │  • @capacitor/status-bar                         │   │
│  │  • @capacitor/splash-screen                      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
           │ HTTPS                    │ FCM/APNs
           ↓                          ↓
┌──────────────────┐       ┌──────────────────────┐
│   CRM Server     │──────►│  Firebase FCM         │
│  (qualquer URL)  │       │  (Google + Apple      │
│                  │       │   Push Notifications) │
│  POST /api/      │       └──────────────────────┘
│  notifications/  │
│  device-token    │
└──────────────────┘
```

---

## 3. Padrão Jellyfin — Conexão por URL

### Fluxo de Primeira Abertura

```
App instalado → Tela de Boas-vindas
                       ↓
             Campo: "URL do Servidor"
             Exemplo: https://crm.minhaigreja.com
                       ↓
             [Testar Conexão] → GET /api/public/info
                                 retorna: { appName, version, orgName }
                       ↓
             Sucesso → Salvar URL no Preferences
             Falha   → Mostrar erro "Servidor não encontrado"
                       ↓
             Carrega o frontend SPA normalmente
             (com a URL configurada injetada)
```

### Endpoint de Descoberta (novo — backend)

```
GET /api/public/info
Response: {
  appName: "CRM Celular",
  version: "3.0",
  organizationName: "Igreja Batista Central",
  logoUrl: "https://...",
  pushEnabled: true
}
```

Este endpoint é **público** (sem autenticação), usado pelo app para validar que a URL digitada é de fato um servidor CRM Celular.

### Armazenamento da URL

```javascript
// src/native/server-config.js (novo arquivo)
import { Preferences } from '@capacitor/preferences';

export async function saveServerUrl(url) {
  await Preferences.set({ key: 'serverUrl', value: url });
}

export async function getServerUrl() {
  const { value } = await Preferences.get({ key: 'serverUrl' });
  return value; // null se nunca configurado
}
```

### Injeção da URL no Frontend

O frontend atual usa `fetch('/api/...')` com caminho relativo. No app, as chamadas precisam ir para a URL do servidor configurado.

**Solução:** Interceptar os fetch calls via um service worker ou via variável global injetada pelo Capacitor antes de carregar a SPA:

```javascript
// capacitor.config.ts — injetar serverUrl antes do boot
// A SPA lê window.CAPACITOR_SERVER_URL e usa como base de todas as API calls
```

Alternativamente (mais limpo): modificar `src/store.js` para que `store.apiBase` seja configurável, e todas as chamadas usem `${store.apiBase}/api/...`.

---

## 4. Push Notifications — Arquitetura Completa

### Stack de Notificações

```
[CRM Server] ──► [Firebase FCM] ──► [Android: FCM]
                               └──► [iOS: APNs via FCM]
```

Firebase FCM é o gateway unificado: com uma única integração no servidor, as notificações chegam tanto no Android (diretamente) quanto no iOS (FCM faz o bridge para APNs).

### Fluxo de Registro de Dispositivo

```
1. App abre → usuário loga com JWT
2. App solicita permissão de notificação ao SO
3. SO concede → app recebe FCM Token (string única do dispositivo)
4. App envia token ao servidor:
   POST /api/notifications/device-token
   { token: "fcm-token-...", platform: "android" | "ios" }
5. Servidor salva: DeviceToken { userId, orgId, token, platform }
```

### Fluxo de Envio de Notificação

```
[Sistema cria Notification no banco]
          ↓
[activityLogger ou notificationService]
          ↓
[Buscar DeviceTokens do usuário destinatário]
          ↓
[POST https://fcm.googleapis.com/v1/projects/{id}/messages:send]
  {
    token: "fcm-token-do-dispositivo",
    notification: { title: "Nova mensagem", body: "Fulano te marcou" },
    data: { type: "NOTIFICATION", id: "notif-123", url: "/notifications" }
  }
          ↓
[FCM entrega ao dispositivo]
          ↓
[App recebe → mostra na bandeja do sistema operacional]
[Toque na notificação → abre app na URL correta]
```

### Novo Modelo de Banco de Dados

```prisma
model DeviceToken {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  token          String   @unique
  platform       String   // "android" | "ios" | "web"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([organizationId])
}
```

### Configuração Firebase no Servidor

```env
# server/.env (adicionar)
FCM_PROJECT_ID=crm-celular-firebase
FCM_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```

```javascript
// server/lib/pushNotification.js (novo)
const { GoogleAuth } = require('google-auth-library');

async function sendPushNotification(deviceToken, { title, body, data }) {
  // Obtém access token via Service Account
  // POST para FCM HTTP v1 API
  // Silencia erros 404 (token inválido → remove do banco)
}
```

---

## 5. Estrutura de Arquivos do Projeto

### Organização do Repositório com Capacitor

```
/ (raiz — frontend atual)
├── src/
│   ├── views/          (existentes — sem alteração)
│   ├── components/
│   │   ├── ui.js       (existente)
│   │   └── native.js   (NOVO — bridge Capacitor)
│   ├── store.js        (modificar — apiBase configurável)
│   └── app.js          (modificar — detectar modo app)
├── android/            (GERADO pelo Capacitor)
├── ios/                (GERADO pelo Capacitor)
├── capacitor.config.ts (NOVO)
├── package.json        (adicionar deps Capacitor)
└── server/             (backend — modificações menores)
    ├── prisma/
    │   └── schema.prisma   (adicionar DeviceToken)
    ├── routes/
    │   └── notifications.js  (adicionar device-token endpoint)
    └── lib/
        └── pushNotification.js  (NOVO)
```

---

## 6. Modificações Necessárias no Frontend Existente

### store.js — apiBase dinâmico

```javascript
// Detectar se está rodando no Capacitor (app nativo) ou browser
const isNativeApp = window.Capacitor?.isNativePlatform?.() ?? false;

class Store {
  constructor() {
    this.apiBase = isNativeApp
      ? '' // será substituído pelo serverUrl salvo
      : ''; // browser: paths relativos funcionam normalmente
    // ...
  }
}
```

### app.js — Boot no modo app

```javascript
// Adicionar antes de initRouter()
if (isNativeApp) {
  const serverUrl = await getServerUrl();
  if (!serverUrl) {
    // Mostrar tela de configuração de servidor
    showServerSetupScreen();
    return;
  }
  store.apiBase = serverUrl;
  // Registrar para push notifications após login
}
```

### Compatibilidade Geral

O frontend usa `fetch('/api/...')` com paths relativos. No modo nativo, os paths precisam ser absolutos (`https://servidor.com/api/...`). Estratégia: criar uma função `apiFetch(path, opts)` que prepend `store.apiBase` e substituir os `fetch('/api/...)` existentes.

---

## 7. Plataformas e Publicação

### Android

| Item | Detalhe |
|------|---------|
| Build | `npx cap build android` → APK/AAB |
| Push | FCM (Firebase Cloud Messaging) nativo |
| Store | Google Play Console — conta $25 única |
| Min SDK | Android 7.0 (API 24) — cobre 95%+ dos dispositivos |
| Arquivo config | `android/app/google-services.json` (do Firebase) |

### iOS

| Item | Detalhe |
|------|---------|
| Build | `npx cap build ios` → XCode → Archive |
| Push | APNs via FCM bridge |
| Store | Apple Developer Program — $99/ano |
| Min OS | iOS 14+ — cobre 95%+ dos iPhones |
| Arquivo config | `ios/App/App/GoogleService-Info.plist` (do Firebase) |
| Requisito adicional | APNs Auth Key (p8) no Firebase Console |

### Firebase Setup

1. Criar projeto em console.firebase.google.com
2. Adicionar app Android (package: `com.crmcelular.app`)
3. Adicionar app iOS (bundle: `com.crmcelular.app`)
4. Baixar `google-services.json` e `GoogleService-Info.plist`
5. Gerar Service Account Key para o backend (FCM HTTP v1)
6. Configurar APNs Auth Key para iOS

---

## 8. Fases de Implementação

### Fase 1 — Capacitor Shell (2 semanas, ~20h)
Setup do Capacitor, tela de URL do servidor, app abre o frontend existente no WebView, build funcional no Android.

### Fase 2 — Push Notifications (1 semana, ~15h)
Backend: DeviceToken model + endpoint + pushNotification.js + integração com criação de Notification.
App: registro de device token após login, recebimento de notificação, toque abre tela correta.

### Fase 3 — Polimento iOS + UX Nativa (1 semana, ~12h)
Build iOS, ajustes de safe area, ícones e splash screen, dark mode nativo, status bar adaptada.

### Fase 4 — App Stores (1 semana, ~8h)
Preparação de metadados, screenshots, políticas de privacidade, submissão ao Google Play e Apple App Store.

**Total estimado: ~55 horas / 5 semanas**

---

## 9. Requisitos Não-Funcionais

| NFR | Meta |
|-----|------|
| Tamanho do app | < 20MB Android, < 30MB iOS |
| Tempo de boot até login | < 3 segundos |
| Compatibilidade Android | API 24+ (Android 7.0) |
| Compatibilidade iOS | iOS 14+ |
| Notificações offline | FCM enfileira quando dispositivo está offline |
| Segurança da URL salva | `@capacitor/preferences` usa Keychain (iOS) e EncryptedSharedPreferences (Android) |

---

## 10. Decisões Técnicas Registradas

| Decisão | Escolha | Alternativa Descartada | Motivo |
|---------|---------|----------------------|--------|
| Framework app | Capacitor | React Native | Reuso de 100% do frontend existente |
| Push gateway | Firebase FCM | Direct APNs/FCM | FCM unifica Android e iOS em uma API |
| URL storage | @capacitor/preferences | localStorage | Persistência nativa e segura |
| API calls no app | Prefixo store.apiBase | Hardcoded URL | Multi-instância (Jellyfin pattern) |
| Notif. iOS | FCM com APNs bridge | APNs direto | Menor complexidade no servidor |

---

*Documento criado por @architect — Mobile App Planning*
*Próximo: @pm cria Epic EPIC-APP com stories detalhadas*
