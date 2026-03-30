/**
 * Reset de senha do superadmin
 * Uso: node reset-superadmin.js [nova-senha]
 * Se não passar senha, usa '123456' como padrão.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
    const newPassword = process.argv[2] || '123456';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Busca pelo role SUPERADMIN (independente do username configurado)
    const superadmin = await prisma.user.findFirst({
        where: { role: 'SUPERADMIN' }
    });

    if (!superadmin) {
        console.error('❌ Nenhum usuário SUPERADMIN encontrado no banco.');
        process.exit(1);
    }

    await prisma.user.update({
        where: { id: superadmin.id },
        data: { password: hashedPassword }
    });

    console.log(`✅ Senha do superadmin "${superadmin.username}" redefinida para: ${newPassword}`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
