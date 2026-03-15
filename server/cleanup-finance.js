const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'matriz' } });
  if (!org) return;

  // Cleanup Transações
  const transactions = await prisma.financialTransaction.findMany({
    where: { organizationId: org.id }
  });

  const seenTrans = new Set();
  const duplicateTrans = [];

  for (const t of transactions) {
    const key = `${t.description}-${t.amount}-${t.date}`;
    if (seenTrans.has(key)) {
      duplicateTrans.push(t.id);
    } else {
      seenTrans.add(key);
    }
  }

  console.log(`Encontradas ${duplicateTrans.length} transações duplicadas.`);
  if (duplicateTrans.length > 0) {
    await prisma.financialTransaction.deleteMany({
      where: { id: { in: duplicateTrans } }
    });
  }

  // Cleanup Doações
  const donations = await prisma.donation.findMany({
    where: { organizationId: org.id }
  });

  const seenDons = new Set();
  const duplicateDons = [];

  for (const d of donations) {
    const key = `${d.personId}-${d.visitorName}-${d.amount}-${d.date}`;
    if (seenDons.has(key)) {
      duplicateDons.push(d.id);
    } else {
      seenDons.add(key);
    }
  }

  console.log(`Encontradas ${duplicateDons.length} doações duplicadas.`);
  if (duplicateDons.length > 0) {
    await prisma.donation.deleteMany({
      where: { id: { in: duplicateDons } }
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
