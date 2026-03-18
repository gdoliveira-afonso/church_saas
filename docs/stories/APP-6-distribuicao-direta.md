# Story APP-6 — Distribuição Direta (APK + TestFlight)

**Epic:** EPIC-APP
**Fase:** 4 — Distribuição
**Esforço:** 5h
**Prioridade:** P1
**Assignee:** @dev
**Status:** Blocked (aguarda APP-5)

> **Decisão:** Distribuição inicial sem lojas. Android via APK direto. iOS via TestFlight.
> App Store e Google Play são planejados para uma fase futura.

---

## User Story

**Como** administrador de uma igreja,
**Quero** baixar o app CRM Celular diretamente pelo link na tela de login,
**Para** instalar sem precisar das lojas oficiais.

---

## Acceptance Criteria

### AC-1: Build de produção Android (APK)
- [ ] `android/app/build.gradle` — `versionCode: 1`, `versionName: "1.0.0"`
- [ ] Keystore de assinatura criada: `keytool -genkey -v -keystore crm-celular.jks -alias crm -keyalg RSA -keysize 2048 -validity 10000`
- [ ] Build release: `./gradlew assembleRelease` → gera `app-release.apk`
- [ ] APK assinado com a keystore
- [ ] APK hospedado em URL pública (ex: `https://seudominio.com/downloads/crm-celular.apk`)
- [ ] Arquivo `crm-celular.jks` + senhas guardados com segurança (nunca commitar)

### AC-2: Distribuição iOS via TestFlight
- [ ] Conta Apple Developer Program ativa ($99/ano) — necessária para TestFlight
- [ ] App criado no App Store Connect (sem publicar na loja — só TestFlight)
- [ ] Build iOS gerada via Xcode: Product → Archive → Distribute → TestFlight
- [ ] Link do TestFlight gerado e guardado (formato: `https://testflight.apple.com/join/XXXXXXXX`)
- [ ] Testers convidados via email ou link público do TestFlight

### AC-3: Arquivos de build documentados
- [ ] `docs/operations/APP-RELEASE.md` criado com o processo completo:
  ```
  Android:
  1. npm run build && npx cap sync
  2. cd android && ./gradlew assembleRelease
  3. Assinar: apksigner sign --ks crm-celular.jks app-release.apk
  4. Hospedar o APK no servidor

  iOS:
  1. npm run build && npx cap sync
  2. Xcode → Product → Archive → Distribute → TestFlight
  3. Aguardar processamento (~10 min) → distribuir
  ```

### AC-4: Instrução de instalação Android (sideload)
- [ ] `docs/legal/INSTALL-ANDROID.md` com instruções para o usuário final:
  - Ativar "Fontes desconhecidas" / "Instalar apps desconhecidos" no Android
  - Baixar o APK pelo link
  - Instalar normalmente
  - Nota sobre segurança (APK oficial do CRM Celular)

---

## Definition of Done

- [ ] APK funcional disponível em URL pública
- [ ] Link TestFlight iOS funcionando (pelo menos para contas de teste)
- [ ] Processo de build documentado
- [ ] Commit: `docs: add direct distribution process, APK build, TestFlight setup [APP-6]`
