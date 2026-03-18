# EPIC-APP — Aplicativo Mobile CRM Celular
## Android + iOS com Notificações Push e Conexão por URL

**Epic ID:** EPIC-APP
**Data:** 2026-03-17
**Criado por:** @pm (Morgan)
**Status:** Ready for Planning
**Prioridade:** P1 (após TD-1 e TD-2 concluídas)

**Documento de arquitetura:** `docs/architecture/mobile-app-architecture.md`

---

## Objetivo

Publicar o CRM Celular como aplicativo nativo para Android e iOS, permitindo que usuários conectem o app a qualquer instância do servidor (padrão Jellyfin), com notificações do sistema operacional (não apenas dentro do sistema).

## Critério de Sucesso do Epic

- [ ] App publicado na Google Play Store
- [ ] App publicado na Apple App Store
- [ ] Usuário consegue digitar a URL do servidor e se conectar
- [ ] Notificações aparecem na bandeja de notificações do celular
- [ ] Toque na notificação abre o app na tela correta
- [ ] App funciona em Android 7+ e iOS 14+

## Valor de Negócio

- Acesso mobile nativo para líderes e administradores de células
- Notificações de frequência, aniversários e mensagens chegam ao celular mesmo com o app fechado
- Diferencial competitivo: aplicativo próprio nas lojas (não apenas link no navegador)
- Base para futuras funcionalidades offline e câmera/GPS

---

## Stories do Epic

| Story | Título | Fase | Esforço | Dependências |
|-------|--------|------|---------|-------------|
| APP-1 | Setup Capacitor + Tela de Servidor | Fase 1 | 10h | Nenhuma |
| APP-2 | Adaptação do Frontend para Modo App | Fase 1 | 10h | APP-1 |
| APP-3 | Backend — DeviceToken + Push Service | Fase 2 | 12h | APP-1 |
| APP-4 | App — Registro e Recebimento de Push | Fase 2 | 8h | APP-2, APP-3 |
| APP-5 | Build iOS + Polimento UX Nativa | Fase 3 | 12h | APP-2, APP-4 |
| APP-6 | Distribuição Direta (APK + TestFlight) | Fase 4 | 5h | APP-5 |
| APP-7 | Botão de download sutil na tela de login | Fase 5 | 2h | APP-6 |

> **Lojas (Google Play / App Store):** planejadas para fase futura após validação com usuários reais.

**Total: ~57 horas / 5-6 semanas**

---

## Pré-requisitos Técnicos

Antes de iniciar EPIC-APP:
- [ ] Node.js 18+ instalado
- [ ] Android Studio instalado (para build Android)
- [ ] Xcode instalado em Mac (para build iOS)
- [ ] Conta Firebase criada (console.firebase.google.com)
- [ ] Conta Google Play Console ($25)
- [ ] Conta Apple Developer Program ($99/ano)
- [ ] TD-1 concluída (financeGuard corrigido — app não pode herdar vulnerabilidade)

---

*Epic criado por @pm — Mobile App Planning*
