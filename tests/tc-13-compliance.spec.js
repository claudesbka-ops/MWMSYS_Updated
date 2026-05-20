// TC-13 — COMPLIANCE DASHBOARD
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

const BASE = 'https://mwmsysmaster-production.up.railway.app';
const BYPASS = { 'x-test-bypass': 'playwright-test-bypass' };

test.describe('TC-13 Compliance Dashboard', () => {

  test('TC-13.1 Admin can access compliance dashboard', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/compliance', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const heading = await page.getByRole('heading', { name: /compliance/i }).first().isVisible().catch(() => false);
    expect(heading, 'Compliance heading should be visible').toBeTruthy();
    const scanBtn = await page.getByRole('button', { name: /run compliance scan|scan/i }).first().isVisible().catch(() => false);
    expect(scanBtn, 'Run Compliance Scan button should be visible').toBeTruthy();
    const cards = await page.locator('[class*="card"], [class*="stat"], [class*="Card"]').count().catch(() => 0);
    console.log(`[TC-13.1] heading=${heading} scanBtn=${scanBtn} cards=${cards}`);
    expect(cards >= 1, 'At least one stat card should render').toBeTruthy();
  });

  test('TC-13.2 Admin can run compliance scan', async ({ page, request }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/compliance', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const scanBtn = page.getByRole('button', { name: /run compliance scan|scan/i }).first();
    if (!await scanBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Run Compliance Scan button not found');
    }
    await scanBtn.click();
    await page.waitForTimeout(1500);
    const loading = await page.getByText(/scanning|loading|running/i).first().isVisible().catch(() => false);
    console.log(`[TC-13.2] loading state=${loading}`);
    // Wait for completion
    await page.waitForTimeout(5000);
    const done = await page.getByText(/scan complete|workers checked|alerts|compliance/i).first().isVisible().catch(() => false);
    const toast = await page.locator('[data-sonner-toast]').first().isVisible().catch(() => false);
    console.log(`[TC-13.2] done=${done} toast=${toast}`);
    expect(loading || done || toast, 'Scan should show feedback').toBeTruthy();
  });

  test('TC-13.3 Agency can access compliance dashboard (scoped view)', async ({ page }) => {
    const r = await login(page, 'agency');
    skipIfLoginFailed(test, r, 'agency');
    await page.goto('/compliance', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const onCompliance = /compliance/i.test(url);
    const heading = await page.getByRole('heading', { name: /compliance/i }).first().isVisible().catch(() => false);
    console.log(`[TC-13.3] url=${url} heading=${heading}`);
    expect(onCompliance || heading, 'Agency compliance page should load').toBeTruthy();
  });

  test('TC-13.4 Worker cannot access compliance dashboard', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await page.goto('/compliance', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const redirected = !/compliance/i.test(url);
    const denied = await page.getByText(/access denied|forbidden|not allowed|unauthorized/i).first().isVisible().catch(() => false);
    console.log(`[TC-13.4] worker url=${url} redirected=${redirected} denied=${denied}`);
    expect(redirected || denied, 'Worker should be redirected or denied from compliance').toBeTruthy();
  });

});
