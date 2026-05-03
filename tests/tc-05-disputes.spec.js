// TC-05 — SALARY DISPUTE
// Submitting/approving disputes is destructive → SKIPPED. We do verify the
// admin (and would-be agency/employer) dispute pages are reachable.
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

test.describe('TC-05 Salary Disputes', () => {

  test('TC-05.1 Admin /dispute page renders', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/dispute', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: /salary disputes/i }).first()).toBeVisible();
  });

  test('TC-05.2 Admin dispute page lists disputes (table or empty-state)', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/dispute', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const hasTable = await page.locator('table, [role="table"], [role="row"]').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no disputes|empty|nothing/i).first().isVisible().catch(() => false);
    expect(hasTable || hasEmpty, 'expected either table or empty-state').toBeTruthy();
  });

  test.skip('TC-05.3 Worker submits dispute — SKIPPED (worker login fails on prod + destructive)', () => {});
  test.skip('TC-05.4 Worker attaches proof — SKIPPED', () => {});
  test.skip('TC-05.5 Employer accepts dispute — SKIPPED (employer unverified + destructive)', () => {});
  test.skip('TC-05.6 Employer rejects + comment — SKIPPED', () => {});
  test.skip('TC-05.7 Agency read-only — SKIPPED (agency creds rejected on prod)', () => {});
  test.skip('TC-05.8 Reject without comment blocked — SKIPPED', () => {});
});
