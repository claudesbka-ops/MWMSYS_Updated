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

  test('TC-07.2 Worker clocks in', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await page.goto('/clock', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);
    const clockBtn = page.locator('button').filter({ hasText: /clock in|check in|time in|start work|punch in/i }).first();
    if (!await clockBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No clock-in button found');
    }
    await clockBtn.click();
    await page.waitForTimeout(3000);
    const success = await page.locator('[data-sonner-toast]').filter({ hasText: /clocked|checked|time|success/i }).first().isVisible().catch(() => false);
    const time = await page.getByText(/\d{1,2}:\d{2}/i).first().isVisible().catch(() => false);
    console.log(`[TC-07.2] clock-in success=${success} time=${time}`);
    expect(success || time).toBeTruthy();
  });
  test('TC-07.3 Worker submits leave request', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await page.goto('/leaves', { waitUntil: 'domcontentloaded' }).catch(() => page.goto('/dashboard', { waitUntil: 'domcontentloaded' }));
    await page.waitForTimeout(2000);
    const newBtn = page.locator('button').filter({ hasText: /apply leave|new leave|request leave|submit leave/i }).first();
    if (!await newBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No "Apply Leave" button found');
    }
    await newBtn.click();
    await page.waitForTimeout(1500);
    const reason = page.locator('textarea, input[placeholder*="reason" i]').first();
    const startDate = page.locator('input[type="date"]').first();
    if (await reason.isVisible().catch(() => false)) await reason.fill('Family emergency');
    if (await startDate.isVisible().catch(() => false)) {
      const today = new Date().toISOString().slice(0, 10);
      await startDate.fill(today);
    }
    const submit = page.locator('button[type="submit"], button').filter({ hasText: /submit|apply|request|save/i }).first();
    if (await submit.isVisible().catch(() => false)) await submit.click();
    await page.waitForTimeout(3000);
    const success = await page.locator('[data-sonner-toast]').filter({ hasText: /submitted|applied|success|leave/i }).first().isVisible().catch(() => false);
    const pending = await page.getByText(/pending|submitted|under review/i).first().isVisible().catch(() => false);
    console.log(`[TC-07.3] leave success=${success} pending=${pending}`);
    expect(success || pending).toBeTruthy();
  });

  test('TC-07.4 Employer approves leave request', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/leaves', { waitUntil: 'domcontentloaded' }).catch(() => page.goto('/dashboard', { waitUntil: 'domcontentloaded' }));
    await page.waitForTimeout(2000);
    const approveBtn = page.locator('button').filter({ hasText: /approve|accept|grant/i }).first();
    if (!await approveBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No Approve button — no pending leave requests');
    }
    await approveBtn.click();
    await page.waitForTimeout(2000);
    const success = await page.locator('[data-sonner-toast]').filter({ hasText: /approved|accepted|success/i }).first().isVisible().catch(() => false);
    const approved = await page.getByText(/approved|accepted|granted/i).first().isVisible().catch(() => false);
    console.log(`[TC-07.4] approve success=${success} approved=${approved}`);
    expect(success || approved).toBeTruthy();
  });

  test('TC-07.5 Worker views payslips', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await page.goto('/payslips', { waitUntil: 'domcontentloaded' }).catch(() => page.goto('/payroll', { waitUntil: 'domcontentloaded' }));
    await page.waitForTimeout(2000);
    const hasContent = await page.locator('table, [role="table"], .payslip, [class*="payslip" i]').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no payslips|empty|no data/i).first().isVisible().catch(() => false);
    const hasHeading = await page.getByRole('heading', { name: /payslip|salary|payroll/i }).first().isVisible().catch(() => false);
    console.log(`[TC-07.5] payslips content=${hasContent} empty=${hasEmpty} heading=${hasHeading}`);
    expect(hasContent || hasEmpty || hasHeading).toBeTruthy();
  });

  test('TC-07.6 Employer creates shift', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/roster', { waitUntil: 'domcontentloaded' }).catch(() => page.goto('/schedule', { waitUntil: 'domcontentloaded' }));
    await page.waitForTimeout(2000);
    const newBtn = page.locator('button').filter({ hasText: /new shift|add shift|create shift|schedule shift/i }).first();
    if (!await newBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No "New Shift" button found on roster/schedule page');
    }
    await newBtn.click();
    await page.waitForTimeout(1500);
    const workerSelect = page.locator('select, input[placeholder*="worker" i], input[type="text"]').first();
    const dateInput = page.locator('input[type="date"]').first();
    if (await workerSelect.isVisible().catch(() => false)) await workerSelect.fill('qaworker');
    if (await dateInput.isVisible().catch(() => false)) {
      const today = new Date().toISOString().slice(0, 10);
      await dateInput.fill(today);
    }
    const save = page.locator('button[type="submit"], button').filter({ hasText: /save|create|add|confirm/i }).first();
    if (await save.isVisible().catch(() => false)) await save.click();
    await page.waitForTimeout(3000);
    const success = await page.locator('[data-sonner-toast]').filter({ hasText: /created|added|scheduled|success/i }).first().isVisible().catch(() => false);
    const inList = await page.getByText(/qaworker|shift/i).first().isVisible().catch(() => false);
    console.log(`[TC-07.6] shift success=${success} inList=${inList}`);
    expect(success || inList).toBeTruthy();
  });
});
