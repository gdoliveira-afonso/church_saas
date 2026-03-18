# Story APP-4 — App: Registro e Recebimento de Push Notifications

**Epic:** EPIC-APP
**Fase:** 2 — Push Notifications
**Esforço:** 8 horas
**Prioridade:** P1
**Assignee:** @dev
**Status:** Blocked (aguarda APP-2 e APP-3)

---

## User Story

**Como** usuário logado no app,
**Quero** receber notificações do CRM na bandeja do meu celular,
**Para** ser alertado sobre frequência, aniversários e mensagens mesmo com o app fechado.

---

## Contexto

Com o backend (APP-3) já enviando pushes via FCM, esta story implementa o lado do app:
1. Solicitar permissão de notificação ao usuário
2. Obter o FCM token via Capacitor
3. Registrar o token no servidor após o login
4. Receber e exibir notificações quando o app está aberto
5. Ao tocar na notificação: navegar para a tela correta

---

## Acceptance Criteria

### AC-1: Plugin instalado e configurado
- [ ] `@capacitor/push-notifications` instalado: `npm install @capacitor/push-notifications`
- [ ] `npx cap sync` executado após instalação
- [ ] **Android:** `android/app/google-services.json` colocado (do Firebase Console)
- [ ] **iOS:** `ios/App/App/GoogleService-Info.plist` colocado (do Firebase Console)
- [ ] `AndroidManifest.xml` — permissão `POST_NOTIFICATIONS` adicionada (Android 13+)

### AC-2: Solicitação de permissão após login
- [ ] `src/native/push.js` criado com funções:
  - `initPushNotifications()` — solicita permissão e registra listeners
  - `registerDeviceToken(serverUrl)` — registra token no servidor
  - `unregisterDeviceToken()` — chama DELETE no logout
- [ ] `src/app.js` ou `src/store.js` — chamar `initPushNotifications()` após login bem-sucedido
- [ ] Solicitar permissão apenas uma vez — não repetir se já concedida ou negada

### AC-3: Registro do token no servidor
- [ ] Após receber o FCM token via `PushNotifications.addListener('registration', ...)`:
  ```javascript
  PushNotifications.addListener('registration', async ({ value: token }) => {
    await apiFetch('/api/notifications/device-token', {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform: Capacitor.getPlatform() // 'android' ou 'ios'
      })
    });
  });
  ```
- [ ] Se registro falhar: logar erro silenciosamente (não bloquear fluxo de login)

### AC-4: Notificação recebida com app aberto (foreground)
- [ ] `PushNotifications.addListener('pushNotificationReceived', ...)` registrado
- [ ] Quando chegar com app aberto: exibir `toast(notification.title + ': ' + notification.body, 'info')`
- [ ] Badge/counter de notificações atualizado se o app estiver na tela de notificações

### AC-5: Toque na notificação — deep link
- [ ] `PushNotifications.addListener('pushNotificationActionPerformed', ...)` registrado
- [ ] Ler `data.url` da notificação (ex: `'/notifications'`, `'/finance'`)
- [ ] Chamar `navigate(data.url)` para ir para a tela correta
- [ ] Se `data.url` não está presente: navegar para `/dashboard`

### AC-6: Logout limpa o token
- [ ] `src/store.js` — função de logout chama `DELETE /api/notifications/device-token` com o token atual
- [ ] Token removido do `Preferences` após logout
- [ ] Se o servidor não está acessível durante logout: continuar logout normalmente (não bloquear)

### AC-7: Testar end-to-end
- [ ] Dispositivo Android de teste recebe notificação com app fechado
- [ ] Tocar na notificação abre o app na tela correta
- [ ] Notificação com app aberto exibe toast
- [ ] Logout remove token — novas notificações não chegam ao dispositivo deslogado

---

## Notas de Implementação

**src/native/push.js:**
```javascript
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { apiFetch } from './api.js';
import { navigate } from '../router.js';
import { toast } from '../components/ui.js';

let currentToken = null;

export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async ({ value: token }) => {
    currentToken = token;
    try {
      await apiFetch('/api/notifications/device-token', {
        method: 'POST',
        body: JSON.stringify({ token, platform: Capacitor.getPlatform() })
      });
    } catch (e) {
      console.error('[Push] Falha ao registrar token:', e);
    }
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    toast(`${notification.title}: ${notification.body}`, 'info');
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification.data?.url || '/dashboard';
    navigate(url);
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('[Push] Erro de registro:', err);
  });
}

export async function unregisterDeviceToken() {
  if (!currentToken) return;
  try {
    await apiFetch('/api/notifications/device-token', {
      method: 'DELETE',
      body: JSON.stringify({ token: currentToken })
    });
  } catch (e) {
    console.error('[Push] Falha ao remover token:', e);
  }
  currentToken = null;
}
```

**Permissão Android 13+ — AndroidManifest.xml:**
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

---

## Arquivos a Criar/Modificar

**Criar:**
- `src/native/push.js`

**Modificar:**
- `package.json` (raiz) — adicionar `@capacitor/push-notifications`
- `src/app.js` — chamar `initPushNotifications()` após login
- `src/store.js` — chamar `unregisterDeviceToken()` no logout
- `android/app/google-services.json` — colocar arquivo do Firebase
- `android/app/src/main/AndroidManifest.xml` — permissão POST_NOTIFICATIONS

---

## Definition of Done

- [ ] Push chega no Android físico/emulador com app fechado
- [ ] Tocar na notificação abre o app na rota `/notifications`
- [ ] App aberto: notificação exibe toast em vez de bandeja
- [ ] Logout remove o token do servidor
- [ ] `npx cap sync && npx cap build android` sem erros
- [ ] Commit: `feat: implement push notification registration and handling in app [APP-4]`
