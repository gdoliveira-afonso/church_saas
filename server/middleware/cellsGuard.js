const prisma = require('../lib/prisma');

/**
 * cellsGuard — verifica se o módulo celular está habilitado para a organização.
 * Deve ser usado após authenticateToken e resolveOrgContext.
 * Retorna 403 com code 'CELLS_DISABLED' se o módulo estiver desativado,
 * exceto para usuários com role SUPERADMIN.
 * Em caso de erro na query, chama next() (fail-open) para não derrubar o sistema.
 */
async function cellsGuard(req, res, next) {
    if (req.user?.role === 'SUPERADMIN') return next();

    try {
        const org = await prisma.organization.findUnique({
            where: { id: req.orgId },
            select: { cellsEnabled: true }
        });

        if (org && org.cellsEnabled === false) {
            return res.status(403).json({
                error: 'Módulo Celular não habilitado para esta organização',
                code: 'CELLS_DISABLED'
            });
        }
    } catch (err) {
        console.error('[cellsGuard] Erro ao verificar cellsEnabled:', err.message);
        // fail-open: em caso de erro na query, permite a requisição continuar
    }

    next();
}

module.exports = cellsGuard;
