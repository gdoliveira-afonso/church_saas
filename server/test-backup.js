const fs = require('fs');
const prisma = require('./lib/prisma');

async function test() {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) return console.log("Nenhuma organização encontrada");
    
    const orgId = org.id;
    console.log(`Testando backup para organização: ${orgId}`);
    
    const whereOrg = { organizationId: orgId };

    const data = {
        users: await prisma.user.findMany({
            where: whereOrg,
            select: {
                id: true, name: true, username: true, role: true,
                secondaryRoles: true, organizationId: true, generationId: true,
                createdAt: true, updatedAt: true, tokenVersion: true
            }
        }),
        generations: await prisma.generation.findMany({ where: whereOrg }),
        cells: await prisma.cell.findMany({ where: whereOrg }),
        people: await prisma.person.findMany({ where: whereOrg }),
        consolidations: await prisma.consolidation.findMany({ where: { person: { organizationId: orgId } } }),
        milestones: await prisma.personMilestone.findMany({ where: whereOrg }),
        attendance: await prisma.attendance.findMany({ where: whereOrg }),
        attendanceRecords: await prisma.attendanceRecord.findMany({ where: { attendance: { organizationId: orgId } } }),
        pastoralNotes: await prisma.pastoralNote.findMany({ where: whereOrg }),
        visits: await prisma.visit.findMany({ where: whereOrg }),
        events: await prisma.event.findMany({ where: whereOrg }),
        eventExceptions: await prisma.eventException.findMany({ where: whereOrg }),
        cellCancellations: await prisma.cellCancellation.findMany({ where: whereOrg }),
        cellJustifications: await prisma.cellJustification.findMany({ where: whereOrg }),
        tracks: await prisma.track.findMany({ where: whereOrg }),
        personTracks: await prisma.personTrack.findMany({ where: { person: { organizationId: orgId } } }),
        notifications: await prisma.notification.findMany({ where: whereOrg }),
        forms: await prisma.form.findMany({ where: whereOrg }),
        triageQueue: await prisma.triageQueue.findMany({ where: whereOrg }),
        systemConfig: await prisma.systemConfig.findMany({ where: whereOrg }),
        apiKeys: await prisma.apiKey.findMany({ where: whereOrg }),
        webhooks: await prisma.webhook.findMany({ where: whereOrg }),
        webhookLogs: await prisma.webhookLog.findMany({ where: { webhook: { organizationId: orgId } } }),
        activityLogs: await prisma.activityLog.findMany({ where: whereOrg }),
        
        ebdClasses: await prisma.ebdClass.findMany({ where: whereOrg }),
        ebdStudents: await prisma.ebdStudent.findMany({ where: { ebdClass: { organizationId: orgId } } }),
        ebdAttendances: await prisma.ebdAttendance.findMany({ where: { ebdClass: { organizationId: orgId } } }),
        ebdAttendanceRecords: await prisma.ebdAttendanceRecord.findMany({ where: { ebdAttendance: { ebdClass: { organizationId: orgId } } } }),
        ebdOfferings: await prisma.ebdOffering.findMany({ where: whereOrg }),

        financialAccounts: await prisma.financialAccount.findMany({ where: whereOrg }),
        funds: await prisma.fund.findMany({ where: whereOrg }),
        chartOfAccounts: await prisma.chartOfAccount.findMany({ where: whereOrg }),
        financialTransactions: await prisma.financialTransaction.findMany({ where: whereOrg }),
        donations: await prisma.donation.findMany({ where: whereOrg }),
        donationBatches: await prisma.donationBatch.findMany({ where: whereOrg }),
        bills: await prisma.bill.findMany({ where: whereOrg }),
        billPayments: await prisma.billPayment.findMany({ where: { bill: { organizationId: orgId } } })
    };

    console.log("Executando JSON.stringify...");
    const json = JSON.stringify(data, null, 2);
    console.log("JSON finalizado. Tamanho:", json.length);

  } catch(e) {
    fs.writeFileSync('error_dump.txt', String(e.message));
    console.log("Erro gravado em error_dump.txt");
  } finally {
    await prisma.$disconnect();
  }
}

test();
