# Story TD-4 — Acessibilidade Crítica (A11Y)

**Epic:** EPIC-TD
**Sprint:** Sprint 2
**Esforço:** 7.5 horas
**Prioridade:** P1
**Assignee:** @dev
**Status:** Ready

---

## User Story

**Como** usuário do CRM com necessidades especiais de acessibilidade,
**Quero** navegar pela aplicação com tecnologias assistivas e teclado,
**Para** usar o sistema com independência.

---

## Contexto

O CRM tem múltiplos problemas de acessibilidade identificados na auditoria. Esta story foca nos itens de maior impacto: botões sem labels para screen readers, modais sem trap de foco, e alvos de toque pequenos para mobile.

**Débitos cobertos:** A11Y-02, A11Y-04, FE-NEW-01, FE-NEW-03

---

## Acceptance Criteria

### AC-1: aria-label em botões de ícone (A11Y-02)
- [ ] Todos os botões que contêm apenas ícone (sem texto visível) têm `aria-label` descritivo
- [ ] Exemplos: botão de editar → `aria-label="Editar"`, botão de excluir → `aria-label="Excluir"`, sino de notificações → `aria-label="Notificações"`, toggle de tema → `aria-label="Alternar tema"`
- [ ] Verificar em: sidebar (desktop), header de cada view, botões de ação em listas (~35 botões em 15+ views)

### AC-2: Focus trap em modais (A11Y-04)
- [ ] `src/components/ui.js` — função `openModal()` implementa focus trap:
  - Ao abrir: foco vai para o primeiro elemento interativo do modal
  - Tab/Shift+Tab: navega apenas dentro do modal
  - Escape: fecha o modal
  - Ao fechar: foco retorna ao elemento que abriu o modal
- [ ] Testar navegação por teclado em pelo menos 3 modais diferentes

### AC-3: Validação de contraste para primaryColor (FE-NEW-01)
- [ ] `src/views/settings.js` — ao salvar `primaryColor`, calcular contraste com fundo branco (`#ffffff`)
- [ ] Se contraste < 4.5:1 (WCAG AA para texto normal), exibir aviso: `"Esta cor pode ter contraste insuficiente para leitura. Recomendamos cores mais escuras."`
- [ ] Aviso é informativo (não bloqueia o save)
- [ ] Fórmula de contraste: luminância relativa conforme WCAG 2.1

### AC-4: Alvos de toque ≥ 44×44px (FE-NEW-03)
- [ ] Sidebar links desktop: padding ajustado para atingir altura mínima de 44px
- [ ] Bottom nav items: verificar e ajustar se necessário
- [ ] Botões de ação em listas (`w-8 h-8` = 32px): adicionar padding negativo invisível (técnica de hit area) sem alterar layout visual

---

## Notas de Implementação

**Focus trap básico em openModal():**
```javascript
function openModal(html) {
  // ... código existente de montagem do modal ...
  const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const modal = document.getElementById('modal-content');
  const focusableElements = modal.querySelectorAll(focusableSelectors);
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  firstFocusable?.focus();

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault(); lastFocusable?.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault(); firstFocusable?.focus();
      }
    }
  });
}
```

**Cálculo de contraste (simplificado):**
```javascript
function getRelativeLuminance(hex) {
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 0xff) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;
  const toLinear = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
function getContrastRatio(hex1, hex2 = '#ffffff') {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2); const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
// Uso: if (getContrastRatio(primaryColor) < 4.5) showWarning()
```

---

## Arquivos a Modificar

- `src/components/ui.js` — focus trap em `openModal()`
- `src/views/settings.js` — validação de contraste
- Múltiplas views — `aria-label` nos botões (busca sistemática)
- `index.html` ou CSS global — ajuste de hit areas

---

## Definition of Done

- [ ] Todos os ACs implementados
- [ ] Navegação por Tab funcionando dentro de pelo menos 3 modais
- [ ] Aviso de contraste aparece para cores claras no admin de settings
- [ ] Commit: `fix: accessibility - focus trap, aria-labels, touch targets, contrast check [TD-4]`
