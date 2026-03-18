# Story APP-7 — Botão de Download na Tela de Login

**Epic:** EPIC-APP
**Fase:** 5 — Integração Web
**Esforço:** 2h
**Prioridade:** P2 (após APP-6 concluída)
**Assignee:** @dev
**Status:** Blocked (aguarda APP-6 — links de download precisam existir)

---

## User Story

**Como** usuário que acessa o CRM pelo browser,
**Quero** ver uma opção discreta de download do app na tela de login,
**Para** descobrir que existe um app disponível sem que isso distraia do login em si.

---

## Contexto

O objetivo é um elemento **quase imperceptível** — presente para quem procura, invisível para quem não liga. Referência de UX: o rodapé de apps como Notion e Linear que têm links "Get the app" pequenos sem chamar atenção.

**Aparece:** apenas no browser (desktop ou mobile browser)
**Não aparece:** dentro do app Capacitor (não faz sentido mostrar download dentro do próprio app)

---

## Acceptance Criteria

### AC-1: Elemento visual discreto na tela de login
- [ ] `src/views/login.js` — adicionar abaixo do formulário de login, antes do rodapé:
  - Texto pequeno em `text-xs text-slate-400` (cinza claro, quase sumindo)
  - Dois ícones/links: Android (ícone do Android) e iOS (ícone da Apple)
  - Texto sugerido: `"Disponível também como app"` seguido dos dois ícones
  - Sem bordas, sem card, sem destaque — apenas texto e ícones pequenos
- [ ] Visível apenas quando `isNativeApp()` === false
- [ ] Não ocupa espaço relevante no layout — `mt-8 text-center opacity-60`

### AC-2: Links corretos por plataforma
- [ ] Ícone Android → link do APK: `https://seudominio.com/downloads/crm-celular.apk`
- [ ] Ícone iOS → link do TestFlight: `https://testflight.apple.com/join/XXXXXXXX`
- [ ] Links abrem em nova aba (`target="_blank"`)
- [ ] URLs configuráveis via constante no topo do arquivo (não hardcoded no meio do HTML)

### AC-3: Visual de referência

```
┌────────────────────────────┐
│  [Logo]                    │
│                            │
│  Usuário: [_____________]  │
│  Senha:   [_____________]  │
│                            │
│  [      Entrar           ] │
│                            │
│                            │
│                            │
│  Disponível também como app│  ← text-xs, opacity-60, slate-400
│      🤖 Android  🍎 iOS    │  ← ícones pequenos, sem badge store
└────────────────────────────┘
```

**Importante:** sem os badges oficiais "Disponível no Google Play" / "Baixar na App Store" — esses são para distribuição via loja. Usar ícones simples (Material Symbols ou SVG inline).

### AC-4: Detecção de plataforma (exibir link relevante)
- [ ] Em browser mobile Android: destacar levemente o link Android (mantendo discrição)
- [ ] Em browser mobile iOS: destacar levemente o link iOS
- [ ] Em browser desktop: mostrar ambos igualmente

```javascript
const ua = navigator.userAgent;
const isAndroidBrowser = /android/i.test(ua) && !isNativeApp();
const isIosBrowser = /iphone|ipad/i.test(ua) && !isNativeApp();
```

---

## Notas de Implementação

**HTML sugerido para login.js:**
```javascript
const downloadLinks = !isNativeApp() ? `
  <div class="mt-10 text-center opacity-60">
    <p class="text-xs text-slate-400 mb-2">Disponível também como app</p>
    <div class="flex justify-center gap-4">
      <a href="${ANDROID_DOWNLOAD_URL}" target="_blank" rel="noopener"
         class="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
        <span class="material-symbols-outlined text-sm">android</span>
        Android
      </a>
      <a href="${IOS_DOWNLOAD_URL}" target="_blank" rel="noopener"
         class="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
        <span class="material-symbols-outlined text-sm">phone_iphone</span>
        iOS
      </a>
    </div>
  </div>
` : '';
```

**Constantes no topo do arquivo:**
```javascript
const ANDROID_DOWNLOAD_URL = 'https://seudominio.com/downloads/crm-celular.apk';
const IOS_DOWNLOAD_URL = 'https://testflight.apple.com/join/XXXXXXXX';
```

---

## Arquivos a Modificar

- `src/views/login.js`
- `src/native/index.js` — confirmar export de `isNativeApp()`

---

## Definition of Done

- [ ] Links aparecem na tela de login no browser
- [ ] Links NÃO aparecem dentro do app Capacitor
- [ ] Visual discreto — não chama mais atenção que o rodapé
- [ ] Ambos os links abrem corretamente
- [ ] Commit: `feat: add subtle app download links to login screen [APP-7]`
