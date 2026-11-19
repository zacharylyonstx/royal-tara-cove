import { defineConfig, devices } from '@playwright/test';

// The same browser tests on the other engines: WebKit (what an iPad and Safari run) and
// Firefox. Chromium stays in playwright.config.js, with the flags its GPU needs.
// Run with `npm run test:afternote:cross` (first time: `npx playwright install webkit firefox`).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', viewport: { width: 1280, height: 720 } },
  projects: [
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    // an iPad held sideways and upright: WebKit, touch, no hover, a coarse pointer
    { name: 'ipad', use: { ...devices['iPad (gen 7) landscape'] } },
    { name: 'ipad-upright', use: { ...devices['iPad (gen 7)'] }, grep: /@touch/ },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/afternote/',
    reuseExistingServer: true,
    timeout: 60000,
    cwd: '..',
  },
});
