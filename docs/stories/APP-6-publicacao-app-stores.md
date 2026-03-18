# Story APP-6 — Publicação Google Play + Apple App Store

**Epic:** EPIC-APP
**Fase:** 4 — Publicação
**Esforço:** 8 horas
**Prioridade:** P1
**Assignee:** @dev
**Status:** Blocked (aguarda APP-5)

---

## User Story

**Como** usuário final,
**Quero** encontrar e instalar o CRM Celular na loja oficial do meu celular,
**Para** instalar o app com segurança e receber atualizações automáticas.

---

## Acceptance Criteria

### AC-1: Build de produção Android (Google Play)
- [ ] `android/app/build.gradle` — `versionCode` e `versionName` configurados (`1` e `"1.0.0"`)
- [ ] Keystore de produção criado e armazenado com segurança: `keytool -genkey -v -keystore crm-celular-release.jks`
- [ ] Build release: `./gradlew bundleRelease` → gera `app-release.aab`
- [ ] AAB assinado com a keystore de produção
- [ ] `crm-celular-release.jks` + senhas guardados em local seguro (nunca commitar)

### AC-2: Publicação no Google Play Console
- [ ] Conta Google Play Console criada ($25 — taxa única)
- [ ] Novo app criado: "CRM Celular", categoria "Negócios", classificação "Todos"
- [ ] Preencher ficha do app:
  - Título: "CRM Celular — Gestão de Igrejas"
  - Descrição curta (80 chars): "Gerencie membros, células e frequência da sua igreja"
  - Descrição longa: funcionalidades principais
  - Screenshots: mínimo 2 (telefone), recomendado 4-8
  - Ícone: 512×512px
  - Feature graphic: 1024×500px
- [ ] Política de Privacidade URL configurada (obrigatório)
- [ ] AAB enviado via Internal Testing primeiro → testar 1 semana → promover para Produção

### AC-3: Build de produção iOS (App Store)
- [ ] `ios/App/App.xcodeproj` — Version: `1.0.0`, Build: `1`
- [ ] Scheme de Release configurado no Xcode
- [ ] Archive: Product → Archive → Distribute App → App Store Connect
- [ ] IPA enviado via Xcode Organizer ou `xcrun altool`

### AC-4: Publicação na Apple App Store
- [ ] Conta Apple Developer Program ativa ($99/ano)
- [ ] App criado no App Store Connect: "CRM Celular"
- [ ] Preencher metadados:
  - Nome: "CRM Celular"
  - Subtítulo: "Gestão de Igrejas"
  - Categoria: Produtividade ou Negócios
  - Screenshots para iPhone 6.7" (obrigatório) e outros tamanhos
  - Descrição e palavras-chave
- [ ] Política de Privacidade URL (obrigatório — Apple exige)
- [ ] Responder ao questionário de privacidade (quais dados o app coleta)
- [ ] Submeter para revisão → aguardar aprovação (1-3 dias úteis)

### AC-5: Política de Privacidade
- [ ] `docs/legal/PRIVACY-POLICY.md` criado cobrindo:
  - Quais dados são coletados (nome, email, dados da organização)
  - Como são usados (apenas funcionamento do sistema)
  - Armazenamento (no servidor configurado pelo usuário)
  - Notificações push (com consentimento explícito)
  - Contato para solicitações de privacidade
- [ ] Página web simples com a política publicada (URL acessível publicamente)

### AC-6: Atualização do app (processo definido)
- [ ] `docs/operations/APP-RELEASE.md` documenta o processo de release:
  1. `npm run build && npx cap sync`
  2. Incrementar versionCode/versionName no Android
  3. Incrementar Version/Build no iOS
  4. Build Android: `./gradlew bundleRelease` + assinar
  5. Build iOS: Archive via Xcode
  6. Enviar para as lojas
  7. Aguardar aprovação (iOS) ou rollout (Android)

---

## Checklist de Pré-publicação

- [ ] App testado em pelo menos 3 dispositivos Android diferentes
- [ ] App testado em pelo menos 2 iPhones diferentes (um sem notch, um com)
- [ ] Push notifications testadas em ambas as plataformas
- [ ] Fluxo completo testado: instalar → configurar URL → login → receber notificação
- [ ] Política de Privacidade publicada em URL acessível
- [ ] Não há dados hardcoded de servidor de desenvolvimento

---

## Arquivos a Criar

- `docs/legal/PRIVACY-POLICY.md`
- `docs/operations/APP-RELEASE.md`
- `crm-celular-release.jks` (fora do repo — armazenar com segurança)

---

## Definition of Done

- [ ] App disponível na Google Play (pelo menos Internal Testing)
- [ ] App submetido para revisão na Apple App Store
- [ ] Instalação via loja funciona end-to-end (URL → login → push)
- [ ] Política de privacidade publicada
- [ ] Processo de release documentado
- [ ] Commit: `docs: add privacy policy, app release process documentation [APP-6]`
