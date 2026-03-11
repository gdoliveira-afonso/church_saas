// config.js — funções de configuração do sistema sem dependências circulares
const prisma = require('../lib/prisma');

const DEFAULT_NOTIFICATION_CONFIG = {
    newMember: { enabled: true },
    newEvent: { enabled: true },
    updatedEvent: { enabled: true },
    dailyReminder: { enabled: true }
};

async function getNotificationConfig(orgId) {
    try {
        if (orgId) {
            const row = await prisma.systemConfig.findUnique({
                where: { key_organizationId: { key: 'notificationConfig', organizationId: orgId } }
            });
            if (row) return JSON.parse(row.value);
        } else {
            const row = await prisma.systemConfig.findFirst({
                where: { key: 'notificationConfig' }
            });
            if (row) return JSON.parse(row.value);
        }
    } catch (e) { /* tabela ainda não existe: retorna default */ }
    return DEFAULT_NOTIFICATION_CONFIG;
}

module.exports = { getNotificationConfig };
