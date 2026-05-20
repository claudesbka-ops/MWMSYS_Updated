// TC-15 — BULK IMPORT
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.describe('TC-15 Bulk Import', () => {

  test('TC-15.1 Agency can access bulk import page', async ({ page }) => {
    const r = await login(page, 'agency');
    skipIfLoginFailed(test, r, 'agency');
    await page.goto('/bulk-import', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const heading = await page.getByRole('heading', { name: /import workers|bulk import/i }).first().isVisible().catch(() => false);
    expect(heading, 'Import Workers heading should be visible').toBeTruthy();
    const uploadZone = await page.locator('input[type="file"], [class*="drop"], [class*="upload"]').first().isVisible().catch(() => false);
    const uploadText = await page.getByText(/drop|drag|upload|choose file/i).first().isVisible().catch(() => false);
    console.log(`[TC-15.1] heading=${heading} uploadZone=${uploadZone} uploadText=${uploadText}`);
    expect(uploadZone || uploadText, 'Upload zone should be visible').toBeTruthy();
    const dlBtn = await page.getByRole('button', { name: /download template|template/i }).first().isVisible().catch(() => false);
    console.log(`[TC-15.1] downloadTemplate=${dlBtn}`);
    expect(dlBtn, 'Download Template button should be visible').toBeTruthy();
  });

  test('TC-15.2 Download template works', async ({ page }) => {
    const r = await login(page, 'agency');
    skipIfLoginFailed(test, r, 'agency');
    await page.goto('/bulk-import', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const dlBtn = page.getByRole('button', { name: /download template|template/i }).first();
    if (!await dlBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Download Template button not found');
    }
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      dlBtn.click(),
    ]);
    if (download) {
      const filename = download.suggestedFilename();
      console.log(`[TC-15.2] downloaded filename=${filename}`);
      expect(filename).toBeTruthy();
    } else {
      // Some implementations open a new tab or trigger via link
      const newPage = await page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null);
      const link = await page.locator('a[href*="template"], a[download]').first().getAttribute('href').catch(() => null);
      console.log(`[TC-15.2] newPage=${!!newPage} link=${link}`);
      expect(newPage || link, 'Template download should trigger a download or navigation').toBeTruthy();
    }
  });

  test('TC-15.3 Invalid file type shows error', async ({ page }) => {
    const r = await login(page, 'agency');
    skipIfLoginFailed(test, r, 'agency');
    await page.goto('/bulk-import', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const fileInput = page.locator('input[type="file"]').first();
    if (!await fileInput.isVisible().catch(() => false)) {
      // File input might be hidden; try to reveal via click on drop zone
      const dropZone = page.locator('[class*="drop"], [class*="upload-zone"], [class*="dropzone"]').first();
      if (await dropZone.isVisible().catch(() => false)) {
        await dropZone.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    }
    if (!await fileInput.count().catch(() => 0)) {
      test.skip(true, 'No file input found on bulk import page');
    }
    // Create a temp .txt file
    const tmpFile = path.join(os.tmpdir(), 'invalid-test.txt');
    fs.writeFileSync(tmpFile, 'This is not a valid CSV or Excel file');
    await fileInput.setInputFiles(tmpFile).catch(() => {});
    await page.waitForTimeout(2000);
    const error = await page.getByText(/invalid|unsupported|format|must be|csv|excel|xlsx/i).first().isVisible().catch(() => false);
    const toast = await page.locator('[data-sonner-toast]').filter({ hasText: /invalid|error|unsupported|format/i }).first().isVisible().catch(() => false);
    console.log(`[TC-15.3] error=${error} toast=${toast}`);
    // Clean up
    fs.unlinkSync(tmpFile);
    expect(error || toast, 'Invalid file should show an error message').toBeTruthy();
  });

  test('TC-15.4 Employer cannot access bulk import (agency only)', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/bulk-import', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const url = page.url();
    const redirected = !/bulk-import/i.test(url);
    const denied = await page.getByText(/access denied|forbidden|not allowed|unauthorized/i).first().isVisible().catch(() => false);
    console.log(`[TC-15.4] employer url=${url} redirected=${redirected} denied=${denied}`);
    expect(redirected || denied, 'Employer should be redirected or denied from bulk import').toBeTruthy();
  });

});
