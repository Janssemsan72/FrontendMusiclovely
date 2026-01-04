import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://127.0.0.1:8089',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'tests/fixtures/auth.json' },
    },

    {
      name: 'firefox',
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'], storageState: 'tests/fixtures/auth.json' },
    },

    {
      name: 'webkit',
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'], storageState: 'tests/fixtures/auth.json' },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      dependencies: ['setup'],
      use: { ...devices['Pixel 5'], storageState: 'tests/fixtures/auth.json' },
    },
    {
      name: 'Mobile Safari',
      dependencies: ['setup'],
      use: { ...devices['iPhone 12'], storageState: 'tests/fixtures/auth.json' },
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      dependencies: ['setup'],
      use: { ...devices['Desktop Edge'], channel: 'msedge', storageState: 'tests/fixtures/auth.json' },
    },
    {
      name: 'Google Chrome',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], channel: 'chrome', storageState: 'tests/fixtures/auth.json' },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 8089 --strictPort',
    url: 'http://127.0.0.1:8089',
    reuseExistingServer: false,
    env: {
      VITE_E2E: 'true',
    },
    timeout: 120 * 1000,
  },
});
