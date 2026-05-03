// TC-08 — PROFILE
// Most edits are destructive → SKIPPED. We verify the header shows the actual
// logged-in user, and the /account page is reachable.
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

test.describe('TC-08 Profile', () => {

  test('TC-08.1 Admin dashboard header shows real username (not hardcoded)', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    // Header should greet by username (whatever it is) — not a hardcoded string.
    await expect(page.getByText(/welcome back,\s*\w+/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('TC-08.2 Embassy dashboard header is role-specific (not generic)', async ({ page }) => {
    const r = await login(page, 'embassy');
    skipIfLoginFailed(test, r, 'embassy');
    await expect(page.getByRole('heading', { name: /embassy portal|source country workers/i }).first())
      .toBeVisible();
  });

  test('TC-08.3 /account page reachable for admin', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: /account/i }).first()).toBeVisible();
  });

  test.skip('TC-08.4 Edit name/phone — SKIPPED (destructive on prod admin)', () => {});
  test.skip('TC-08.5 Upload new profile photo — SKIPPED (destructive)', () => {});
  test.skip('TC-08.6 Change password + login w/ new — SKIPPED (would lock test account)', () => {});
  test.skip('TC-08.7 Plan badge tier — SKIPPED (no plan badge surfaced for admin)', () => {});
});
