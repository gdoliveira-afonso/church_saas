const prisma = require('../lib/prisma');

/**
 * ebdGuard — verifica se o módulo EBD está habilitado para a organização.
 * Deve ser usado após authenticateToken e resolveOrgContext.
 * Retorna 403 com code 'EBD_DISABLED' se o módulo estiver desativado,
 * exceto para usuários com role SUPERADMIN.
 * Em caso de erro na query, chama next() (fail-open).
 */
async function ebdGuard(req, res, next) {
    if (req.user?.role === 'SUPERADMIN') return next();

    try {
        const org = await prisma.organization.findUnique({
            where: { id: req.orgId },
            select: { ebdEnabled: true }
        });

        if (org && org.ebdEnabled === false) {
            return res.status(403).json({
                error: 'Módulo EBD não habilitado para esta organização',
                code: 'EBD_DISABLED'
            });
        }
    } catch (err) {
        console.error('[ebdGuard] Erro ao verificar ebdEnabled:', err.message);
    }

    next();
}

module.exports = ebdGuard;
