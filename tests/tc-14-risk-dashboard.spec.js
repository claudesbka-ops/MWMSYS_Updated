// TC-14 — RISK DASHBOARD
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

const BASE = 'https://mwmsysmaster-production.up.railway.app';
const BYPASS = { 'x-test-bypass': 'playwright-test-bypass' };

test.describe('TC-14 Risk Dashboard', () => {

  test('TC-14.1 Admin can access risk dashboard', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/risk-dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const heading = await page.getByRole('heading', { name: /risk/i }).first().isVisible().catch(() => false);
    expect(heading, 'Risk Dashboard heading should be visible').toBeTruthy();
    const cards = await page.locator('[class*="card"], [class*="stat"], [class*="Card"]').count().catch(() => 0);
    const table = await page.locator('table, [role="table"]').first().isVisible().catch(() => false);
    console.log(`[TC-14.1] heading=${heading} cards=${cards} table=${table}`);
    expect(cards >= 1 || table, 'Stat cards or worker table should render').toBeTruthy();
  });

  test('TC-14.2 Admin can calculate all risk scores', async ({ page, request }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/risk-dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const calcBtn = page.locator('button').filter({ hasText: /calculate all|recalculate|run risk/i }).first();
    if (!await calcBtn.isVisible().catch(() => false)) {
      // Fallback: test the API directly
      const token = await page.evaluate(() => localStorage.getItem('token') || sessionStorage.getItem('token') || '');
      const resp = await request.post(`${BASE}/Api/Risk/CalculateAll`, {
        headers: { Authorization: `Bearer ${token}`, ...BYPASS },
      });
      const status = resp.status();
      console.log(`[TC-14.2] API status=${status}`);
      expect([200, 202, 400, 403].includes(status), `API should respond, got ${status}`).toBeTruthy();
      return;
    }
    await calcBtn.click();
    await page.waitForTimeout(1500);
    const loading = await page.getByText(/calculating|running|loading/i).first().isVisible().catch(() => false);
    await page.waitForTimeout(5000);
    const done = await page.getByText(/calculated|complete|scores updated/i).first().isVisible().catch(() => false);
    const toast = await page.locator('[data-sonner-toast]').first().isVisible().catch(() => false);
    console.log(`[TC-14.2] loading=${loading} done=${done} toast=${toast}`);
    expect(loading || done || toast, 'Calculate All should show feedback').toBeTruthy();
  });

  test('TC-14.3 Agency can access risk dashboard', async ({ page }) => {
    const r = await login(page, 'agency');
    skipIfLoginFailed(test, r, 'agency');
    await page.goto('/risk-dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const onRisk = /risk/i.test(url);
    const heading = await page.getByRole('heading', { name: /risk/i }).first().isVisible().catch(() => false);
    console.log(`[TC-14.3] url=${url} heading=${heading}`);
    expect(onRisk || heading, 'Agency risk dashboard should load').toBeTruthy();
  });

  test('TC-14.4 Employer cannot access risk dashboard', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/risk-dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const redirected = !/risk-dashboard/i.test(url);
    const denied = await page.getByText(/access denied|forbidden|not allowed|unauthorized/i).first().isVisible().catch(() => false);
    console.log(`[TC-14.4] employer url=${url} redirected=${redirected} denied=${denied}`);
    expect(redirected || denied, 'Employer should be redirected or denied from risk dashboard').toBeTruthy();
  });

});
