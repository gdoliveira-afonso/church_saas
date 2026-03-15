const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 [START] Iniciando povoamento de dados de teste...');

  // 1. Obter Organização Matriz
  console.log('1. Buscando organização matriz...');
  const org = await prisma.organization.findFirst({ where: { slug: 'matriz' } });
  if (!org) {
    console.error('❌ ERRO: Organização Matriz não encontrada.');
    return;
  }
  const orgId = org.id;
  console.log(`✅ Org encontrada: ${org.name} (${orgId})`);

  // 2. Criar Gerações
  console.log('2. Criando/Buscando Gerações...');
  const generationsData = [
    { name: 'Crianças (Kids)', description: 'Ministério Infantil' },
    { name: 'Jovens (Jump)', description: 'Ministério de Jovens' },
    { name: 'Adultos', description: 'Ministério de Adultos' }
  ];

  const generations = {};
  for (const g of generationsData) {
    let gen = await prisma.generation.findFirst({
      where: { name: g.name, organizationId: orgId }
    });
    if (!gen) {
      gen = await prisma.generation.create({
        data: { ...g, organizationId: orgId }
      });
      console.log(`   + Geração criada: ${g.name}`);
    } else {
      console.log(`   ~ Geração já existe: ${g.name}`);
    }
    generations[g.name] = gen;
  }

  // 3. Usuários de Liderança
  console.log('3. Criando/Buscando Usuários...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const leadersData = [
    { name: 'Ricardo Supervisor', username: 'sup_ricardo', role: 'SUPERVISOR', genName: 'Adultos' },
    { name: 'Ana Líder Geração', username: 'lider_ana', role: 'LIDER_GERACAO', genName: 'Jovens (Jump)' },
    { name: 'Marcos Líder Célula', username: 'lider_marcos', role: 'LEADER', genName: 'Adultos' },
    { name: 'Julia Professora', username: 'prof_julia', role: 'USER', sRoles: ['PROFESSOR'], genName: 'Crianças (Kids)' }
  ];

  const users = {};
  for (const u of leadersData) {
    let user = await prisma.user.findUnique({ where: { username: u.username } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: u.name,
          username: u.username,
          password: hashedPassword,
          role: u.role,
          secondaryRoles: u.sRoles ? JSON.stringify(u.sRoles) : null,
          generationId: generations[u.genName].id,
          organizationId: orgId
        }
      });
      console.log(`   + Usuário criado: ${u.username}`);
    } else {
      console.log(`   ~ Usuário já existe: ${u.username}`);
    }
    users[u.name] = user;
  }

  // 4. Células
  console.log('4. Criando/Buscando Células...');
  const cellsData = [
    { name: 'Célula Esperança', day: 'Sábado', time: '19:30', genName: 'Adultos', leaderName: 'Marcos Líder Célula' },
    { name: 'Célula Fogo', day: 'Sexta', time: '20:00', genName: 'Jovens (Jump)', leaderName: 'Ana Líder Geração' },
    { name: 'Célula Kids 1', day: 'Domingo', time: '10:00', genName: 'Crianças (Kids)', leaderName: 'Julia Professora' }
  ];

  const cells = {};
  for (const c of cellsData) {
    let cell = await prisma.cell.findFirst({ where: { name: c.name, organizationId: orgId } });
    if (!cell) {
      cell = await prisma.cell.create({
        data: {
          name: c.name,
          meetingDay: c.day,
          meetingTime: c.time,
          generationId: generations[c.genName].id,
          leaderId: users[c.leaderName].id,
          organizationId: orgId,
          status: 'ativa'
        }
      });
      console.log(`   + Célula criada: ${c.name}`);
    } else {
      console.log(`   ~ Célula já existe: ${c.name}`);
    }
    cells[c.name] = cell;
  }

  // 5. Pessoas
  console.log('5. Criando Pessoas (Membros)...');
  const peopleData = [
    { name: 'Gabriel Afonso', status: 'Membro', cellName: 'Célula Esperança' },
    { name: 'Maria Silva', status: 'Membro', cellName: 'Célula Esperança' },
    { name: 'João Oliveira', status: 'Líder', cellName: 'Célula Fogo' },
    { name: 'Beatriz Santos', status: 'Visitante', cellName: 'Célula Fogo' },
    { name: 'Enzo Rodrigues', status: 'Membro', cellName: 'Célula Kids 1' },
    { name: 'Valentina Lima', status: 'Visitante', cellName: 'Célula Kids 1' }
  ];

  const people = {};
  for (const p of peopleData) {
    let person = await prisma.person.findFirst({ where: { name: p.name, organizationId: orgId } });
    if (!person) {
      person = await prisma.person.create({
        data: {
          name: p.name,
          status: p.status,
          cellId: p.cellName ? cells[p.cellName].id : null,
          organizationId: orgId,
          address: 'Rua das Flores, 123'
        }
      });
      console.log(`   + Pessoa criada: ${p.name}`);
    } else {
      console.log(`   ~ Pessoa já existe: ${p.name}`);
    }
    people[p.name] = person;
  }

  // 6. EBD
  console.log('6. Configurando EBD...');
  const ebdData = [
    { name: 'Discipulado 1', prof: 'Julia Professora' },
    { name: 'Teologia Básica', prof: 'Ricardo Supervisor' }
  ];
  const ebdClasses = {};
  for (const e of ebdData) {
    let cls = await prisma.ebdClass.findFirst({ where: { name: e.name, organizationId: orgId } });
    if (!cls) {
      cls = await prisma.ebdClass.create({
        data: { name: e.name, professorId: users[e.prof].id, organizationId: orgId }
      });
      console.log(`   + Classe EBD: ${e.name}`);
    } else {
      console.log(`   ~ Classe EBD já existe: ${e.name}`);
    }
    ebdClasses[e.name] = cls;
  }

  const enrolls = [
    { p: 'Gabriel Afonso', c: 'Teologia Básica' },
    { p: 'Maria Silva', c: 'Teologia Básica' },
    { p: 'Enzo Rodrigues', c: 'Discipulado 1' }
  ];
  for (const en of enrolls) {
    const pId = people[en.p].id;
    const cId = ebdClasses[en.c].id;
    const exist = await prisma.ebdStudent.findFirst({ where: { personId: pId, ebdClassId: cId } });
    if (!exist) {
      await prisma.ebdStudent.create({ data: { personId: pId, ebdClassId: cId } });
      console.log(`   + Matrícula: ${en.p} em ${en.c}`);
    }
  }

  // 7. Financeiro
  console.log('7. Gerando dados financeiros...');
  let bank = await prisma.financialAccount.findFirst({ where: { name: 'Banco do Brasil', organizationId: orgId } });
  if (!bank) {
    bank = await prisma.financialAccount.create({
      data: { name: 'Banco do Brasil', type: 'CONTA_CORRENTE', initialBalance: 500000, organizationId: orgId }
    });
    console.log('   + Conta Bancária criada');
  }

  const chartTithes = await prisma.chartOfAccount.findFirst({ where: { code: '1.1', organizationId: orgId } });
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });

  const dons = [
    { p: 'Gabriel Afonso', val: 35000, date: '2026-03-01' },
    { p: 'Maria Silva', val: 20000, date: '2026-03-05' }
  ];
  for (const d of dons) {
    const exists = await prisma.donation.findFirst({ where: { personId: people[d.p].id, date: d.date, amount: d.val } });
    if (!exists) {
      const don = await prisma.donation.create({
        data: { personId: people[d.p].id, amount: d.val, type: 'DIZIMO', date: d.date, organizationId: orgId, registeredById: admin.id }
      });
      await prisma.financialTransaction.create({
        data: {
          organizationId: orgId, accountId: bank.id, chartAccountId: chartTithes?.id,
          type: 'RECEITA', description: `Dízimo: ${d.p}`, amount: d.val, date: d.date,
          referenceType: 'DONATION', registeredById: admin.id
        }
      });
      console.log(`   + Doação registrada: ${d.p} (${d.val/100})`);
    }
  }

  console.log('🚀 [END] Povoamento concluído!');
}

main().catch(e => { console.error('❌ ERRO CRÍTICO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
