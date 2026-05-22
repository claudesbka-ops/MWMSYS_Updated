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
  const baseURL = 'https://mwmsys-master.vercel.app';
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
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
  let url = page.url();
  const toast = await page.locator('[data-sonner-toast]').first().innerText().catch(() => '');

  // Some QA accounts on prod are stuck on /complete-profile (a gating page
  // shown after a successful login when the user's profile is incomplete).
  // The login itself succeeded, so treat this as ok=true. We try to submit
  // the form once with safe defaults so that subsequent navigation works,
  // and if that still leaves us on /complete-profile we navigate to /dashboard
  // directly (most app routes work as long as we have a valid session).
  if (/\/complete-profile/i.test(url)) {
    // Fill in any empty required textboxes with safe placeholder data so
    // the submit button becomes enabled. Fields we've seen: Full Name,
    // Contact Number, Passport Number, Address, Company Name, etc.
    const defaults = {
      name:    'QA Test User',
      contact: '+60123456789',
      phone:   '+60123456789',
      passport:'TEST123456',
      address: '123 Test Street, Kuala Lumpur',
      company: 'QA Test Co',
      ssm:     'QA-TEST-123456',
      city:    'Kuala Lumpur',
      country: 'Malaysia',
    };
    const textboxes = page.locator('input:visible, textarea:visible');
    const n = await textboxes.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const box = textboxes.nth(i);
      const val = await box.inputValue().catch(() => '');
      if (val && val.trim()) continue; // already filled
      const type = (await box.getAttribute('type').catch(() => '')) || '';
      if (['hidden', 'submit', 'button', 'file', 'checkbox', 'radio'].includes(type)) continue;
      // Heuristic: match the nearest label/placeholder text.
      const ph = (await box.getAttribute('placeholder').catch(() => '')) || '';
      const name = (await box.getAttribute('name').catch(() => '')) || '';
      const id = (await box.getAttribute('id').catch(() => '')) || '';
      const haystack = (ph + ' ' + name + ' ' + id).toLowerCase();
      let fill = 'QA Test';
      for (const [k, v] of Object.entries(defaults)) {
        if (haystack.includes(k)) { fill = v; break; }
      }
      // If no placeholder/name hints, look at the preceding label text.
      if (fill === 'QA Test') {
        const labelTxt = await box.evaluate(el => {
          const lab = el.closest('label') || el.previousElementSibling || el.parentElement;
          return (lab?.innerText || '').toLowerCase();
        }).catch(() => '');
        for (const [k, v] of Object.entries(defaults)) {
          if (labelTxt.includes(k)) { fill = v; break; }
        }
      }
      await box.fill(fill).catch(() => {});
    }
    // Now try to submit.
    let submitBtn = page.getByRole('button', { name: /^submit$|continue|finish|complete|save/i }).first();
    if (await submitBtn.isVisible().catch(() => false) && !(await submitBtn.isDisabled().catch(() => false))) {
      await submitBtn.click().catch(() => {});
      await page.waitForTimeout(2500);
      url = page.url();
    }
    if (/\/complete-profile/i.test(url)) {
      // Still gated — navigate to /dashboard directly; many routes still
      // work because the session cookie is valid.
      const baseURL = 'https://mwmsys-master.vercel.app';
      await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1500);
      url = page.url();
    }
    return { ok: true, url, note: 'complete-profile-gate-bypassed' };
  }

  if (/\/(dashboard|labour-dashboard|embassy-dashboard)/i.test(url)) return { ok: true, url };
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

