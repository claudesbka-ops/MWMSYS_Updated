// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Staging config for destructive / state-mutating tests.
 *
 * Prerequisites (MANUAL STEPS — AI cannot create cloud services):
 * 1. Railway: duplicate "mwmsysmaster-production" → name "mwmsys-staging"
 *    - Use a NEW/EMPTY database (not prod DB clone)
 *    - Add env var: NODE_ENV=staging
 *    - Add env var: ALLOW_TEST_ACCOUNTS=true
 *    - Deploy → note URL (e.g. https://mwmsys-staging.up.railway.app)
 * 2. Vercel: new project from same GitHub repo, branch "main"
 *    - Add env var: VITE_API_BASE_URL=https://mwmsys-staging.up.railway.app
 *    - Name: mwmsys-staging
 *    - Deploy → note URL (e.g. https://mwmsys-staging.vercel.app)
 * 3. Seed staging DB:
 *      API_BASE_URL=https://mwmsys-staging.up.railway.app node scripts/seed-test-accounts.js
 * 4. Run tests:
 *      npx playwright test --config=playwright.staging.config.js
 */

const STAGING_FRONTEND = process.env.STAGING_FRONTEND_URL
  || 'https://mwmsys-staging.vercel.app';

module.exports = defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./tests/global-setup.js'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,                 // Staging can be flakier than prod
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: STAGING_FRONTEND,
    headless: true,           // Run headless in CI/staging
    viewport: { width: 1366, height: 800 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
