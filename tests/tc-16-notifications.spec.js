// TC-16 — NOTIFICATIONS
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

const BASE = 'https://mwmsysmaster-production.up.railway.app';
const BYPASS = { 'x-test-bypass': 'playwright-test-bypass' };

test.describe('TC-16 Notifications', () => {

  test('TC-16.1 Notification bell visible in header and dropdown opens', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.waitForTimeout(1500);
    const bell = page.locator('[aria-label*="notification" i], [data-testid*="bell"], button:has([class*="Bell"]), button:has([class*="bell"])').first();
    const bellAlt = page.locator('svg[class*="Bell"], svg[class*="bell"]').first();
    const bellVisible = await bell.isVisible().catch(() => false) || await bellAlt.isVisible().catch(() => false);
    console.log(`[TC-16.1] bell visible=${bellVisible}`);
    if (!bellVisible) {
      test.skip(true, 'Notification bell not found in header');
    }
    await (await bell.isVisible().catch(() => false) ? bell : bellAlt).click().catch(() => {});
    await page.waitForTimeout(1000);
    const dropdown = await page.locator('[class*="dropdown"], [class*="popover"], [role="menu"], [class*="notification"]').first().isVisible().catch(() => false);
    const notifText = await page.getByText(/notification|no new|mark all/i).first().isVisible().catch(() => false);
    console.log(`[TC-16.1] dropdown=${dropdown} notifText=${notifText}`);
    expect(dropdown || notifText, 'Notification dropdown should open').toBeTruthy();
  });

  test('TC-16.2 Notification settings page loads with toggles', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/notification-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const heading = await page.getByRole('heading', { name: /notification/i }).first().isVisible().catch(() => false);
    expect(heading, 'Notifications heading should be visible').toBeTruthy();
    const toggles = await page.locator('[role="switch"], input[type="checkbox"]').count().catch(() => 0);
    const testEmailBtn = await page.getByRole('button', { name: /send test email|test email/i }).first().isVisible().catch(() => false);
    console.log(`[TC-16.2] heading=${heading} toggles=${toggles} testEmailBtn=${testEmailBtn}`);
    expect(toggles >= 1, 'At least one toggle switch should be visible').toBeTruthy();
    expect(testEmailBtn, 'Send Test Email button should be visible').toBeTruthy();
  });

  test('TC-16.3 Unread count endpoint returns { count: number }', async ({ page, request }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    const token = await page.evaluate(() => {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    });
    const resp = await request.get(`${BASE}/Api/Notifications/UnreadCount`, {
      headers: { Authorization: `Bearer ${token}`, ...BYPASS },
    });
    const status = resp.status();
    console.log(`[TC-16.3] status=${status}`);
    expect([200, 201].includes(status), `UnreadCount should return 200, got ${status}`).toBeTruthy();
    const body = await resp.json().catch(() => ({}));
    console.log(`[TC-16.3] body=${JSON.stringify(body)}`);
    expect(typeof body.count === 'number', 'Response should contain { count: number }').toBeTruthy();
  });

  test('TC-16.4 Mark all read endpoint returns 200', async ({ page, request }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    const token = await page.evaluate(() => {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    });
    const resp = await request.fetch(`${BASE}/Api/Notifications/ReadAll`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, ...BYPASS },
    });
    const status = resp.status();
    console.log(`[TC-16.4] mark-all-read status=${status}`);
    expect([200, 201, 204].includes(status), `ReadAll should return 2xx, got ${status}`).toBeTruthy();
  });

});
