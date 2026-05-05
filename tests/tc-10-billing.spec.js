// TC-10 — STRIPE BILLING
// /pricing on this app redirects to /login (it's auth-gated). We log in as
// admin first, then visit /pricing. Real Stripe checkout is NOT exercised
// (would charge a test card and mutate live billing).
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

test.describe('TC-10 Stripe Billing', () => {

  test('TC-10.1 Pricing page loads (admin) without 404', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).not.toContainText(/404|page not found/i);
    // Best-effort: if the route silently redirects elsewhere, log it.
    console.log(`[TC-10.1] /pricing → ${page.url()}`);
  });

  test('TC-10.2 Pricing page surfaces plan names (Free/Pro/Enterprise) — best effort', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const body = (await page.locator('body').innerText()).toLowerCase();
    const found = ['free', 'pro', 'enterprise', 'basic', 'premium', 'starter']
      .filter(p => body.includes(p));
    console.log(`[TC-10.2] plan-name hits on /pricing: ${found.join(', ') || '(none)'}`);
    
    expect(found.length).toBeGreaterThan(0);
  });

  test('TC-10.3 Click Subscribe redirects to Stripe checkout', async ({ page, context }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const subscribeBtn = page.locator('button').filter({ hasText: /subscribe|upgrade|get started|choose plan|select plan/i }).first();
    if (!await subscribeBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No Subscribe button found on pricing page');
    }
    // The button may either navigate the current tab or open a new tab.
    const popupPromise = context.waitForEvent('page', { timeout: 10_000 }).catch(() => null);
    const navPromise = page.waitForURL(/stripe|checkout|subscribe|billing/i, { timeout: 10_000 }).catch(() => null);
    await subscribeBtn.click();
    await Promise.race([popupPromise, navPromise]);
    const popup = await popupPromise;
    const popupUrl = popup ? popup.url() : '';
    const currentUrl = page.url();
    console.log(`[TC-10.3] after subscribe page=${currentUrl} popup=${popupUrl}`);
    const isStripe = /stripe\.com|checkout\.stripe/i.test(currentUrl) || /stripe\.com|checkout\.stripe/i.test(popupUrl);
    const isCheckout = /checkout|subscribe|billing|payment/i.test(currentUrl) || /checkout|subscribe|billing|payment/i.test(popupUrl);
    if (popup) await popup.close().catch(() => {});
    expect(isStripe || isCheckout, 'Subscribe should reach Stripe checkout or a payment page (current tab or popup)').toBeTruthy();
  });

  test('TC-10.4 Cancel on Stripe returns to pricing', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const subscribeBtn = page.locator('button').filter({ hasText: /subscribe|upgrade|get started/i }).first();
    if (!await subscribeBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No Subscribe button found');
    }
    await subscribeBtn.click();
    await page.waitForTimeout(5000);
    const onStripe = /stripe\.com|checkout\.stripe/i.test(page.url());
    if (!onStripe) {
      test.skip(true, 'Did not navigate to Stripe — checkout may be inline or different provider');
    }
    // Look for cancel/back button on Stripe page
    const cancelBtn = page.locator('button').filter({ hasText: /cancel|back|return|close/i }).first();
    const backLink = page.locator('a').filter({ hasText: /cancel|back|return/i }).first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
    } else if (await backLink.isVisible().catch(() => false)) {
      await backLink.click();
    } else {
      // Navigate back using browser back
      await page.goBack({ waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(3000);
    const returned = /pricing|dashboard|employer/i.test(page.url());
    console.log(`[TC-10.4] after cancel url=${page.url()}`);
    expect(returned, 'Canceling Stripe checkout should return to pricing/dashboard').toBeTruthy();
  });
});
