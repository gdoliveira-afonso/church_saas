# EPIC-TD — Resolução de Débitos Técnicos
## CRM Celular — SaaS Multi-tenant

**Epic ID:** EPIC-TD
**Data:** 2026-03-17
**Criado por:** @pm (Morgan) — Brownfield Discovery Fase 10
**Status:** Ready for Development
**Prioridade:** P0-P2 (5 sprints)

**Documento base:** `docs/prd/technical-debt-assessment.md`

---

## Objetivo do Epic

Resolver os 54 débitos técnicos identificados no Brownfield Discovery do CRM Celular, priorizando segurança, performance e completude do módulo financeiro antes de avançar em novas features.

## Critério de Sucesso do Epic

- [ ] 3 gates de produção eliminados (SEC-01, IDX-01, OPS-01)
- [ ] Módulo financeiro completo e disponível (9 views)
- [ ] Testes de integração cobrindo rotas críticas
- [ ] Tailwind instalado localmente (fim do CDN de 3MB)
- [ ] Sistema de componentes extraído das 29 views

---

## Stories do Epic

| Story | Título | Sprint | Esforço | Prioridade |
|-------|--------|--------|---------|-----------|
| TD-1 | Quick Fixes de Segurança e Usabilidade | Sprint 0 | 3h | P0 |
| TD-2 | Performance — Tailwind Local + DB Indexes | Sprint 1 | 10h | P0/P1 |
| TD-3 | Módulo Financeiro — Fase 3 (9 views) | Sprint 2 | 38h | P0 |
| TD-4 | Acessibilidade Crítica (A11Y) | Sprint 2 | 7.5h | P1 |
| TD-5 | Integridade do Banco + Testes de Integração | Sprint 3 | 28h | P1 |
| TD-6 | Operações — Rollback + Backup + Observabilidade | Sprint 3 | 10h | P1 |
| TD-7 | Sistema de Componentes Frontend | Sprint 4 | 40h | P2 |

---

*Epic criado por @pm — Brownfield Discovery Workflow Fase 10*
