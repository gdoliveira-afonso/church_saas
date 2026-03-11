const prisma = require('../lib/prisma');

/**
 * Provisões iniciais para uma nova organização (White-labeling default)
 * @param {string} organizationId 
 */
async function provisionNewOrganization(organizationId) {
    console.log(`[AutoProvisioning] Provisioning default data for org: ${organizationId}`);
    
    try {
        // 1. Trilhas Padrão (Milestones)
        const defaultTracks = [
            { name: 'Batismo nas Águas', category: 'espiritual', icon: 'water_drop', color: 'blue' },
            { name: 'Batismo com o Espírito Santo', category: 'espiritual', icon: 'local_fire_department', color: 'orange' },
            { name: 'Escola de Líderes', category: 'espiritual', icon: 'school', color: 'purple' },
            { name: 'Encontro com Deus', category: 'retiros', icon: 'volunteer_activism', color: 'emerald' }
        ];

        for (const track of defaultTracks) {
            await prisma.track.create({
                data: { ...track, organizationId }
            });
        }

        // 2. Configurações de Dashboard e Notificações
        const defaultConfigs = [
            {
                key: 'dashboardActions',
                value: JSON.stringify({
                    noVisit: { enabled: true, days: 60 },
                    baptism: { enabled: true },
                    consolidation: { enabled: true, days: 15 },
                    reconciliation: { enabled: true }
                })
            },
            {
                key: 'notificationConfig',
                value: JSON.stringify({
                    newMember: { enabled: true },
                    newEvent: { enabled: true },
                    updatedEvent: { enabled: true },
                    dailyReminder: { enabled: true }
                })
            }
        ];

        for (const cfg of defaultConfigs) {
            await prisma.systemConfig.upsert({
                where: { key_organizationId: { key: cfg.key, organizationId } },
                update: { value: cfg.value },
                create: { ...cfg, organizationId }
            });
        }

        console.log(`[AutoProvisioning] Success for org: ${organizationId}`);
        return true;
    } catch (error) {
        console.error(`[AutoProvisioning] Failed for org: ${organizationId}`, error);
        return false;
    }
}

module.exports = { provisionNewOrganization };
