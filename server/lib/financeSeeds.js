/**
 * financeSeeds.js
 * Seed idempotente para o módulo financeiro.
 * Cria conta padrão, plano de contas e fundos para uma organização.
 * Seguro para rodar múltiplas vezes (não duplica dados).
 */

async function seedFinance(orgId, prisma) {
  // 1. Conta Caixa Geral — cria apenas se não existir nenhuma conta para a org
  const existingAccounts = await prisma.financialAccount.count({
    where: { organizationId: orgId }
  });

  if (existingAccounts === 0) {
    await prisma.financialAccount.create({
      data: {
        name: 'Caixa Geral',
        type: 'CAIXA',
        initialBalance: 0,
        organizationId: orgId
      }
    });
    console.log(`[financeSeeds] Conta "Caixa Geral" criada para org ${orgId}`);
  }

  // 2. Plano de contas (upsert por code + organizationId)
  const contas = [
    // RECEITAS
    { code: '1.1', name: 'Dízimos',          type: 'RECEITA' },
    { code: '1.2', name: 'Oferta do Culto',  type: 'RECEITA' },
    { code: '1.3', name: 'Oferta Especial',  type: 'RECEITA' },
    { code: '1.4', name: 'Primícias',        type: 'RECEITA' },
    { code: '1.5', name: 'Missões',          type: 'RECEITA' },
    { code: '1.6', name: 'Outras Receitas',  type: 'RECEITA' },
    // DESPESAS
    { code: '2.1', name: 'Pessoal e Remuneração',   type: 'DESPESA' },
    { code: '2.2', name: 'Aluguel e Estrutura',      type: 'DESPESA' },
    { code: '2.3', name: 'Água, Luz e Internet',     type: 'DESPESA' },
    { code: '2.4', name: 'Material e Equipamentos',  type: 'DESPESA' },
    { code: '2.5', name: 'Missões e Evangelismo',    type: 'DESPESA' },
    { code: '2.6', name: 'Eventos e Programação',    type: 'DESPESA' },
    { code: '2.7', name: 'EBD e Ministérios',        type: 'DESPESA' },
    { code: '2.8', name: 'Manutenção e Reparos',     type: 'DESPESA' },
    { code: '2.9', name: 'Outras Despesas',          type: 'DESPESA' }
  ];

  for (const conta of contas) {
    await prisma.chartOfAccount.upsert({
      where: {
        code_organizationId: { code: conta.code, organizationId: orgId }
      },
      update: {},
      create: { ...conta, organizationId: orgId }
    });
  }
  console.log(`[financeSeeds] Plano de contas (${contas.length} categorias) sincronizado para org ${orgId}`);

  // 3. Fundos padrão (upsert por name + organizationId)
  const fundos = [
    {
      name: 'Fundo Missionário',
      description: 'Recursos destinados ao apoio missionário',
      color: 'blue'
    },
    {
      name: 'Fundo de Construção',
      description: 'Recursos para obras e reformas',
      color: 'amber'
    }
  ];

  for (const fundo of fundos) {
    await prisma.fund.upsert({
      where: {
        name_organizationId: { name: fundo.name, organizationId: orgId }
      },
      update: {},
      create: { ...fundo, organizationId: orgId }
    });
  }
  console.log(`[financeSeeds] Fundos (${fundos.length}) sincronizados para org ${orgId}`);
}

module.exports = { seedFinance };
