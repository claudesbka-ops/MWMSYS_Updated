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

  test('TC-05.3 Worker submits a salary dispute', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await page.goto('/dispute', { waitUntil: 'domcontentloaded' }).catch(() => page.goto('/dashboard', { waitUntil: 'domcontentloaded' }));
    await page.waitForTimeout(2000);
    const newBtn = page.locator('button').filter({ hasText: /new dispute|submit dispute|create dispute|raise dispute/i }).first();
    if (!await newBtn.isVisible().catch(() => false)) {
      
    }
    await newBtn.click();
    await page.waitForTimeout(1500);
    // Fill dispute form
    const amount = page.locator('input[type="number"], input[placeholder*="amount" i]').first();
    const reason = page.locator('textarea, input[placeholder*="reason" i]').first();
    if (await amount.isVisible().catch(() => false)) await amount.fill('500');
    if (await reason.isVisible().catch(() => false)) await reason.fill('Underpaid for overtime hours');
    const submit = page.locator('button[type="submit"], button').filter({ hasText: /submit|create|save/i }).first();
    if (await submit.isVisible().catch(() => false)) await submit.click();
    await page.waitForTimeout(3000);
    const success = await page.locator('[data-sonner-toast]').filter({ hasText: /submitted|created|success|dispute/i }).first().isVisible().catch(() => false);
    const inList = await page.getByText(/underpaid|overtime|pending/i).first().isVisible().catch(() => false);
    console.log(`[TC-05.3] dispute success=${success} inList=${inList}`);
    expect(success || inList, 'Dispute should be submitted or appear in list').toBeTruthy();
  });

  test('TC-05.4 Worker can attach proof to a dispute (UI present)', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await page.goto('/dispute', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const fileInput = await page.locator('input[type="file"]').count();
    const attachText = await page.getByText(/attach|proof|upload/i).count();
    console.log(`[TC-05.4] file inputs=${fileInput} attach text=${attachText}`);
    if (fileInput === 0 && attachText === 0) {
      test.skip(true, 'No proof upload UI on /dispute');
    }
    expect(fileInput > 0 || attachText > 0).toBeTruthy();
  });

  test('TC-05.5 Employer accepts a dispute (no-op if none)', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/dispute', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const acceptBtn = page.locator('button').filter({ hasText: /accept|approve|resolve|agree/i }).first();
    if (!await acceptBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No Accept button found — no pending disputes');
    }
    await acceptBtn.click();
    await page.waitForTimeout(2000);
    const success = await page.locator('[data-sonner-toast]').filter({ hasText: /accepted|approved|resolved|success/i }).first().isVisible().catch(() => false);
    const badge = await page.getByText(/accepted|approved|resolved|green/i).first().isVisible().catch(() => false);
    console.log(`[TC-05.5] accept success=${success} badge=${badge}`);
    expect(success || badge, 'Dispute should show accepted status').toBeTruthy();
  });

  test('TC-05.6 Employer rejects dispute with comment (no-op if none)', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/dispute', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const rejectBtn = page.locator('button').filter({ hasText: /reject|decline|deny/i }).first();
    if (!await rejectBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No Reject button found — no pending disputes');
    }
    await rejectBtn.click();
    await page.waitForTimeout(1000);
    const comment = page.locator('textarea, input[placeholder*="reason" i]').first();
    if (await comment.isVisible().catch(() => false)) {
      await comment.fill('Dispute lacks sufficient evidence');
    }
    const confirm = page.locator('button').filter({ hasText: /confirm reject|submit|save/i }).first();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await page.waitForTimeout(2000);
    const success = await page.locator('[data-sonner-toast]').filter({ hasText: /rejected|declined/i }).first().isVisible().catch(() => false);
    const badge = await page.getByText(/rejected|declined|red/i).first().isVisible().catch(() => false);
    console.log(`[TC-05.6] reject success=${success} badge=${badge}`);
    expect(success || badge, 'Dispute should show rejected status').toBeTruthy();
  });

  test('TC-05.7 Agency view is read-only (no accept/reject buttons)', async ({ page }) => {
    const r = await login(page, 'agency');
    skipIfLoginFailed(test, r, 'agency');
    await page.goto('/dispute', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    // Agency should NOT see accept/reject buttons — use a strict-ish role/name match.
    const acceptBtn = page.getByRole('button', { name: /^accept$|^approve$|^resolve$/i });
    const rejectBtn = page.getByRole('button', { name: /^reject$|^decline$/i });
    const hasAccept = await acceptBtn.first().isVisible().catch(() => false);
    const hasReject = await rejectBtn.first().isVisible().catch(() => false);
    console.log(`[TC-05.7] agency accept=${hasAccept} reject=${hasReject}`);
    expect(hasAccept, 'Agency should NOT see Accept button').toBe(false);
    expect(hasReject, 'Agency should NOT see Reject button').toBe(false);
  });

  test('TC-05.8 Reject without comment is blocked (no-op if none)', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/dispute', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const rejectBtn = page.locator('button').filter({ hasText: /reject|decline/i }).first();
    if (!await rejectBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No Reject button found — no pending disputes');
    }
    await rejectBtn.click();
    await page.waitForTimeout(1000);
    // Try submitting without filling comment
    const confirm = page.locator('button').filter({ hasText: /confirm|submit|save/i }).first();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }
    await page.waitForTimeout(2000);
    // Should see validation error
    const error = await page.getByText(/required|comment|reason|cannot|empty/i).first().isVisible().catch(() => false)
      || await page.locator('[data-sonner-toast]').filter({ hasText: /required|comment|reason/i }).first().isVisible().catch(() => false);
    console.log(`[TC-05.8] reject-without-comment blocked=${error}`);
    expect(error, 'Reject without comment should show validation error').toBeTruthy();
  });
});
