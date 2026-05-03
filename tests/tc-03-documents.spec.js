// TC-03 — DOCUMENTS
// All document upload flows are SKIPPED (destructive on prod, plus AI
// extraction requires real files & async processing). We do verify that the
// admin can reach the Attestation page where documents are reviewed.
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

test.describe('TC-03 Documents', () => {

  test('TC-03.1 Admin can open Attestation review page', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.goto('/attestation', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: /attestation/i }).first()).toBeVisible();
  });

  test.skip('TC-03.2 Profile photo required at signup — SKIPPED (signup OTP needed)', () => {});
  test.skip('TC-03.3 Upload passport → AI extracts name/passport/expiry — SKIPPED (destructive + AI async)', () => {});
  test.skip('TC-03.4 Upload work permit → extracts permit#/expiry — SKIPPED', () => {});
  test.skip('TC-03.5 Upload insurance → extracts policy#/expiry — SKIPPED', () => {});
  test.skip('TC-03.6 Upload contract → extracts end-date — SKIPPED', () => {});
  test.skip('TC-03.7 Upload blurry image → warning — SKIPPED', () => {});
  test.skip('TC-03.8 Agency Verify badge — SKIPPED (no agency login + destructive)', () => {});
  test.skip('TC-03.9 Agency Reject + reason — SKIPPED (destructive)', () => {});
});
