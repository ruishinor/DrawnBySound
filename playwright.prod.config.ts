import { defineConfig } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: 'tests/e2e-prod',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    viewport: { width: 390, height: 844 },
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
