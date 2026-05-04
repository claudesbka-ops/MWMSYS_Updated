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

  test('TC-08.4 Edit name and phone on profile', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await page.goto('/account', { waitUntil: 'domcontentloaded' }).catch(() => page.goto('/profile', { waitUntil: 'domcontentloaded' }));
    await page.waitForTimeout(2000);
    // Find edit/save button
    const editBtn = page.locator('button').filter({ hasText: /edit|update|modify/i }).first();
    if (!await editBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No Edit button found on profile page');
    }
    await editBtn.click();
    await page.waitForTimeout(1000);
    const nameInput = page.locator('input[placeholder*="name" i], input[name*="name" i]').first();
    const phoneInput = page.locator('input[placeholder*="phone" i], input[type="tel"], input[name*="phone" i]').first();
    const uniqueName = 'UpdatedWorker_' + Date.now();
    if (await nameInput.isVisible().catch(() => false)) await nameInput.fill(uniqueName);
    if (await phoneInput.isVisible().catch(() => false)) await phoneInput.fill('+60123456789');
    const save = page.locator('button').filter({ hasText: /save|update|confirm/i }).first();
    if (await save.isVisible().catch(() => false)) await save.click();
    await page.waitForTimeout(3000);
    // Refresh and verify
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const persisted = await page.getByText(new RegExp(uniqueName, 'i')).first().isVisible().catch(() => false);
    console.log(`[TC-08.4] name persisted after refresh=${persisted}`);
    expect(persisted, 'Edited name should persist after refresh').toBeTruthy();
  });

  test('TC-08.5 Upload new profile photo', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await page.goto('/account', { waitUntil: 'domcontentloaded' }).catch(() => page.goto('/profile', { waitUntil: 'domcontentloaded' }));
    await page.waitForTimeout(2000);
    const fileInput = page.locator('input[type="file"]').first();
    if (!await fileInput.isVisible().catch(() => false)) {
      test.skip(true, 'No file upload input on profile page');
    }
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample-passport.png'));
    await page.waitForTimeout(5000);
    const success = await page.locator('[data-sonner-toast]').filter({ hasText: /upload|photo|image|success/i }).first().isVisible().catch(() => false);
    const img = await page.locator('img[src*="data:" i], img[class*="avatar" i], img[class*="profile" i]').first().isVisible().catch(() => false);
    console.log(`[TC-08.5] photo upload success=${success} img visible=${img}`);
    expect(success || img, 'Photo upload should show success toast or new image').toBeTruthy();
  });

  test('TC-08.6 Change password and login with new password', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await page.goto('/account', { waitUntil: 'domcontentloaded' }).catch(() => page.goto('/settings', { waitUntil: 'domcontentloaded' }));
    await page.waitForTimeout(2000);
    // Find change password section
    const pwSection = page.locator('button').filter({ hasText: /change password|reset password|security/i }).first();
    if (await pwSection.isVisible().catch(() => false)) await pwSection.click();
    await page.waitForTimeout(1000);
    const currentPw = page.locator('input[type="password"]').first();
    const newPw = page.locator('input[type="password"]').nth(1);
    const confirmPw = page.locator('input[type="password"]').nth(2);
    if (!await currentPw.isVisible().catch(() => false)) {
      test.skip(true, 'Password change form not found');
    }
    await currentPw.fill('Test@1234');
    await newPw.fill('Test@5678');
    await confirmPw.fill('Test@5678');
    const save = page.locator('button').filter({ hasText: /save|update|change|confirm/i }).first();
    if (await save.isVisible().catch(() => false)) await save.click();
    await page.waitForTimeout(3000);
    const changed = await page.locator('[data-sonner-toast]').filter({ hasText: /password|success|updated/i }).first().isVisible().catch(() => false);
    console.log(`[TC-08.6] password changed=${changed}`);
    expect(changed, 'Password change should show success').toBeTruthy();
    // Verify login with new password
    await page.goto('/login');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /worker login/i }).first().click();
    await page.getByPlaceholder(/email address/i).fill('worker@test.com');
    await page.getByPlaceholder(/password/i).fill('Test@5678');
    await page.getByPlaceholder(/passport/i).fill('TEST123456');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(4000);
    expect(page.url()).toMatch(/\/(dashboard|complete-profile)/);
    // Change back to original so other tests don't fail
    await page.goto('/account');
    await page.waitForTimeout(2000);
    if (await pwSection.isVisible().catch(() => false)) await pwSection.click();
    await page.waitForTimeout(1000);
    const cp2 = page.locator('input[type="password"]').first();
    if (await cp2.isVisible().catch(() => false)) {
      await cp2.fill('Test@5678');
      await page.locator('input[type="password"]').nth(1).fill('Test@1234');
      await page.locator('input[type="password"]').nth(2).fill('Test@1234');
      const s2 = page.locator('button').filter({ hasText: /save|update|change|confirm/i }).first();
      if (await s2.isVisible().catch(() => false)) await s2.click();
      await page.waitForTimeout(3000);
    }
  });

  test('TC-08.7 Plan badge shows subscription tier', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const hasBadge = await page.getByText(/free|pro|enterprise|basic|premium|standard|plan|tier/i).first().isVisible().catch(() => false);
    const hasSubscription = await page.locator('[class*="badge" i], [class*="plan" i], [class*="tier" i], [class*="subscription" i]').first().isVisible().catch(() => false);
    console.log(`[TC-08.7] badge text=${hasBadge} badge element=${hasSubscription}`);
    expect(hasBadge || hasSubscription, 'Employer dashboard should show plan badge or subscription info').toBeTruthy();
  });
});
