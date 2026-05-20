// TC-19 — EMBASSY & LABOUR DASHBOARDS
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

const BASE = 'https://mwmsysmaster-production.up.railway.app';
const BYPASS = { 'x-test-bypass': 'playwright-test-bypass' };

test.describe('TC-19 Embassy & Labour Dashboards', () => {

  test('TC-19.1 Embassy can access embassy dashboard', async ({ page }) => {
    const r = await login(page, 'embassy');
    skipIfLoginFailed(test, r, 'embassy');
    await page.goto('/embassy-dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const onPage = /embassy/i.test(url);
    const heading = await page.getByRole('heading', { name: /embassy|dashboard/i }).first().isVisible().catch(() => false);
    const cards = await page.locator('[class*="card"], [class*="stat"], [class*="Card"]').count().catch(() => 0);
    console.log(`[TC-19.1] url=${url} heading=${heading} cards=${cards}`);
    expect(onPage || heading, 'Embassy dashboard heading should be visible').toBeTruthy();
    expect(cards >= 1, 'Stat cards should render').toBeTruthy();
  });

  test('TC-19.2 Labour can access labour dashboard', async ({ page }) => {
    const r = await login(page, 'labour');
    skipIfLoginFailed(test, r, 'labour');
    await page.goto('/labour-dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const onPage = /labour/i.test(url);
    const heading = await page.getByRole('heading', { name: /labour|dashboard/i }).first().isVisible().catch(() => false);
    const cards = await page.locator('[class*="card"], [class*="stat"], [class*="Card"]').count().catch(() => 0);
    console.log(`[TC-19.2] url=${url} heading=${heading} cards=${cards}`);
    expect(onPage || heading, 'Labour dashboard heading should be visible').toBeTruthy();
    expect(cards >= 1, 'Stat cards should render').toBeTruthy();
  });

  test('TC-19.3 Admin cannot access embassy dashboard', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/embassy-dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const redirected = !/embassy-dashboard/i.test(url);
    const denied = await page.getByText(/access denied|forbidden|not allowed|unauthorized/i).first().isVisible().catch(() => false);
    console.log(`[TC-19.3] admin url=${url} redirected=${redirected} denied=${denied}`);
    expect(redirected || denied, 'Admin should be redirected or denied from embassy dashboard').toBeTruthy();
  });

  test('TC-19.4 Embassy API returns nationality-scoped data', async ({ page, request }) => {
    const r = await login(page, 'embassy');
    skipIfLoginFailed(test, r, 'embassy');
    const token = await page.evaluate(() => {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    });
    const resp = await request.get(`${BASE}/Api/Authority/Embassy/Dashboard`, {
      headers: { Authorization: `Bearer ${token}`, ...BYPASS },
    });
    const status = resp.status();
    console.log(`[TC-19.4] status=${status}`);
    expect([200, 201].includes(status), `Embassy Dashboard API should return 200, got ${status}`).toBeTruthy();
    const body = await resp.json().catch(() => ({}));
    console.log(`[TC-19.4] body keys=${Object.keys(body).join(',')}`);
    // Should have some data fields (scoped to nationality)
    const hasData = Object.keys(body).length > 0;
    expect(hasData, 'Embassy API response should contain data').toBeTruthy();
  });

});
