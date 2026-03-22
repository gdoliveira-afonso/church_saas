/**
 * permissions.js — Central de controle de acesso do SGI.
 *
 * Centraliza todas as funções de verificação de permissão por módulo,
 * eliminando a duplicação existente em financeAccess.js e ebd.js.
 *
 * Uso: substituir chamadas inline nas rotas por estas funções.
 */

// ---------------------------------------------------------------------------
// Helper interno: parse seguro de secondaryRoles
// ---------------------------------------------------------------------------
function parseSecondaryRoles(user) {
  if (!user?.secondaryRoles) return [];
  if (Array.isArray(user.secondaryRoles)) return user.secondaryRoles;
  try {
    return JSON.parse(user.secondaryRoles);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// MÓDULO FINANCEIRO
// ---------------------------------------------------------------------------

/**
 * Acesso operacional ao módulo financeiro.
 * ADMIN, SUPERADMIN, AGENTE_FINANCEIRO ou GESTOR_FINANCEIRO.
 */
function hasFinanceAccess(req) {
  const role = req.user?.role;
  if (['ADMIN', 'SUPERADMIN'].includes(role)) return true;
  const sr = parseSecondaryRoles(req.user);
  return sr.includes('AGENTE_FINANCEIRO') || sr.includes('GESTOR_FINANCEIRO');
}

/**
 * Acesso gerencial ao módulo financeiro (relatórios, configurações).
 * ADMIN, SUPERADMIN ou GESTOR_FINANCEIRO.
 */
function hasFinanceAdminAccess(req) {
  const role = req.user?.role;
  if (['ADMIN', 'SUPERADMIN'].includes(role)) return true;
  const sr = parseSecondaryRoles(req.user);
  return sr.includes('GESTOR_FINANCEIRO');
}

// ---------------------------------------------------------------------------
// MÓDULO EBD
// ---------------------------------------------------------------------------

/**
 * Acesso administrativo ao módulo EBD.
 * ADMIN, SUPERVISOR, SUPERADMIN ou SUPERINTENDENTE_EBD.
 */
function hasEbdAdminAccess(req) {
  if (['ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(req.user?.role)) return true;
  const sr = parseSecondaryRoles(req.user);
  return sr.includes('SUPERINTENDENTE_EBD');
}

/**
 * Acesso de admin restrito ao módulo EBD.
 * ADMIN ou SUPERADMIN apenas.
 */
function hasEbdStrictAdminAccess(req) {
  if (['ADMIN', 'SUPERADMIN'].includes(req.user?.role)) return true;
  const sr = parseSecondaryRoles(req.user);
  return sr.includes('SUPERINTENDENTE_EBD');
}

// ---------------------------------------------------------------------------
// MÓDULO CÉLULAS
// ---------------------------------------------------------------------------

/**
 * Acesso de gestão ao módulo de células.
 * ADMIN, SUPERVISOR ou SUPERADMIN.
 */
function hasCellsManageAccess(req) {
  return ['ADMIN', 'SUPERVISOR', 'SUPERADMIN'].includes(req.user?.role);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  parseSecondaryRoles,
  // Finance
  hasFinanceAccess,
  hasFinanceAdminAccess,
  // EBD
  hasEbdAdminAccess,
  hasEbdStrictAdminAccess,
  // Cells
  hasCellsManageAccess,
};
