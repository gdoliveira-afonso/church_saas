const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Cria um registro de log de atividade silenciosamente (sem lançar exceção).
 */
async function createLog({ userId, userName, organizationId, action, resource, resourceId, detail, ip }) {
    try {
        await prisma.activityLog.create({
            data: {
                userId: userId || null,
                userName: userName || null,
                organizationId: organizationId || null,
                action,
                resource,
                resourceId: resourceId || null,
                detail: detail || null,
                ip: ip || null,
            }
        });
    } catch (e) {
        // Silently ignore — logs nunca devem quebrar a operação principal
        console.error('[ActivityLog] Erro ao salvar log:', e.message);
    }
}

/**
 * Middleware Express que injeta req.log(action, resource, resourceId, detail)
 * capturando automaticamente o userId, userName e IP do request atual.
 */
function activityLoggerMiddleware(req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    req.log = (action, resource, resourceId, detail) => {
        createLog({
            userId: req.user?.id,
            userName: req.user?.name || req.user?.username,
            organizationId: req.orgId || null,
            action,
            resource,
            resourceId: resourceId ? String(resourceId) : null,
            detail: detail ? String(detail) : null,
            ip,
        });
    };
    next();
}

module.exports = { createLog, activityLoggerMiddleware };
