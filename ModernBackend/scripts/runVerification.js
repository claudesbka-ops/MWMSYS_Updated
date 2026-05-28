// This script creates a verification endpoint that can be called to verify test accounts
// It can be deployed to Railway and then called to update the database

const https = require('https');

async function callVerificationEndpoint() {
  console.log('🚀 Deploying verification to Railway...');
  console.log('');
  console.log('⚠️  MANUAL STEPS REQUIRED:');
  console.log('============================');
  console.log('');
  console.log('1. Add this route to ModernBackend/src/index.ts:');
  console.log('');
  console.log('app.get("/admin/verify-test-accounts", async (req, res) => {');
  console.log('  try {');
  console.log('    const result = await prisma.tbl_User.updateMany({');
  console.log('      where: {');
  console.log('        User_Id: { in: [');
  console.log('          "test_admin", "test_worker", "test_employer",');
  console.log('          "test_agent", "test_embassy", "test_labour"');
  console.log('        ]}');
  console.log('      },');
  console.log('      data: { Is_Verified: true }');
  console.log('    });');
  console.log('    ');
  console.log('    res.json({');
  console.log('      message: `Verified ${result.count} test accounts`,');
  console.log('      accounts: [');
  console.log('        "test_admin", "test_worker", "test_employer",');
  console.log('        "test_agent", "test_embassy", "test_labour"');
  console.log('      ]');
  console.log('    });');
  console.log('  } catch (error) {');
  console.log('    res.status(500).json({ error: error.message });');
  console.log('  }');
  console.log('});');
  console.log('');
  console.log('2. Deploy to Railway: git push origin main');
  console.log('');
  console.log('3. Call the endpoint:');
  console.log('   curl https://mwmsysmaster-production.up.railway.app/admin/verify-test-accounts');
  console.log('');
  console.log('4. Test login:');
  console.log('   URL: https://mwmsys-master.vercel.app/login');
  console.log('   Email: admin@test.com');
  console.log('   Password: Test123456');
}

callVerificationEndpoint();
