# Relatório Executivo — Débitos Técnicos
## CRM Celular — SaaS para Igrejas

**Data:** 2026-03-17
**Preparado por:** @analyst (Alex) — Brownfield Discovery Fase 9
**Destinatário:** Gestão / Product Owner / Stakeholders
**Baseado em:** `docs/prd/technical-debt-assessment.md` (revisado por 4 especialistas)

---

## O que é Débito Técnico?

Débito técnico são decisões de desenvolvimento tomadas no passado que funcionam hoje, mas que aumentam o custo de cada nova funcionalidade e criam riscos que crescem com o tempo. São como um empréstimo: enquanto não pago, acumula juros.

---

## Situação Atual em 3 Pontos

**1. O sistema funciona e está em produção.** As funcionalidades implementadas (membros, células, EBD, integração financeira em desenvolvimento) estão operacionais. O CRM Celular atende seu propósito hoje.

**2. Existem 54 pontos de melhoria identificados.** Cinco especialistas mapearam o sistema inteiro. Nenhum desses pontos quebra o sistema agora — mas alguns podem causar problemas sérios se ignorados conforme o sistema cresce.

**3. Há 3 correções urgentes que custam menos de 3 horas no total** e eliminam riscos que poderiam causar incidentes de segurança ou perda de dados.

---

## Os 3 Riscos que Precisam de Ação Imediata

### Risco 1 — Acesso Financeiro Indevido
**O que pode acontecer:** Se o banco de dados ficar lento por alguns segundos, o sistema libera automaticamente o acesso ao módulo financeiro para qualquer usuário logado — independente das permissões configuradas.

**Por que é urgente:** O módulo financeiro está sendo desenvolvido agora. Cada novo deploy aumenta a probabilidade de encontrar esse cenário.

**Custo para corrigir:** 1 hora de desenvolvimento.

---

### Risco 2 — Lentidão Progressiva Conforme a Igreja Cresce
**O que pode acontecer:** Toda busca de membros, toda tela de frequência e todo relatório faz uma varredura completa no banco de dados. Com 100 membros é imperceptível. Com 1.000 membros a tela demora para abrir. Com 5.000 membros o sistema fica inutilizável.

**Por que é urgente:** O problema piora com o crescimento — e não dá aviso antes de acontecer.

**Custo para corrigir:** 1 hora. Adicionar índices ao banco de dados resolve permanentemente.

---

### Risco 3 — Sem Capacidade de Recuperação em Caso de Falha
**O que pode acontecer:** Se uma atualização de banco de dados falhar durante um deploy, não há procedimento documentado para reverter. O sistema pode ficar fora do ar sem caminho de recuperação claro.

**Por que é urgente:** A cada nova funcionalidade desenvolvida, uma atualização de banco é necessária.

**Custo para corrigir:** 4 horas para criar o processo e documentar os scripts de reversão.

---

## Visão Geral dos 54 Pontos Identificados

```
           POR URGÊNCIA                    POR ÁREA

    ┌─────────────────────┐         ┌─────────────────────┐
    │  🔴 Crítico    5    │         │  Banco de dados  16  │
    │  🟠 Alto      18    │         │  Interface      19   │
    │  🟡 Médio     23    │         │  Segurança       9   │
    │  🟢 Baixo      8    │         │  Backend        10   │
    └─────────────────────┘         └─────────────────────┘
```

**Esforço total estimado para resolver tudo:** 170 a 195 horas de desenvolvimento.

---

## Plano em 5 Etapas

### Etapa 0 — Esta Semana (3 horas)
Corrigir os 3 riscos imediatos descritos acima. Custo mínimo, impacto máximo.

---

### Etapa 1 — Próximas 2 Semanas (10 horas)
**Foco: Velocidade do sistema**
- Adicionar índices no banco de dados (tabela de membros é a principal)
- Migrar o CSS da aplicação do modo CDN para instalação local
- Resultado: carregamento da aplicação reduz de ~4,7MB para menos de 200KB por acesso

---

### Etapa 2 — Próximo Mês (45 horas)
**Foco: Completar o módulo financeiro + acessibilidade**
- Concluir as 9 telas do módulo financeiro (em desenvolvimento)
- Corrigir problemas de acessibilidade que afetam usuários com deficiência visual
- Resultado: módulo financeiro disponível para igrejas + conformidade básica com padrões de acessibilidade

---

### Etapa 3 — 2º Mês (25 horas)
**Foco: Qualidade e estabilidade**
- Criar testes automatizados para as funcionalidades críticas
- Fortalecer a integridade dos dados no banco
- Criar processo de rollback para atualizações do sistema
- Resultado: cada nova funcionalidade tem risco de regressão controlado

---

### Etapa 4 — 3º Mês (40 horas)
**Foco: Escalabilidade do desenvolvimento**
- Criar biblioteca de componentes de interface reutilizáveis
- Resultado: desenvolvimento de novas telas 30-40% mais rápido, com aparência mais consistente

---

### Etapa 5 — Backlog Estratégico (80+ horas — planejamento futuro)
Itens de alto valor mas que requerem planejamento cuidadoso:
- Segurança de nível bancário (Row-Level Security no banco de dados)
- Histórico completo de exclusões (soft-delete universal)
- TypeScript para type safety
- Autenticação em dois fatores

---

## Impacto Financeiro de Não Agir

| Débito ignorado | Custo de corrigir hoje | Custo estimado depois |
|----------------|----------------------|----------------------|
| Lentidão (IDX-01) | 1h | 40h+ (refatorar queries + otimizar com sistema em prod) |
| Sem testes (SYS-01) | 20h (criação inicial) | +30-50% de tempo em cada bug futuro |
| Sem componentes (MNT-01) | 32-40h | Cada nova tela custa 30-40% mais para desenvolver |
| Tailwind CDN (PERF-01) | 3-5h | Problema piora com cada nova tela; UX degradada |

**Princípio geral:** débito técnico não pago dobra de custo a cada 6-12 meses de crescimento do sistema.

---

## O que NÃO Precisa de Atenção Urgente

Para tranquilidade: a maioria dos 54 pontos identificados são melhorias de qualidade e manutenibilidade — não emergências. O sistema pode continuar operando normalmente enquanto esses itens são resolvidos gradualmente. Os especialistas classificaram 31 dos 54 itens como Médio ou Baixo.

---

## Próximo Passo Recomendado

**Aprovação para iniciar a Etapa 0 (3 horas) imediatamente**, seguida do planejamento formal das Etapas 1 e 2 como parte do próximo ciclo de desenvolvimento.

---

*Relatório preparado por @analyst — Brownfield Discovery Fase 9*
*Dados técnicos completos: `docs/prd/technical-debt-assessment.md`*
*Próximo: @pm cria Epic e Stories para execução (Fase 10)*
