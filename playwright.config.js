// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:2719',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        browserName: 'chromium',
        viewport: { width: 1400, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'uv run marimo run notebooks/bookshelf.py --headless --port 2719 --no-token',
    url: 'http://localhost:2719',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
