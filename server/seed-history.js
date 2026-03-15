const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedHistory() {
    console.log('🌱 Gerando dados históricos para BI...');
    
    const org = await prisma.organization.findFirst({ where: { slug: 'matriz' } });
    if (!org) {
        console.error('Org matriz não encontrada');
        return;
    }

    const account = await prisma.financialAccount.findFirst({ where: { organizationId: org.id } });
    const user = await prisma.user.findFirst({ where: { organizationId: org.id, role: 'ADMIN' } });
    const people = await prisma.person.findMany({ where: { organizationId: org.id }, take: 10 });

    if (!account || !user || people.length < 3) {
        console.error('Dependências insuficientes (conta, usuário ou pessoas)');
        return;
    }

    const chartAccounts = await prisma.chartOfAccount.findMany({ where: { organizationId: org.id } });
    const catDizimo = chartAccounts.find(c => c.name.toLowerCase().includes('dízimo')) || chartAccounts[0];
    const catOferta = chartAccounts.find(c => c.name.toLowerCase().includes('oferta')) || chartAccounts[0];
    const catEnergia = chartAccounts.find(c => c.name.toLowerCase().includes('energia')) || chartAccounts.find(c => c.type === 'DESPESA');

    const generateData = async (month, year, count, type = 'RECEITA', personSet = null) => {
        for (let i = 1; i <= count; i++) {
            const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
            const date = `${year}-${month}-${day}`;
            const amount = Math.floor(Math.random() * 50000) + 5000; // 50 a 550 reais

            const txn = await prisma.financialTransaction.create({
                data: {
                    organizationId: org.id,
                    accountId: account.id,
                    chartAccountId: type === 'RECEITA' ? (Math.random() > 0.5 ? catDizimo.id : catOferta.id) : catEnergia.id,
                    type,
                    description: type === 'RECEITA' ? `Contribuição Histórica ${i}` : `Despesa Histórica ${i}`,
                    amount,
                    date,
                    registeredById: user.id
                }
            });

            if (type === 'RECEITA' && personSet) {
                const person = personSet[Math.floor(Math.random() * personSet.length)];
                await prisma.donation.create({
                    data: {
                        organizationId: org.id,
                        personId: person.id,
                        type: 'DIZIMO',
                        amount,
                        date,
                        transactionId: txn.id,
                        registeredById: user.id
                    }
                });
            }
        }
    };

    // Janeiro: 15 receitas, 5 despesas (Pessoas 1-7)
    await generateData('01', '2026', 15, 'RECEITA', people.slice(0, 7));
    await generateData('01', '2026', 5, 'DESPESA');

    // Fevereiro: 12 receitas, 6 despesas (Pessoas 4-10) -> Aqui criamos "Adormecidos" (1-3) e "Novos" (8-10)
    await generateData('02', '2026', 12, 'RECEITA', people.slice(3, 10));
    await generateData('02', '2026', 6, 'DESPESA');

    console.log('✅ Dados históricos gerados com sucesso!');
}

seedHistory()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
