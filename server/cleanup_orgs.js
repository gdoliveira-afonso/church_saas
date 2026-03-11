// Apaga a org orfã "Paz 1" (sem usuários, slug 'igreja')
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const orgId = 'cmmlekz0p0002jit4ffl991is';
    
    // Limpa em ordem de dependências
    await prisma.systemConfig.deleteMany({ where: { organizationId: orgId } });
    await prisma.track.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.delete({ where: { id: orgId } });
    
    console.log('Org orfã removida com sucesso.');

    const orgs = await prisma.organization.findMany({ select: { name: true, slug: true } });
    console.log('Orgs restantes:', orgs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
