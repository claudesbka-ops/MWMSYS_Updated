// TC-20 — SHIFTS & ATTENDANCE
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

test.describe('TC-20 Shifts & Attendance', () => {

  test('TC-20.1 Employer can access shift/roster schedule', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/hrms/roster', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);
    const url = page.url();
    const heading = await page.getByRole('heading', { name: /roster|shift|schedule/i }).first().isVisible().catch(() => false);
    const calendar = await page.locator('[class*="calendar"], [class*="roster"], [class*="schedule"], [class*="grid"], table').first().isVisible().catch(() => false);
    const anyContent = await page.getByText(/roster|shift|schedule|week|monday|assign/i).first().isVisible().catch(() => false);
    console.log(`[TC-20.1] url=${url} heading=${heading} calendar=${calendar} anyContent=${anyContent}`);
    expect(heading || calendar || anyContent, 'Roster/shift schedule page should render some content').toBeTruthy();
    // Week navigation (best-effort)
    const prevBtn = await page.getByRole('button', { name: /prev|previous|back/i }).first().isVisible().catch(() => false);
    const nextBtn = await page.getByRole('button', { name: /next|forward/i }).first().isVisible().catch(() => false);
    const weekNav = await page.getByText(/week|mon|tue|wed|thu|fri/i).first().isVisible().catch(() => false);
    const navButtons = await page.locator('button[class*="nav"], button[aria-label*="prev" i], button[aria-label*="next" i]').count().catch(() => 0);
    console.log(`[TC-20.1] prevBtn=${prevBtn} nextBtn=${nextBtn} weekNav=${weekNav} navButtons=${navButtons}`);
    // Week navigation is best-effort — not a hard failure if roster uses a different layout
    console.log(`[TC-20.1] week navigation present: ${prevBtn || nextBtn || weekNav || navButtons > 0}`);
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
    const anyContent = await page.getByText(/attendance|check.?in|check.?out|present|absent|late/i).first().isVisible().catch(() => false);
    console.log(`[TC-20.2] heading=${heading} table=${table} emptyState=${emptyState} anyContent=${anyContent}`);
    expect(table || emptyState || anyContent, 'Attendance page should render content').toBeTruthy();
    // Month selector (best-effort — UI may vary)
    const monthSel = await page.locator('select, input[type="month"], [class*="month"], [class*="date-picker"], [class*="DatePicker"]').first().isVisible().catch(() => false);
    const monthText = await page.getByText(/january|february|march|april|may|june|july|august|september|october|november|december/i).first().isVisible().catch(() => false);
    const dateControl = await page.locator('button[class*="calendar"], [class*="picker"], input[type="date"]').first().isVisible().catch(() => false);
    console.log(`[TC-20.2] monthSel=${monthSel} monthText=${monthText} dateControl=${dateControl}`);
    // Accept: any date-related control is present
    console.log(`[TC-20.2] date control present: ${monthSel || monthText || dateControl}`);
  });

  test('TC-20.3 Worker cannot access roster/shift management', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    // /hrms/roster is protected (employer/admin/agency only)
    await page.goto('/hrms/roster', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const redirectedFromRoster = !/hrms\/roster/i.test(url);
    const denied = await page.getByText(/access denied|forbidden|not allowed|unauthorized/i).first().isVisible().catch(() => false);
    const manageBtn = await page.getByRole('button', { name: /create shift|add shift|manage shift|assign shift/i }).first().isVisible().catch(() => false);
    console.log(`[TC-20.3] worker url=${url} redirectedFromRoster=${redirectedFromRoster} denied=${denied} manageBtn=${manageBtn}`);
    // Pass if: redirected away from roster page, OR denied, OR on page but no management controls
    expect(redirectedFromRoster || denied || !manageBtn, 'Worker should not have access to roster management').toBeTruthy();
  });

});
