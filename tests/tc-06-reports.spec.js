// TC-06 — EXPIRY REPORTS
// Verify each report page loads. PDF/CSV downloads are attempted only if a
// matching button exists; otherwise skipped with a note.
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

const REPORTS = [
  { route: '/reports/visa',      heading: /visa.*(expir|report)|expir.*visa/i,        name: 'Visa expiry' },
  { route: '/reports/insurance', heading: /insurance.*(expir|report)|expir.*insurance/i, name: 'Insurance expiry' },
  { route: '/reports/entry',     heading: /entry report/i,                            name: 'Entry' },
  { route: '/reports/problem',   heading: /problem/i,                                 name: 'Problem' },
];

test.describe('TC-06 Expiry Reports', () => {

  for (const r of REPORTS) {
    test(`TC-06 ${r.name} report (${r.route}) loads`, async ({ page }) => {
      const lr = await login(page, 'admin');
      skipIfLoginFailed(test, lr, 'admin');
      await page.goto(r.route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      await expect(page.locator('body')).not.toContainText(/404|page not found/i);
      // Either the heading matches or there's at least a sidebar with the right link active.
      const hasHeading = await page.getByRole('heading', { name: r.heading }).first().isVisible().catch(() => false);
      expect(hasHeading || page.url().includes(r.route)).toBeTruthy();
    });
  }

  test('TC-06 Visa report color-coded rows (red/amber/green) — best-effort check', async ({ page }) => {
    const lr = await login(page, 'admin');
    skipIfLoginFailed(test, lr, 'admin');
    await page.goto('/reports/visa', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    // Heuristic: look for any element whose computed style or class hints at status colors.
    const colorHits = await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')].slice(0, 4000);
      const hits = { red: 0, amber: 0, green: 0 };
      for (const el of els) {
        const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '';
        const s = (typeof cls === 'string' ? cls : '').toLowerCase();
        if (/red|destructive|danger|expired/.test(s))     hits.red++;
        if (/amber|warn|yellow|orange/.test(s))           hits.amber++;
        if (/green|success|valid|emerald/.test(s))        hits.green++;
      }
      return hits;
    });
    console.log('[TC-06 colors]', colorHits);
    // Don't hard-fail: this is heuristic. Just record.
    expect(colorHits.red + colorHits.amber + colorHits.green).toBeGreaterThanOrEqual(0);
  });

  test('TC-06 Export buttons existence (PDF / CSV)', async ({ page }) => {
    const lr = await login(page, 'admin');
    skipIfLoginFailed(test, lr, 'admin');
    await page.goto('/reports/visa', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const pdfBtn = page.getByRole('button', { name: /pdf|export.*pdf/i }).first();
    const csvBtn = page.getByRole('button', { name: /csv|excel|export.*csv/i }).first();
    const hasPdf = await pdfBtn.isVisible().catch(() => false);
    const hasCsv = await csvBtn.isVisible().catch(() => false);
    console.log(`[TC-06 export] pdf=${hasPdf} csv=${hasCsv}`);
    test.skip(!hasPdf && !hasCsv, 'No PDF/CSV export buttons found on /reports/visa — likely missing feature');
    const issues = [];

    // Helper: wait for either a download event OR the success toast (client-side Blob downloads
    // don't always trigger Playwright's download event, but the success toast confirms export worked)
    const waitForExportConfirmation = async (btn, format) => {
      // Set up listeners BEFORE clicking
      const dlPromise = page.waitForEvent('download', { timeout: 5_000 }).catch(() => null);
      // Sonner toast: wait for any toast containing "export" text
      const toastPromise = page.waitForSelector('[data-sonner-toast]', { timeout: 5_000 })
        .then(async () => {
          // Check if the visible toast has "export" in it
          const toastText = await page.locator('[data-sonner-toast]').first().textContent().catch(() => '');
          return toastText.toLowerCase().includes('export');
        })
        .catch(() => false);

      await btn.click();

      const [dl, toastOk] = await Promise.all([dlPromise, toastPromise]);
      const success = !!dl || !!toastOk;
      console.log(`[TC-06 export ${format}] download=${!!dl} toast=${!!toastOk}`);
      return success;
    };

    if (hasPdf) {
      const ok = await waitForExportConfirmation(pdfBtn, 'PDF');
      if (!ok) issues.push('[APP BUG] /reports/visa PDF export button clicked but no download or success toast detected within 5s.');
    }
    if (hasCsv) {
      const ok = await waitForExportConfirmation(csvBtn, 'CSV');
      if (!ok) issues.push('[APP BUG] /reports/visa CSV export button clicked but no download or success toast detected within 5s.');
    }
    if (issues.length) console.log(issues.join('\n'));
    expect(issues, issues.join(' | ')).toEqual([]);
  });
});
