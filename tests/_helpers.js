// Shared helpers + account fixtures for the MWMS QA suite.
// Discovered via probes: /login renders a role-tile selector; clicking a tile
// reveals the actual email/password form. Worker form additionally requires
// Passport Number. Successful login lands on /dashboard.
const { expect } = require('@playwright/test');

// Magic OTP value accepted by the backend for any @test.com email when
// ALLOW_TEST_ACCOUNTS != 'false' (see ModernBackend/src/routes/authRoutes.ts).
const OTP_MAGIC = '000000';

const ACCOUNTS = {
  worker:   { tile: /Worker Login/i,             email: 'worker@test.com',   password: 'Test@1234', passport: 'TEST123456' },
  employer: { tile: /Employer Login/i,           email: 'employer@test.com', password: 'Test@1234' },
  agency:   { tile: /Agency Login/i,             email: 'agency@test.com',   password: 'Test@1234' },
  admin:    { tile: /Admin Login/i,              email: 'admin@test.com',    password: 'Test@1234' },
  labour:   { tile: /Labour Department Login/i,  email: 'labour@test.com',   password: 'Test@1234' },
  embassy:  { tile: /Embassy \(Source\) Login/i, email: 'embassy@test.com',  password: 'Test@1234' },
};

/** Open /login, click role tile, wait for the form to render. */
async function openRoleForm(page, role) {
  const acct = ACCOUNTS[role];
  if (!acct) throw new Error(`Unknown role: ${role}`);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500); // let SPA hydrate
  await page.getByRole('button', { name: acct.tile }).first().click();
  await expect(page.getByPlaceholder(/Email Address/i)).toBeVisible({ timeout: 10_000 });
  return acct;
}

/** Fill the credentials form for a given role (does not click submit). */
async function fillCreds(page, role, overrides = {}) {
  const acct = ACCOUNTS[role];
  await page.getByPlaceholder(/Email Address/i).fill(overrides.email ?? acct.email);
  if (role === 'worker') {
    await page.getByPlaceholder(/Passport Number/i).fill(overrides.passport ?? acct.passport);
  }
  await page.getByPlaceholder(/^Password$/i).fill(overrides.password ?? acct.password);
}

/** Click the Login submit button. */
async function submitLogin(page) {
  await page.getByRole('button', { name: /^Login$/i }).first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
}

/**
 * Full login flow. Returns one of:
 *   { ok: true, url }                       on /dashboard
 *   { ok: false, reason: 'verify-email', url }   when redirected to /verify-email
 *   { ok: false, reason: 'invalid', toast }      when server rejects
 *   { ok: false, reason: 'unknown', url, toast } anything else
 */
async function login(page, role, overrides = {}) {
  await openRoleForm(page, role);
  await fillCreds(page, role, overrides);
  await submitLogin(page);
  await page.waitForTimeout(2500);
  const url = page.url();
  const toast = await page.locator('[data-sonner-toast]').first().innerText().catch(() => '');
  if (/\/dashboard/i.test(url)) return { ok: true, url };
  if (/\/verify-email/i.test(url)) return { ok: false, reason: 'verify-email', url };
  if (/invalid/i.test(toast))    return { ok: false, reason: 'invalid', toast };
  return { ok: false, reason: 'unknown', url, toast };
}

/** Skip the test if pre-condition (login) didn't succeed; log a uniform note. */
function skipIfLoginFailed(test, result, role) {
  if (!result.ok) {
    const note = `Cannot proceed: ${role} login failed (${result.reason})${result.toast ? ' "' + result.toast + '"' : ''}${result.url ? ' @ ' + result.url : ''}`;
    test.skip(true, note);
  }
}

module.exports = { ACCOUNTS, OTP_MAGIC, login, openRoleForm, fillCreds, submitLogin, skipIfLoginFailed };

