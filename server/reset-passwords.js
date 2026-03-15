const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const newPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.updateMany({
    where: { username: { in: ['admin', 'superadmin'] } },
    data: { password: hashedPassword }
  });

  console.log('Passwords for "admin" and "superadmin" have been reset to: admin123');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
