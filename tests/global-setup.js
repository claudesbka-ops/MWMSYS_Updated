// Runs once before the entire Playwright test session. Ensures the 6
// @test.com QA accounts exist and are loggable on the deployed backend.
// Reuses the standalone seed module so behaviour matches `npm run test:seed`.
const { ACCOUNTS, ensureAccount } = require('../scripts/seed-test-accounts');

const API_BASE = process.env.API_BASE_URL
  || 'https://mwmsysmaster-production.up.railway.app';

module.exports = async () => {
  console.log(`[global-setup] seeding QA accounts on ${API_BASE} ...`);
  let okCount = 0;
  for (const acct of ACCOUNTS) {
    try {
      const r = await ensureAccount(API_BASE, acct);
      const tag = r.action === 'failed' ? 'FAIL' : 'OK  ';
      console.log(`[global-setup] ${tag} ${acct.role.padEnd(16)} ${acct.email.padEnd(22)} -> ${r.action}${r.error ? ' :: ' + r.error : ''}`);
      if (r.action !== 'failed') okCount++;
    } catch (e) {
      console.log(`[global-setup] FAIL ${acct.role} -> ${e.message}`);
    }
  }
  console.log(`[global-setup] ${okCount}/${ACCOUNTS.length} accounts ready.`);
  if (okCount < ACCOUNTS.length) {
    console.log('[global-setup] WARNING: some accounts are not loggable. Tests that depend on those roles will fall back to skipIfLoginFailed.');
    console.log('[global-setup] Most likely cause: the backend at ' + API_BASE + ' has not yet been redeployed with the @test.com bypass (ModernBackend/src/routes/authRoutes.ts).');
  }
};
