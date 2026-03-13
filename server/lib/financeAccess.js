/**
 * hasFinanceAccess — acesso operacional ao módulo financeiro.
 * ADMIN, SUPERADMIN ou secondaryRoles AGENTE_FINANCEIRO / GESTOR_FINANCEIRO.
 * SUPERVISOR não tem acesso automático.
 */
function hasFinanceAccess(req) {
    const role = req.user?.role;
    if (['ADMIN', 'SUPERADMIN'].includes(role)) return true;
    try {
        const secondary = JSON.parse(req.user?.secondaryRoles || '[]');
        return secondary.includes('AGENTE_FINANCEIRO') || secondary.includes('GESTOR_FINANCEIRO');
    } catch { return false; }
}

/**
 * hasFinanceAdminAccess — acesso gerencial (relatórios, configurações do módulo).
 * Apenas ADMIN, SUPERADMIN ou secondaryRole GESTOR_FINANCEIRO.
 */
function hasFinanceAdminAccess(req) {
    const role = req.user?.role;
    if (['ADMIN', 'SUPERADMIN'].includes(role)) return true;
    try {
        const secondary = JSON.parse(req.user?.secondaryRoles || '[]');
        return secondary.includes('GESTOR_FINANCEIRO');
    } catch { return false; }
}

module.exports = { hasFinanceAccess, hasFinanceAdminAccess };
