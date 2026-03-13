const prisma = require('../lib/prisma');

/**
 * financeGuard — verifica se o módulo financeiro está habilitado para a organização.
 * Deve ser usado após authenticateToken e resolveOrgContext.
 * Retorna 403 com code 'FINANCE_DISABLED' se o módulo estiver desativado,
 * exceto para usuários com role SUPERADMIN.
 * Em caso de erro na query, chama next() (fail-open).
 */
async function financeGuard(req, res, next) {
    if (req.user?.role === 'SUPERADMIN') return next();

    try {
        const org = await prisma.organization.findUnique({
            where: { id: req.orgId },
            select: { financialEnabled: true }
        });

        if (org && org.financialEnabled === false) {
            return res.status(403).json({
                error: 'Módulo financeiro não está habilitado para esta organização',
                code: 'FINANCE_DISABLED'
            });
        }
    } catch (err) {
        console.error('[financeGuard] Erro ao verificar financialEnabled:', err.message);
    }

    next();
}

module.exports = financeGuard;
