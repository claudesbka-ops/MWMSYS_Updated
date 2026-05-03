// TC-04 — PANIC / SOS
// Pressing the panic button is destructive (creates a real prod alert) → SKIPPED.
// We do verify the admin Live Alerts page is reachable & renders.
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

test.describe('TC-04 Panic / SOS', () => {

  test('TC-04.1 Admin dashboard shows "Active Panic Alerts" widget', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await expect(page.getByRole('heading', { name: /active panic alerts/i }).first()).toBeVisible();
  });

  test('TC-04.2 Admin Live Alerts page reachable', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/admin/live-alerts', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    // Page should at least render without 404 and stay logged in.
    expect(page.url()).toMatch(/admin\/live-alerts|dashboard/);
    await expect(page.locator('body')).not.toContainText(/404|not found/i);
  });

  test('TC-04.3 Admin dashboard has "Live Operations Map" panel', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await expect(page.getByRole('heading', { name: /live operations map/i }).first()).toBeVisible();
  });

  test.skip('TC-04.4 Worker presses panic button → alert triggered — SKIPPED (destructive on prod)', () => {});
  test.skip('TC-04.5 Alert appears in admin dashboard real-time — SKIPPED (depends on TC-04.4)', () => {});
  test.skip('TC-04.6 Alert shows worker name/photo/location — SKIPPED', () => {});
  test.skip('TC-04.7 GPS coordinates accurate — SKIPPED', () => {});
  test.skip('TC-04.8 Admin clicks Resolve → moves alert — SKIPPED (destructive)', () => {});
  test.skip('TC-04.9 Real-time update across two tabs — SKIPPED (depends on TC-04.4)', () => {});
});
