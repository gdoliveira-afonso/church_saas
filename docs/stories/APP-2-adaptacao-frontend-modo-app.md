# Story APP-2 — Adaptação do Frontend para Modo App Nativo

**Epic:** EPIC-APP
**Fase:** 1 — Capacitor Shell
**Esforço:** 10 horas
**Prioridade:** P1
**Assignee:** @dev
**Status:** Blocked (aguarda APP-1)

---

## User Story

**Como** usuário do app no celular,
**Quero** que todas as telas funcionem corretamente no modo app (tocadas, gestos, layout),
**Para** ter uma experiência indistinguível de um app nativo.

---

## Contexto

O frontend foi desenvolvido para browser. No Capacitor, ele roda em uma WebView nativa. A maioria das telas funciona sem alteração, mas há ajustes necessários:

1. **API calls** usam paths relativos (`/api/...`) — no app precisam ser absolutas (`https://servidor.com/api/...`)
2. **Safe area** do iOS (notch, barra de status) — padding adicional no topo
3. **Scroll behavior** — diferentes em WebView vs browser desktop
4. **Modo de troca de servidor** — precisa ser acessível nas configurações

---

## Acceptance Criteria

### AC-1: API calls com URL dinâmica (store.apiBase)
- [ ] Criar `src/native/api.js` com função `apiFetch(path, options)`:
  ```javascript
  export function apiFetch(path, options = {}) {
    const base = store.apiBase || '';
    const url = path.startsWith('http') ? path : `${base}${path}`;
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(store.token ? { Authorization: `Bearer ${store.token}` } : {}),
        ...options.headers
      }
    });
  }
  ```
- [ ] `store.js` — todos os métodos que chamam `fetch('/api/...')` migrados para usar `apiFetch('/api/...')`
- [ ] Testar: app apontando para servidor local funciona igual ao browser

### AC-2: Safe area e layout mobile
- [ ] `index.html` — adicionar meta tag: `<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1">`
- [ ] Header sticky nas views: adicionar `padding-top: env(safe-area-inset-top)` via CSS onde necessário
- [ ] Bottom nav: adicionar `padding-bottom: env(safe-area-inset-bottom)` para não ficar atrás do home indicator do iOS
- [ ] Testar em iPhone com notch no emulador iOS

### AC-3: Opção "Trocar de servidor" nas configurações
- [ ] `src/views/settings.js` — na aba "Conta & Perfil" ou em nova aba "App":
  - Mostrar URL do servidor atual (se modo app nativo)
  - Botão "Trocar de Servidor" (apenas visível no modo nativo)
  - Ao clicar: confirmar → limpar URL salva → exibir `server-setup.js`
- [ ] Visível apenas quando `isNativeApp()` === true

### AC-4: Deep links — notificações abrem a tela correta
- [ ] `src/app.js` — suporte a abertura via URL hash ao receber notificação:
  ```javascript
  // Capacitor passa dados da notificação via pushNotificationActionPerformed
  // O campo data.url contém o hash da rota (ex: '/notifications')
  // app.js precisa navegar para essa rota ao receber o evento
  ```
- [ ] Listener de `pushNotificationActionPerformed` registrado em `app.js` (implementação prévia — o handler de push será completado na APP-4)

### AC-5: Splash screen e ícone do app
- [ ] Ícone do app criado: `resources/icon.png` (1024×1024px) — usar logo do CRM Celular ou ícone genérico para agora
- [ ] Splash screen: `resources/splash.png` (2732×2732px) — fundo na cor primary (#135bec)
- [ ] `npx capacitor-assets generate` para gerar todos os tamanhos automaticamente
- [ ] Verificar que splash screen aparece e desaparece após o boot

### AC-6: Comportamento offline básico
- [ ] Se `store.apiBase` está configurado mas o servidor não está acessível: mostrar toast "Sem conexão com o servidor" em vez de tela em branco
- [ ] Botão "Tentar novamente" na tela de erro de conexão

---

## Notas de Implementação

**Migração de fetch calls — estratégia:**

O frontend tem dezenas de `fetch('/api/...')` espalhados nas views e no store.js. A migração mais segura é:

1. Criar `apiFetch` em `src/native/api.js`
2. Exportar de `src/store.js` como método: `store.fetch(path, opts)`
3. No browser (`isNativeApp() === false`): `store.fetch` é apenas `fetch` normal
4. No app: `store.fetch` é `apiFetch` com o `apiBase` prefixado

Isso evita editar dezenas de arquivos — apenas substituir `fetch(` por `store.fetch(` nos locais que fazem chamadas à API.

**Safe area CSS:**
```css
/* Adicionar no index.html ou index.css */
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
}
.sticky-header { padding-top: calc(1rem + var(--safe-area-top)); }
.bottom-nav { padding-bottom: var(--safe-area-bottom); }
```

---

## Arquivos a Modificar

- `src/native/api.js` (criar)
- `src/store.js` — adicionar `store.fetch()` wrapper
- `src/app.js` — listener de push notification action (preview)
- `src/views/settings.js` — botão "Trocar de Servidor"
- `index.html` — meta viewport atualizado + CSS safe area
- `resources/icon.png` e `resources/splash.png` (criar)

---

## Definition of Done

- [ ] Todas as views de uma conta de teste funcionam no emulador Android
- [ ] Safe area correta no emulador iOS (quando disponível)
- [ ] "Trocar de servidor" visível e funcional nas configurações
- [ ] `npm run build && npx cap sync` sem erros
- [ ] Splash screen aparece ao abrir o app
- [ ] Commit: `feat: adapt frontend for native app mode - apiFetch, safe area, server switch [APP-2]`
