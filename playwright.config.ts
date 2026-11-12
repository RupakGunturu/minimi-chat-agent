import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /e2e\.spec\.ts/,
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  webServer: {
    command: 'node --import tsx tests/e2e-server.ts',
    url: 'http://127.0.0.1:3100/api/status',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
