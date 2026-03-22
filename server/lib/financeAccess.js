/**
 * financeAccess.js — re-exporta de permissions.js para retrocompatibilidade.
 * Lógica centralizada em server/lib/permissions.js (ARCH-001).
 */
const { hasFinanceAccess, hasFinanceAdminAccess } = require('./permissions');

module.exports = { hasFinanceAccess, hasFinanceAdminAccess };
