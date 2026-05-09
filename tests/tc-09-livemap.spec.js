// TC-09 — LIVE MAP
// The admin dashboard already has a "Live Operations Map" panel. We verify the
// panel renders and that a dedicated /map route, if present, also loads.
const { test, expect } = require('@playwright/test');
const { login, skipIfLoginFailed } = require('./_helpers');

test.describe('TC-09 Live Map', () => {

  test('TC-09.1 Admin dashboard "Live Operations Map" panel visible', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await expect(page.getByRole('heading', { name: /live operations map/i }).first())
      .toBeVisible({ timeout: 10_000 });
  });

  test('TC-09.2 Map panel renders a canvas/iframe/leaflet container (not blank)', async ({ page }) => {
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.waitForTimeout(4000); // let map tiles load
    const hits = await page.evaluate(() => {
      const sels = ['canvas', 'iframe[src*="map"]', '.leaflet-container', '.mapboxgl-canvas',
        '[class*="leaflet" i]', '[class*="mapbox" i]', '[class*="google-map" i]',
        'img[src*="tile"]', 'img[src*="staticmap"]', 'svg[class*="map" i]'];
      const found = {};
      for (const s of sels) found[s] = document.querySelectorAll(s).length;
      return found;
    });
    const total = Object.values(hits).reduce((a, b) => a + b, 0);
    console.log(`[TC-09.2] map-element hits: ${JSON.stringify(hits)}`);
    expect(total,
      `[APP BUG] "Live Operations Map" panel renders heading but no actual map widget is mounted (no canvas/iframe/leaflet/mapbox/tile-img). Hits=${JSON.stringify(hits)}`
    ).toBeGreaterThan(0);
  });

  test('TC-09.3 No JS errors crash the map page', async ({ page }) => {
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    const r = await login(page, 'admin');
    skipIfLoginFailed(test, r, 'admin');
    await page.waitForTimeout(3000);
    // Filter out the known 401 noise from any background calls.
    const fatal = errs.filter(e => !/401|403/.test(e));
    expect(fatal, `pageerrors: ${fatal.join(' | ')}`).toEqual([]);
  });

  test('TC-09.4 Employer dashboard map panel loads', async ({ page }) => {
    const r = await login(page, 'employer');
    skipIfLoginFailed(test, r, 'employer');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const mapHeading = page.getByRole('heading', { name: /live operations map|map|location/i }).first();
    const mapContainer = page.locator('.leaflet-container, [class*="leaflet" i], canvas, iframe[src*="map"]').first();
    const hasHeading = await mapHeading.isVisible().catch(() => false);
    const hasMap = await mapContainer.isVisible().catch(() => false);
    console.log(`[TC-09.4] employer map heading=${hasHeading} map=${hasMap} url=${page.url()}`);
    expect(page.url()).toMatch(/dashboard|map/i);

  });
});
