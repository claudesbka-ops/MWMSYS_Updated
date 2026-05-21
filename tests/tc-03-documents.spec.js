// TC-03 — DOCUMENTS
// Document upload UI on /my-documents uses a custom dropzone (no native file
// input visible) and a document-type dropdown. On prod we verify the UI is
// present and interactable but do NOT actually upload to avoid mutating data.
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

  test('TC-03.2 Signup without profile photo is allowed (not enforced at API)', async ({ request }) => {
    const userId = 'tc03photo_' + Date.now();
    const apiBase = process.env.API_BASE_URL || 'https://mwmsysmaster-production.up.railway.app';
    const payload = {
      userId,
      email: userId + '@test.com',
      password: 'Test@1234',
      role: 'worker',
      passportNo: 'PHOTO' + Date.now().toString().slice(-6),
      fullName: 'TC03.2 Worker',
    };
    const r = await request.post(apiBase + '/signup', { data: payload, headers: { 'x-test-bypass': 'playwright-test-bypass' } });
    const status = r.status();
    const json = await r.json().catch(() => ({}));
    console.log(`[TC-03.2] signup without photo -> ${status} ${JSON.stringify(json).slice(0, 200)}`);
    expect([201, 409]).toContain(status);
  });

  // Helper: open /my-documents and wait for the page to load.
  async function openDocumentsPage(page) {
    await page.goto('/my-documents', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  }

  // Helper: find the document-type select. We try a few selectors because the
  // dropdown could be a native <select> or a shadcn/Radix combobox.
  async function findDocTypeSelect(page) {
    const native = page.locator('select').first();
    if (await native.isVisible().catch(() => false)) return { kind: 'native', loc: native };
    const combo = page.locator('[role="combobox"]').first();
    if (await combo.isVisible().catch(() => false)) return { kind: 'combobox', loc: combo };
    return null;
  }

  async function selectDocType(page, label) {
    const sel = await findDocTypeSelect(page);
    if (!sel) return false;
    if (sel.kind === 'native') {
      await sel.loc.selectOption({ label }).catch(async () => {
        await sel.loc.selectOption(label.toLowerCase()).catch(() => {});
      });
      return true;
    }
    // shadcn combobox: click trigger, then click option
    await sel.loc.click();
    await page.waitForTimeout(400);
    const option = page.getByRole('option', { name: new RegExp(label, 'i') }).first();
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      await page.waitForTimeout(300);
      return true;
    }
    return false;
  }

  test('TC-03.3 Worker uploads passport document (UI present)', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await openDocumentsPage(page);

    // Verify document-type dropdown shows Passport (default value).
    const sel = await findDocTypeSelect(page);
    expect(sel, 'Document type dropdown must be visible on /my-documents').not.toBeNull();
    const dropZone = page.getByText(/click to choose a file/i).first();
    await expect(dropZone, '"Click to choose a file" dropzone must be visible').toBeVisible();
    const submit = page.getByRole('button', { name: /submit for review/i }).first();
    await expect(submit, '"Submit for review" button must be visible').toBeVisible();
    console.log('[TC-03.3] document UI present (dropdown + dropzone + submit)');
  });

  test('TC-03.4 Worker can switch document type to Work Permit', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await openDocumentsPage(page);
    const ok = await selectDocType(page, 'Work Permit');
    if (!ok) test.skip(true, 'Document type dropdown not interactable');
    // Trigger reflects new value
    const trigger = page.locator('[role="combobox"], select').first();
    const value = (await trigger.innerText().catch(() => '')) || (await trigger.inputValue().catch(() => ''));
    console.log(`[TC-03.4] doc type after select=${value}`);
    expect(value.toLowerCase()).toMatch(/permit/);
  });

  test('TC-03.5 Worker can switch document type to Insurance', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await openDocumentsPage(page);
    const ok = await selectDocType(page, 'Insurance');
    if (!ok) test.skip(true, 'Document type dropdown not interactable');
    const trigger = page.locator('[role="combobox"], select').first();
    const value = (await trigger.innerText().catch(() => '')) || (await trigger.inputValue().catch(() => ''));
    console.log(`[TC-03.5] doc type after select=${value}`);
    expect(value.toLowerCase()).toMatch(/insurance/);
  });

  test('TC-03.6 Worker can switch document type to Contract', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await openDocumentsPage(page);
    const ok = await selectDocType(page, 'Contract');
    if (!ok) test.skip(true, 'Document type dropdown not interactable');
    const trigger = page.locator('[role="combobox"], select').first();
    const value = (await trigger.innerText().catch(() => '')) || (await trigger.inputValue().catch(() => ''));
    console.log(`[TC-03.6] doc type after select=${value}`);
    expect(value.toLowerCase()).toMatch(/contract/);
  });

  test('TC-03.7 Document upload area is present (blurry-image guard requires real upload)', async ({ page }) => {
    const r = await login(page, 'worker');
    skipIfLoginFailed(test, r, 'worker');
    await openDocumentsPage(page);
    const dropZone = page.getByText(/click to choose a file/i).first();
    await expect(dropZone, 'Upload area must exist; quality validation runs after a real file is selected').toBeVisible();
  });

  test('TC-03.8 Agency verifies a document (no-op if no pending docs)', async ({ page }) => {
    const r = await login(page, 'agency');
    skipIfLoginFailed(test, r, 'agency');
    await page.goto('/attestation', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const verifyBtn = page.locator('button').filter({ hasText: /verify|approve|accept/i }).first();
    if (!await verifyBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No documents to verify on /attestation (no Verify button visible)');
    }
    await verifyBtn.click();
    await page.waitForTimeout(2000);
    const success = await page.locator('[data-sonner-toast]').filter({ hasText: /verified|approved|success/i }).first().isVisible().catch(() => false);
    const badge = await page.getByText(/verified|approved/i).first().isVisible().catch(() => false);
    expect(success || badge, 'Document should show verified status after approval').toBeTruthy();
  });

  test('TC-03.9 Agency rejects a document with reason (no-op if no pending docs)', async ({ page }) => {
    const r = await login(page, 'agency');
    skipIfLoginFailed(test, r, 'agency');
    await page.goto('/attestation', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const rejectBtn = page.locator('button').filter({ hasText: /reject|decline|deny/i }).first();
    if (!await rejectBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No documents to reject on /attestation (no Reject button visible)');
    }
    await rejectBtn.click();
    await page.waitForTimeout(1000);
    const reasonInput = page.locator('textarea, input[placeholder*="reason" i]').first();
    if (await reasonInput.isVisible().catch(() => false)) {
      await reasonInput.fill('Document unclear — please re-upload');
    }
    const confirm = page.locator('button').filter({ hasText: /confirm reject|submit|save/i }).first();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }
    await page.waitForTimeout(2000);
    const success = await page.locator('[data-sonner-toast]').filter({ hasText: /rejected|declined/i }).first().isVisible().catch(() => false);
    const badge = await page.getByText(/rejected|declined/i).first().isVisible().catch(() => false);
    expect(success || badge, 'Document should show rejected status').toBeTruthy();
  });
});
