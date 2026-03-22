const prisma = require('../lib/prisma');
const { sendPushToUsers } = require('../lib/pushNotification');

/**
 * Verifica aniversariantes de hoje e amanhã e envia notificações para líderes e supervisores.
 */
async function checkBirthdays() {
    try {
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const formatDate = (date) => {
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${m}-${d}`;
        };

        const todayMD = formatDate(today);
        const tomorrowMD = formatDate(tomorrow);

        console.log(`[BirthdayService] Verificando aniversariantes para ${todayMD} (hoje) e ${tomorrowMD} (amanhã)`);

        // Busca pessoas e usuários (aniversariantes)
        // Como o birthdate é String (geralmente YYYY-MM-DD), usamos endsWith para MM-DD
        const people = await prisma.person.findMany({
            where: {
                OR: [
                    { birthdate: { endsWith: todayMD } },
                    { birthdate: { endsWith: tomorrowMD } }
                ]
            },
            include: {
                cell: {
                    select: {
                        id: true,
                        name: true,
                        leaderId: true,
                        viceLeaderId: true,
                        generationId: true
                    }
                }
            }
        });

        for (const person of people) {
            const isToday = person.birthdate.endsWith(todayMD);
            const targetDateStr = isToday ? 'hoje' : 'amanhã';
            const title = isToday ? '🎉 Aniversário Hoje!' : '🎂 Aniversário Amanhã';
            const prefix = isToday ? 'Hoje' : 'Amanhã';
            const action = isToday ? 'parabenize' : 'prepare-se para parabenizar';
            
            const cellName = person.cell ? person.cell.name : 'Sem Célula';
            const message = `${prefix} é o aniversário de ${person.name} (${cellName})! ${action} esta pessoa!`;
            const actionUrl = `#/profile?id=${person.id}`;

            // Destinatários: Líderes da Célula
            const recipientIds = new Set();
            if (person.cell) {
                if (person.cell.leaderId) recipientIds.add(person.cell.leaderId);
                if (person.cell.viceLeaderId) recipientIds.add(person.cell.viceLeaderId);

                // Líderes de Geração
                if (person.cell.generationId) {
                    const genLeaders = await prisma.user.findMany({
                        where: {
                            organizationId: person.organizationId,
                            role: 'LIDER_GERACAO',
                            generationId: person.cell.generationId
                        },
                        select: { id: true }
                    });
                    genLeaders.forEach(u => recipientIds.add(u.id));
                }
            }

            // Supervisores (todos da organização)
            const supervisors = await prisma.user.findMany({
                where: {
                    organizationId: person.organizationId,
                    role: 'SUPERVISOR'
                },
                select: { id: true }
            });
            supervisors.forEach(u => recipientIds.add(u.id));

            // Remove o próprio aniversariante se ele for um líder/supervisor (opcional, mas evita auto-notificação de "parabenize você mesmo")
            if (person.userId) recipientIds.delete(person.userId);

            if (recipientIds.size > 0) {
                const notifications = Array.from(recipientIds).map(userId => ({
                    userId,
                    organizationId: person.organizationId,
                    title,
                    message,
                    action: actionUrl
                }));

                // Evita criar notificações duplicadas se o job rodar mais de uma vez (ex: restart do servidor)
                // Usamos uma janela de 20h para considerar "recente"
                const newRecipientIds = [];
                for (const notif of notifications) {
                    const existing = await prisma.notification.findFirst({
                        where: {
                            userId: notif.userId,
                            title: notif.title,
                            message: notif.message,
                            organizationId: notif.organizationId,
                            createdAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) }
                        }
                    });

                    if (!existing) {
                        await prisma.notification.create({ data: notif });
                        newRecipientIds.push(notif.userId);
                    }
                }

                // Push notifications para novos destinatários (fire-and-forget)
                if (newRecipientIds.length) {
                    sendPushToUsers(newRecipientIds, { title, body: message, data: { action: '#/people' } }).catch(() => {});
                }
            }
        }

        console.log(`[BirthdayService] Processamento concluído para ${people.length} aniversariantes.`);
    } catch (error) {
        console.error('[BirthdayService] Erro ao processar aniversários:', error);
    }
}

module.exports = { checkBirthdays };
