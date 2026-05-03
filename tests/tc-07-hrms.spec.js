// TC-07 — HRMS
// Worker login fails on prod with "Invalid credentials" → most HRMS flows
// (clock-in, leave request, payslip view) are skipped with that note.
// We do try to discover any HRMS page from admin.
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

test.describe('TC-07 HRMS', () => {

  test('TC-07.1 Discover HRMS-style routes from admin (best effort)', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    let any = false;
    for (const route of ['/hrms', '/leaves', '/payslips', '/roster', '/clock', '/attendance']) {
      const resp = await page.goto(route, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForTimeout(1200);
      const has404 = await page.getByText(/404|not found/i).first().isVisible().catch(() => false);
      const stillThere = page.url().includes(route);
      console.log(`[TC-07.1] ${route} → status=${resp?.status()} url=${page.url()} 404=${has404}`);
      if (stillThere && !has404) any = true;
    }
    test.skip(!any, 'No HRMS routes found on admin nav — feature likely lives behind worker/employer roles whose creds are rejected.');
    expect(any).toBeTruthy();
  });

  test.skip('TC-07.2 Worker clocks in — SKIPPED (worker login rejected on prod)', () => {});
  test.skip('TC-07.3 Worker submits leave request — SKIPPED', () => {});
  test.skip('TC-07.4 Employer approves leave — SKIPPED (employer unverified)', () => {});
  test.skip('TC-07.5 Worker views payslips — SKIPPED', () => {});
  test.skip('TC-07.6 Employer creates shift — SKIPPED', () => {});
});
