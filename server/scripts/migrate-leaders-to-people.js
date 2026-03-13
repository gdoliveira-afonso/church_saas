const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrate() {
  console.log('--- Início da Migração Retroativa: Líderes para Person ---');

  try {
    // Buscar todas as organizações
    const orgs = await prisma.organization.findMany();
    let totalMigrated = 0;

    for (const org of orgs) {
      console.log(`Verificando Org: ${org.name} (ID: ${org.id})`);

      // Buscar usuários da organização que sejam LEADER ou VICE_LEADER
      const leaders = await prisma.user.findMany({
        where: {
          organizationId: org.id,
          role: {
            in: ['LEADER', 'VICE_LEADER', 'SUPERVISOR', 'ADMIN'],
          },
        },
      });

      console.log(`  Encontrados ${leaders.length} líderes/admins para verificar.`);

      for (const leader of leaders) {
        // Verificar se já existe uma pessoa vinculada a este User
        const existingPersonByUserId = await prisma.person.findUnique({
          where: { userId: leader.id }
        });

        if (existingPersonByUserId) {
          console.log(`  - [PULADO] User "${leader.name}" já está vinculado a uma Pessoa.`);
          continue;
        }

        // Se não achou por User ID, tenta pelo nome na mesma org (backwards compatibility)
        const existingPersonByName = await prisma.person.findFirst({
          where: {
            organizationId: org.id,
            name: leader.name,
          },
        });

        if (existingPersonByName) {
          console.log(`  - [PULADO] Pessoa já existe com o nome: ${leader.name}. Vinculando ao User.`);
          await prisma.person.update({
            where: { id: existingPersonByName.id },
            data: { userId: leader.id }
          });
          continue;
        }

        // Determinar status baseado na role
        let personStatus = 'Membro';
        if (leader.role === 'VICE_LEADER') personStatus = 'Vice-Líder';
        if (['LEADER', 'LIDER_GERACAO'].includes(leader.role)) personStatus = 'Líder';

        // Tentar descobrir a célula se ele for líder de alguma
        let cellId = null;
        if (leader.role === 'LEADER' || leader.role === 'VICE_LEADER') {
            const cell = await prisma.cell.findFirst({
                where: {
                    organizationId: org.id,
                    OR: [
                        { leaderId: leader.id },
                        { viceLeaderId: leader.id }
                    ]
                }
            });
            if (cell) cellId = cell.id;
        }

        // Criar o registro na tabela Person
        const person = await prisma.person.create({
          data: {
            organizationId: org.id,
            userId: leader.id,
            name: leader.name,
            status: personStatus,
            cellId: cellId,
            // tracksData, discipleship e riskLevel não existem no schema prisma explicitamente
          },
        });

        // Criar marco inicial
        await prisma.personMilestone.create({
          data: {
            personId: person.id,
            organizationId: org.id,
            type: 'STATUS_CHANGE',
            label: 'Cadastrado via Migração',
            icon: 'person_add',
            color: 'blue',
            date: new Date(),
          }
        });

        console.log(`  + [CRIADO] Pessoa criada com sucesso para: ${leader.name} (Status: ${personStatus})`);
        totalMigrated++;
      }
    }

    console.log('--- Migração Concluída ---');
    console.log(`Total de líderes migrados para Pessoas: ${totalMigrated}`);

  } catch (error) {
    console.error('Erro durante a migração:', error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
