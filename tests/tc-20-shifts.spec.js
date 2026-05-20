// TC-20 — SHIFTS & ATTENDANCE
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

test.describe('TC-20 Shifts & Attendance', () => {

  test('TC-20.1 Employer can access shift/roster schedule', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    // Try /hrms/roster first, then /shifts as fallback
    await page.goto('/hrms/roster', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    let url = page.url();
    if (!/roster|shift/i.test(url)) {
      await page.goto('/shifts', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2000);
      url = page.url();
    }
    const heading = await page.getByRole('heading', { name: /roster|shift|schedule/i }).first().isVisible().catch(() => false);
    const calendar = await page.locator('[class*="calendar"], [class*="roster"], [class*="schedule"], table').first().isVisible().catch(() => false);
    console.log(`[TC-20.1] url=${url} heading=${heading} calendar=${calendar}`);
    expect(heading || calendar, 'Shift schedule/roster should render').toBeTruthy();
    // Week navigation
    const prevBtn = await page.getByRole('button', { name: /prev|previous|←|‹|<|back/i }).first().isVisible().catch(() => false);
    const nextBtn = await page.getByRole('button', { name: /next|→|›|>|forward/i }).first().isVisible().catch(() => false);
    const weekNav = await page.getByText(/week|mon|tue|wed|thu|fri/i).first().isVisible().catch(() => false);
    console.log(`[TC-20.1] prevBtn=${prevBtn} nextBtn=${nextBtn} weekNav=${weekNav}`);
    expect(prevBtn || nextBtn || weekNav, 'Week navigation should be visible').toBeTruthy();
  });

  test('TC-20.2 Employer can access attendance page', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/hrms/attendance', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const onPage = /attendance/i.test(url);
    const heading = await page.getByRole('heading', { name: /attendance/i }).first().isVisible().catch(() => false);
    expect(onPage || heading, 'Attendance page should load').toBeTruthy();
    // Attendance table or list
    const table = await page.locator('table, [role="table"], [class*="table"]').first().isVisible().catch(() => false);
    const emptyState = await page.getByText(/no attendance|no records|no data|empty/i).first().isVisible().catch(() => false);
    console.log(`[TC-20.2] heading=${heading} table=${table} emptyState=${emptyState}`);
    expect(table || emptyState, 'Attendance table or empty state should render').toBeTruthy();
    // Month selector
    const monthSel = await page.locator('select, input[type="month"], [class*="month"], [class*="date-picker"]').first().isVisible().catch(() => false);
    const monthText = await page.getByText(/january|february|march|april|may|june|july|august|september|october|november|december/i).first().isVisible().catch(() => false);
    console.log(`[TC-20.2] monthSel=${monthSel} monthText=${monthText}`);
    expect(monthSel || monthText, 'Month selector or month label should be visible').toBeTruthy();
  });

  test('TC-20.3 Worker cannot access shift management', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await page.goto('/shifts', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const redirected = !/^.*\/shifts$/i.test(url);
    const denied = await page.getByText(/access denied|forbidden|not allowed|unauthorized/i).first().isVisible().catch(() => false);
    // Worker may land on /hrms/attendance (read-only view) which is acceptable
    const workerHrmsView = /hrms/i.test(url);
    console.log(`[TC-20.3] worker url=${url} redirected=${redirected} denied=${denied} workerHrmsView=${workerHrmsView}`);
    // Pass if redirected away from /shifts OR is in a read-only HRMS view (no create/manage buttons)
    if (workerHrmsView) {
      const manageBtn = await page.getByRole('button', { name: /create shift|add shift|manage shift/i }).first().isVisible().catch(() => false);
      console.log(`[TC-20.3] manageBtn=${manageBtn}`);
      expect(!manageBtn, 'Worker should not see shift management controls').toBeTruthy();
    } else {
      expect(redirected || denied, 'Worker should be redirected or denied from /shifts').toBeTruthy();
    }
  });

});
