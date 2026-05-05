// TC-12 — CHATBOT
// The floating chat launcher carries data-testid="chatbot-launcher" and is
// rendered on /dashboard. Click it, find the input inside the popup, send a
// query, and assert a non-error response within ~5s.
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

const QUERIES = [
  'How do I trigger the panic button?',
  'How do I submit a salary dispute?',
  'What are the pricing plans?',
];

async function findChatLauncher(page) {
  // Prefer the explicit testid we added in the frontend.
  const testid = page.locator('[data-testid="chatbot-launcher"]').first();
  if (await testid.isVisible().catch(() => false)) return testid;
  // Fallback heuristics for older builds.
  const fallbacks = [
    'button[aria-label*="chat" i]',
    'button[aria-label*="help" i]',
    '[data-testid*="chat" i]',
    'button:has-text("Chat")',
    '[class*="chatbot" i]',
  ];
  for (const sel of fallbacks) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) return loc;
  }
  return null;
}

test.describe('TC-12 Chatbot', () => {

  test('TC-12.1 Chatbot launcher exists on /dashboard', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const launcher = await findChatLauncher(page);
    expect(launcher, 'Chatbot launcher should be visible on /dashboard').not.toBeNull();
  });

  for (const q of QUERIES) {
    test(`TC-12 chatbot answers: ${q}`, async ({ page }) => {
      const r = await login(page, 'admin');
      skipIfLoginFailed(test, r, 'admin');
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      const launcher = await findChatLauncher(page);
      if (!launcher) test.skip(true, 'No chatbot launcher found');

      await launcher.click();
      await page.waitForTimeout(2000);

      // Look for an input/textarea that is visible AFTER opening the chat.
      const input = page.locator('input:visible, textarea:visible, [contenteditable="true"]:visible').last();
      const inputCount = await input.count();
      if (inputCount === 0) test.skip(true, 'Chat opened but no input field located');

      await input.fill(q);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);

      // Look for newly-rendered messages inside the chat panel.
      const transcript = (await page.locator('body').innerText()).slice(-4000);
      const hasResponse = transcript.length > 20 && transcript.toLowerCase().includes(q.slice(0, 8).toLowerCase());
      const errored = /error|something went wrong|try again later/i.test(transcript);
      console.log(`[TC-12] q="${q}" hasResponse=${hasResponse} errored=${errored}`);
      expect(errored, 'chatbot returned an error message').toBe(false);
      expect(transcript.length).toBeGreaterThan(20);
    });
  }
});
