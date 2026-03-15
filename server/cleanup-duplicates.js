const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'matriz' } });
  if (!org) return;

  const people = await prisma.person.findMany({
    where: { organizationId: org.id }
  });

  const seen = new Set();
  const duplicates = [];

  for (const p of people) {
    if (seen.has(p.name)) {
      duplicates.push(p.id);
    } else {
      seen.add(p.name);
    }
  }

  console.log(`Encontradas ${duplicates.length} pessoas duplicadas.`);

  if (duplicates.length > 0) {
    await prisma.person.deleteMany({
      where: { id: { in: duplicates } }
    });
    console.log('Duplicatas removidas com sucesso.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
