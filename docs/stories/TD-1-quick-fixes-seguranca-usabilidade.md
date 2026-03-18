# Story TD-1 — Quick Fixes de Segurança e Usabilidade

**Epic:** EPIC-TD
**Sprint:** Sprint 0
**Esforço:** 3 horas
**Prioridade:** P0 — Executar antes do próximo deploy
**Assignee:** @dev
**Status:** Ready

---

## User Story

**Como** administrador do sistema,
**Quero** que falhas de banco não liberem acesso financeiro indevido e que usuários possam copiar textos da interface,
**Para** garantir segurança básica e usabilidade mínima do sistema.

---

## Contexto

Esta story resolve os 3 débitos mais urgentes identificados no Brownfield Discovery. Todos têm impacto crítico e esforço mínimo — são os melhores candidates para "quick wins" antes de qualquer deploy futuro.

**Débitos cobertos:** SEC-01, A11Y-01, A11Y-05, SYS-09, SYS-10

---

## Acceptance Criteria

### AC-1: financeGuard fail-closed (SEC-01)
- [ ] `server/middleware/financeGuard.js` — o bloco `catch` retorna `res.status(503).json({ error: 'Serviço temporariamente indisponível' })` em vez de chamar `next()`
- [ ] Verificar que `financeGuard` e `hasFinanceAccess()` de `server/lib/financeAccess.js` cobrem tanto o toggle `financialEnabled` quanto o RBAC (`AGENTE_FINANCEIRO`)
- [ ] Testar manualmente: simular erro de DB e confirmar que a rota retorna 503

### AC-2: user-select removido do body (A11Y-01)
- [ ] `index.html` — remover `user-select: none` do seletor `body` no `<style>` global
- [ ] Adicionar `select-none` (Tailwind) ou `user-select: none` inline nos elementos onde faz sentido manter: `.sidebar-link`, `.bottom-nav-item`, `.badge`, `.pill`, botões de ação de ícone
- [ ] Validar que nomes, telefones e endereços em perfis de membros são copiáveis

### AC-3: role="dialog" nos modais (A11Y-05)
- [ ] `src/components/ui.js` — função `openModal()` adiciona `role="dialog"` e `aria-modal="true"` no container do modal
- [ ] Validar com inspetor de acessibilidade do navegador

### AC-4: Limpeza de arquivos temporários (SYS-09, SYS-10)
- [ ] `tmp_test_db.js` removido da raiz do repositório
- [ ] `migrate.log` adicionado ao `.gitignore` (e removido do tracking se estiver commitado)
- [ ] Verificar se há outros arquivos `check-*.js` ou `debug-*.js` na raiz de `server/` para incluir no `.gitignore`

---

## Notas de Implementação

**SEC-01 — financeGuard:**
```javascript
// server/middleware/financeGuard.js
// ANTES:
} catch (err) {
  console.error('[financeGuard] Erro:', err.message);
}
next(); // ← FAIL-OPEN

// DEPOIS:
} catch (err) {
  console.error('[financeGuard] Erro ao verificar financialEnabled:', err.message);
  return res.status(503).json({ error: 'Serviço temporariamente indisponível' });
}
```

**A11Y-01 — user-select:**
```css
/* REMOVER do body em index.html */
/* body { user-select: none; } */

/* MANTER seletivamente com classe Tailwind nas views */
/* <div class="select-none"> nos elementos de navegação */
```

---

## Arquivos a Modificar

- `server/middleware/financeGuard.js`
- `server/lib/financeAccess.js` (auditoria — pode não precisar alterar)
- `index.html`
- `src/components/ui.js`
- `.gitignore`
- `tmp_test_db.js` (deletar)

---

## Definition of Done

- [ ] Todos os ACs implementados
- [ ] Nenhum arquivo de debug na raiz do projeto
- [ ] Revisão manual do financeGuard com cenário de falha simulada
- [ ] Commit com mensagem: `fix: financeGuard fail-closed, remove user-select global, modal a11y [TD-1]`
