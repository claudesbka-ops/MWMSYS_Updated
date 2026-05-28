import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyTestAccounts() {
  console.log('🔍 Verifying test accounts in database...\n');

  const testAccounts = [
    'test_admin',
    'test_worker', 
    'test_employer',
    'test_agent',
    'test_embassy',
    'test_labour'
  ];

  try {
    // Check current status
    console.log('📋 Current account status:');
    const currentUsers = await prisma.tbl_User.findMany({
      where: {
        User_Id: { in: testAccounts }
      },
      select: {
        User_Id: true,
        Email_Id: true,
        Is_Verified: true
      }
    });

    if (currentUsers.length === 0) {
      console.log('❌ No test accounts found. Please run createTestAccounts.js first.');
      return;
    }

    currentUsers.forEach(user => {
      console.log(`  ${user.User_Id}: ${user.Email_Id} - Verified: ${user.Is_Verified}`);
    });

    // Update verification status
    console.log('\n🔧 Updating verification status...');
    const updateResult = await prisma.tbl_User.updateMany({
      where: {
        User_Id: { in: testAccounts }
      },
      data: {
        Is_Verified: true
      }
    });

    console.log(`✅ Updated ${updateResult.count} accounts to verified status`);

    // Verify the update
    console.log('\n📊 Final verification:');
    const verifiedUsers = await prisma.tbl_User.findMany({
      where: {
        User_Id: { in: testAccounts }
      },
      select: {
        User_Id: true,
        Email_Id: true,
        Is_Verified: true
      }
    });

    verifiedUsers.forEach(user => {
      console.log(`  ${user.User_Id}: ${user.Email_Id} - Verified: ${user.Is_Verified} ✅`);
    });

    console.log('\n🎉 All test accounts are now verified and ready for login!');
    console.log('\n📱 Login credentials:');
    console.log('  Email: admin@test.com');
    console.log('  Password: Test123456');
    console.log('  URL: https://mwmsys-master.vercel.app/login');

  } catch (error) {
    console.error('❌ Error verifying accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTestAccounts();
