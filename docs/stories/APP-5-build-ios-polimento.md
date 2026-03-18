# Story APP-5 — Build iOS + Polimento UX Nativa

**Epic:** EPIC-APP
**Fase:** 3 — iOS + Polimento
**Esforço:** 12 horas
**Prioridade:** P1
**Assignee:** @dev
**Status:** Blocked (aguarda APP-2 e APP-4)
**Requisito de hardware:** Mac com Xcode instalado

---

## User Story

**Como** usuário de iPhone,
**Quero** que o app funcione perfeitamente no iOS com notificações e visual adequado,
**Para** ter a mesma experiência que no Android.

---

## Acceptance Criteria

### AC-1: Build iOS funcional
- [ ] `npx cap add ios` executado sem erros
- [ ] `ios/App/App/GoogleService-Info.plist` colocado (do Firebase)
- [ ] Bundle ID configurado: `com.crmcelular.app`
- [ ] `npx cap open ios` abre Xcode sem erros
- [ ] App roda no iOS Simulator (iPhone 14+)
- [ ] App roda em dispositivo físico iOS via Xcode

### AC-2: APNs para push no iOS
- [ ] No Firebase Console: APNs Auth Key (p8) configurada para o projeto
- [ ] `@capacitor/push-notifications` funciona no iOS Simulator (limitado) e dispositivo físico
- [ ] Push notification recebida em iPhone físico com app fechado
- [ ] Toque na notificação abre o app corretamente

### AC-3: Safe area e notch do iPhone
- [ ] Header e bottom nav respeitam `env(safe-area-inset-*)` em todos os modelos de iPhone
- [ ] Sem conteúdo cortado pelo notch ou Dynamic Island
- [ ] Testar em: iPhone SE (sem notch), iPhone 14 (notch), iPhone 15 Pro (Dynamic Island)

### AC-4: Status bar adaptada
- [ ] `@capacitor/status-bar` configurado: fundo da cor primary (`#135bec`) com texto claro
- [ ] Dark mode: status bar muda para fundo escuro automaticamente
- [ ] Scroll de conteúdo não passa atrás da status bar

### AC-5: Ícone e splash no iOS
- [ ] `resources/icon.png` (1024×1024) gera todos os tamanhos iOS via `capacitor-assets generate`
- [ ] Splash screen exibe e desaparece corretamente no iOS
- [ ] Ícone aparece corretamente na home screen do iPhone

### AC-6: Ajustes de UX específicos do iOS
- [ ] Scroll com inércia (momentum scroll) funcionando nas listagens longas
- [ ] Teclado não cobre campos de formulário — `scrollIntoView()` nas views com formulários
- [ ] Back gesture (swipe da borda esquerda) — desabilitar se conflita com o roteador hash do app, ou mapear para "voltar" no histórico
- [ ] `user-scalable=no` removido (já feito em TD-1) — zoom de acessibilidade iOS deve funcionar

### AC-7: Testar as 29 views em iOS
- [ ] Testar cada módulo principal: Login, Dashboard, Pessoas, Células, Frequência, EBD, Financeiro, Configurações
- [ ] Sem regressões visuais em comparação com o Android
- [ ] Dark mode funcionando em todas as views testadas

---

## Notas de Implementação

**Xcode signing:**
- Requer conta Apple Developer ($99/ano)
- Usar "Automatic Signing" no Xcode com o Team selecionado
- Para testes locais: usar Apple ID pessoal com "Personal Team" (limitado a 7 dias)

**APNs Auth Key no Firebase:**
1. Apple Developer Console → Certificates, IDs & Profiles → Keys → + New Key
2. Marcar "Apple Push Notifications service (APNs)"
3. Baixar o arquivo `.p8`
4. Firebase Console → Configurações do Projeto → Cloud Messaging → APNs Auth Key → Upload

**Scroll com inércia iOS (CSS):**
```css
/* Adicionar em containers scrolláveis */
.scrollable-content {
  -webkit-overflow-scrolling: touch;
  overflow-y: scroll;
}
```

**Teclado não cobre campos:**
```javascript
// Adicionar em views com formulários longos
input.addEventListener('focus', () => {
  setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
});
```

---

## Arquivos a Criar/Modificar

- `ios/` — gerado por `npx cap add ios`
- `ios/App/App/GoogleService-Info.plist`
- `ios/App/App/AppDelegate.swift` — ajustes de push (gerados pelo Capacitor)
- CSS global — ajustes de scroll iOS
- Views com formulários — scroll into view no focus

---

## Definition of Done

- [ ] App roda em iPhone físico ou Simulator
- [ ] Push notification recebida em iPhone físico
- [ ] Safe area correta em iPhone com notch
- [ ] Módulos principais testados no iOS (Login, Dashboard, Células, EBD)
- [ ] Sem erros de build no Xcode
- [ ] Commit: `feat: add iOS build, APNs push, safe area adjustments [APP-5]`
