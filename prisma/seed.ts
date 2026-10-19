import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany({});
  
  const hashedPassword = await bcrypt.hash('Password123!', 10);

  const userTest = await prisma.user.create({
    data: {
      email: 'user.test@thueradar.local',
      passwordHash: hashedPassword, // Đã sửa thành passwordHash cho khớp schema
      role: UserRole.USER,          // Đã sửa thành UserRole
    },
  });

  const reviewerTest = await prisma.user.create({
    data: {
      email: 'reviewer.test@thueradar.local',
      passwordHash: hashedPassword, 
      role: UserRole.REVIEWER,
    },
  });

  const adminTest = await prisma.user.create({
    data: {
      email: 'admin.test@thueradar.local',
      passwordHash: hashedPassword,
      role: UserRole.ADMIN,
    },
  });

  console.log('Đã tạo thành công các tài khoản test:');
  console.log({ userTest, reviewerTest, adminTest });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });