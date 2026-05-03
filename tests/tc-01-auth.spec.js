// TC-01 — AUTHENTICATION
// Note: Worker signup + OTP verification are SKIPPED per scope decision
// (cannot read real OTP from email/SMS in automation). Login flows for all
// 6 roles are exercised against the live app.
const { test, expect } = require('@playwright/test');
const { ACCOUNTS, openRoleForm, fillCreds, submitLogin, login } = require('./_helpers');

test.describe('TC-01 Authentication', () => {

  test('TC-01.1 /login role selector renders all 6 role tiles', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(1500);
    for (const role of ['Admin', 'Worker', 'Employer', 'Agency', 'Embassy \\(Source\\)', 'Labour Department']) {
      await expect(page.getByRole('button', { name: new RegExp(`${role} Login`, 'i') })).toBeVisible();
    }
  });

  test('TC-01.2 Worker signup via public API succeeds (no inbox required)', async ({ request }) => {
    // Use a fresh deterministic id per attempt so the test is rerunnable.
    // Idempotent on the backend (409 "User already exists" is treated as success).
    const userId = 'qaworker_signup_' + Date.now();
    const payload = {
      userId,
      email: userId + '@test.com',
      password: 'Test@1234',
      role: 'worker',
      passportNo: 'TEST' + Date.now().toString().slice(-6),
      employerId: 'qaemployer',
      fullName: 'TC01.2 Worker',
    };
    const r = await request.post('https://mwmsysmaster-production.up.railway.app/signup', { data: payload });
    expect([201, 409]).toContain(r.status());
    const json = await r.json().catch(() => ({}));
    console.log(`[TC-01.2] signup -> ${r.status()} ${JSON.stringify(json).slice(0,200)}`);
  });

  test('TC-01.3 Verify OTP via magic value 000000 activates a fresh test account', async ({ request }) => {
    const userId = 'qaverify_' + Date.now();
    const email = userId + '@test.com';
    // Sign up
    const su = await request.post('https://mwmsysmaster-production.up.railway.app/signup', {
      data: { userId, email, password: 'Test@1234', role: 'employer', employerName: 'V Co' },
    });
    expect([201, 409]).toContain(su.status());
    // Verify with magic OTP
    const v = await request.post('https://mwmsysmaster-production.up.railway.app/Api/Auth/VerifyEmail', {
      data: { userId, otp: '000000' },
    });
    const vJson = await v.json().catch(() => ({}));
    console.log(`[TC-01.3] verify-email -> ${v.status()} ${JSON.stringify(vJson).slice(0,200)}`);
    expect(v.status(), 'magic-OTP verify must succeed for @test.com once backend bypass is deployed').toBe(200);
    expect(vJson.access_token, 'verify response should issue an access_token').toBeTruthy();
  });

  test('TC-01.4 Worker login → /dashboard', async ({ page }) => {
    const r = await login(page, 'worker');
    expect(r.ok, `worker login result: ${JSON.stringify(r)}`).toBe(true);
    expect(r.url).toMatch(/\/dashboard/);
  });

  test('TC-01.5 Employer login → /dashboard', async ({ page }) => {
    const r = await login(page, 'employer');
    expect(r.ok, `employer login result: ${JSON.stringify(r)}`).toBe(true);
    expect(r.url).toMatch(/\/dashboard/);
  });

  test('TC-01.6 Agency login → /dashboard', async ({ page }) => {
    const r = await login(page, 'agency');
    expect(r.ok, `agency login result: ${JSON.stringify(r)}`).toBe(true);
    expect(r.url).toMatch(/\/dashboard/);
  });

  test('TC-01.7 Admin login → /dashboard', async ({ page }) => {
    const r = await login(page, 'admin');
    expect(r.ok, `admin login result: ${JSON.stringify(r)}`).toBe(true);
    expect(r.url).toMatch(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i }).first()).toBeVisible();
  });

  test('TC-01.8 Labour Dept login → /dashboard', async ({ page }) => {
    const r = await login(page, 'labour');
    expect(r.ok, `labour login result: ${JSON.stringify(r)}`).toBe(true);
    expect(r.url).toMatch(/\/dashboard/);
  });

  test('TC-01.9 Embassy (Source) login → /dashboard', async ({ page }) => {
    const r = await login(page, 'embassy');
    expect(r.ok, `embassy login result: ${JSON.stringify(r)}`).toBe(true);
    expect(r.url).toMatch(/\/dashboard/);
  });

  test('TC-01.10 Wrong password → "Invalid credentials" toast', async ({ page }) => {
    await openRoleForm(page, 'admin');
    await fillCreds(page, 'admin', { password: 'definitely-wrong-pwd-123' });
    await submitLogin(page);
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: /invalid credentials/i }).first())
      .toBeVisible({ timeout: 10_000 });
    expect(page.url()).toMatch(/\/login\/admin/);
  });

  test('TC-01.11 Login before OTP verified → blocked / verify-email', async ({ page }) => {
    // The seeded @test.com employer is auto-verified, so use a one-shot
    // non-test-domain account created just for this assertion.
    const userId = 'qaunverified_' + Date.now();
    const email = userId + '@example.org'; // NOT @test.com -> will require real OTP
    const su = await page.request.post('https://mwmsysmaster-production.up.railway.app/signup', {
      data: { userId, email, password: 'Test@1234', role: 'employer', employerName: 'Unv Co' },
    });
    expect([201, 409]).toContain(su.status());
    // Now drive the UI: open the employer tile and try to log in. The
    // backend should block with 403 "Email not verified" and the SPA should
    // route to /verify-email.
    const { openRoleForm, fillCreds, submitLogin } = require('./_helpers');
    await openRoleForm(page, 'employer');
    await fillCreds(page, 'employer', { email, password: 'Test@1234' });
    await submitLogin(page);
    await page.waitForTimeout(2500);
    expect(page.url(), 'unverified login must NOT reach /dashboard').not.toMatch(/\/dashboard/);
  });

  test('TC-01.12 Refresh on dashboard keeps user logged in (no 404)', async ({ page }) => {
    const r = await login(page, 'admin');
    test.skip(!r.ok, 'admin login pre-req failed');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    expect(page.url()).toMatch(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i }).first()).toBeVisible();
  });

  test('TC-01.13 Session expiry (cleared storage) redirects to /login', async ({ page, context }) => {
    const r = await login(page, 'admin');
    test.skip(!r.ok, 'admin login pre-req failed');
    // Simulate session expiry by clearing all storage + cookies, then visiting
    // a protected route. The app must redirect to /login.
    await context.clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    expect(page.url()).toMatch(/\/login/);
  });
});
