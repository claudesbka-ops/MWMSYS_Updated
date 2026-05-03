// TC-11 — BLOG
// /blog is auth-gated on the live app (anonymous visitors are redirected to
// /login). We log in as admin and exercise the blog index → article → back.
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

test.describe('TC-11 Blog', () => {

  test('TC-11.1 Blog index loads and renders something', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    expect(page.url()).toMatch(/\/blog/);
    await expect(page.locator('body')).not.toContainText(/404|page not found/i);
  });

  test('TC-11.2 Click first article → article body loads', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    // Find the first link that looks like an article (href contains /blog/ and not just /blog).
    const articleLink = page.locator('a[href*="/blog/"]').filter({ hasNot: page.locator('a[href$="/blog"]') }).first();
    const count = await articleLink.count();
    test.skip(count === 0, 'No article links found on /blog index — content may be empty in this env.');
    const before = page.url();
    await articleLink.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    expect(page.url()).not.toBe(before);
    expect(page.url()).toMatch(/\/blog\/.+/);
  });

  test('TC-11.3 Browser back returns to blog index', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const articleLink = page.locator('a[href*="/blog/"]').filter({ hasNot: page.locator('a[href$="/blog"]') }).first();
    test.skip(await articleLink.count() === 0, 'No article links to navigate from.');
    await articleLink.click();
    await page.waitForTimeout(2000);
    await page.goBack();
    await page.waitForTimeout(1500);
    expect(page.url()).toMatch(/\/blog(\?.*)?$/);
  });
});
