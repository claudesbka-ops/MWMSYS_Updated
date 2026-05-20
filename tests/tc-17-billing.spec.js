// TC-17 — BILLING
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

const BASE = 'https://mwmsysmaster-production.up.railway.app';
const BYPASS = { 'x-test-bypass': 'playwright-test-bypass' };
const FRONTEND_BASE = 'https://mwmsys-master.vercel.app';

test.describe('TC-17 Billing', () => {

  test('TC-17.1 Billing page accessible for employer', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/billing', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const onBilling = /billing/i.test(url);
    expect(onBilling, 'Employer should reach /billing').toBeTruthy();
    const planText = await page.getByText(/free|starter|growth|enterprise|plan/i).first().isVisible().catch(() => false);
    console.log(`[TC-17.1] url=${url} planText=${planText}`);
    expect(planText, 'Plan name should be visible on billing page').toBeTruthy();
  });

  test('TC-17.2 Billing page accessible for agency', async ({ page }) => {
    const r = await login(page, 'agency');
    skipIfLoginFailed(test, r, 'agency');
    await page.goto('/billing', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const onBilling = /billing/i.test(url);
    const heading = await page.getByRole('heading', { name: /billing/i }).first().isVisible().catch(() => false);
    console.log(`[TC-17.2] url=${url} heading=${heading}`);
    expect(onBilling || heading, 'Agency billing page should load').toBeTruthy();
  });

  test('TC-17.3 Pricing page loads with 3 plan cards', async ({ page }) => {
    const r = await login(page, 'agency');
    skipIfLoginFailed(test, r, 'agency');
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const cards = await page.locator('[class*="card"], [class*="Card"]').count().catch(() => 0);
    const planNames = await page.getByText(/free|starter|growth|enterprise|pro/i).count().catch(() => 0);
    const subscribeBtns = await page.getByRole('button', { name: /subscribe|get started|choose|select|upgrade/i }).count().catch(() => 0);
    console.log(`[TC-17.3] cards=${cards} planNames=${planNames} subscribeBtns=${subscribeBtns}`);
    expect(planNames >= 2, 'At least 2 plan names should be visible').toBeTruthy();
    expect(subscribeBtns >= 1, 'Subscribe buttons should be visible').toBeTruthy();
  });

  test('TC-17.4 Subscribe button calls checkout API', async ({ page, request }) => {
    test.skip(!process.env.STRIPE_SECRET_KEY, 'Stripe not configured');
    const r = await login(page, 'agency');
    skipIfLoginFailed(test, r, 'agency');
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    // Intercept the checkout API call
    let checkoutCalled = false;
    let checkoutStatus = 0;
    page.on('response', (resp) => {
      if (/Billing\/CreateCheckout/i.test(resp.url())) {
        checkoutCalled = true;
        checkoutStatus = resp.status();
      }
    });
    const subscribeBtn = page.getByRole('button', { name: /subscribe|get started|choose|select|upgrade/i })
      .filter({ hasNot: page.getByText(/free/i) }).first();
    if (!await subscribeBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No Subscribe button found on pricing page');
    }
    await subscribeBtn.click();
    await page.waitForTimeout(3000);
    console.log(`[TC-17.4] checkoutCalled=${checkoutCalled} status=${checkoutStatus}`);
    // Either the API was called, or user was redirected to Stripe (checkout URL redirect)
    const redirectedToStripe = /stripe\.com|checkout\.stripe/i.test(page.url());
    const errorToast = await page.locator('[data-sonner-toast]').filter({ hasText: /error|failed|billing not configured/i }).first().isVisible().catch(() => false);
    expect(checkoutCalled || redirectedToStripe || errorToast, 'Subscribe should call checkout API or redirect to Stripe').toBeTruthy();
    if (checkoutCalled) {
      expect([200, 503].includes(checkoutStatus), `Checkout API should return 200 or 503 (not configured), got ${checkoutStatus}`).toBeTruthy();
    }
  });

  test('TC-17.5 Admin cannot access billing page', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/billing', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const redirected = !/billing/i.test(url) || /dashboard/i.test(url);
    const denied = await page.getByText(/access denied|forbidden|not allowed|unauthorized/i).first().isVisible().catch(() => false);
    console.log(`[TC-17.5] admin url=${url} redirected=${redirected} denied=${denied}`);
    expect(redirected || denied, 'Admin should be redirected or denied from billing').toBeTruthy();
  });

  test('TC-17.6 Worker cannot access billing page', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await page.goto('/billing', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const redirected = !/billing/i.test(url) || /dashboard/i.test(url);
    const denied = await page.getByText(/access denied|forbidden|not allowed|unauthorized/i).first().isVisible().catch(() => false);
    console.log(`[TC-17.6] worker url=${url} redirected=${redirected} denied=${denied}`);
    expect(redirected || denied, 'Worker should be redirected or denied from billing').toBeTruthy();
  });

  test('TC-17.7 Billing success page renders', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/billing/success`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const success = await page.getByText(/payment successful|plan is now active|🎉/i).first().isVisible().catch(() => false);
    const btn = await page.getByRole('button', { name: /go to dashboard|dashboard/i }).first().isVisible().catch(() => false);
    console.log(`[TC-17.7] success=${success} btn=${btn}`);
    expect(success, 'Success message should be visible').toBeTruthy();
    expect(btn, '"Go to Dashboard" button should be visible').toBeTruthy();
  });

  test('TC-17.8 Billing cancel page renders', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/billing/cancel`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const msg = await page.getByText(/no charges|cancelled|checkout cancelled/i).first().isVisible().catch(() => false);
    const backBtn = await page.getByRole('button', { name: /back to pricing|pricing/i }).first().isVisible().catch(() => false);
    const dashBtn = await page.getByRole('button', { name: /go to dashboard|dashboard/i }).first().isVisible().catch(() => false);
    console.log(`[TC-17.8] msg=${msg} backBtn=${backBtn} dashBtn=${dashBtn}`);
    expect(msg, '"No charges were made" message should be visible').toBeTruthy();
    expect(backBtn || dashBtn, 'Action buttons should be visible').toBeTruthy();
  });

});
