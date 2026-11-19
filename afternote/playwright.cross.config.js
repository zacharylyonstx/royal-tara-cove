import { defineConfig, devices } from '@playwright/test';

// The same browser tests on the other engines: WebKit (what an iPad and Safari run) and
// Firefox. Chromium stays in playwright.config.js, with the flags its GPU needs.
// Run with `npm run test:afternote:cross` (first time: `npx playwright install webkit firefox`).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240000,
  fullyParallel: true,
  // (each page is a WebGL scene: more than a few WebKit pages at once exhausts the machine, not the game)
  workers: 3,
  retries: 1, // (under load WebKit sometimes drops a page's graphics for a moment; a real failure fails twice)
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', viewport: { width: 1280, height: 720 } },
  projects: [
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    // an iPad held sideways and upright: WebKit, touch, no hover, a coarse pointer
    // (four lighthouse tests are about a keyboard's keycaps, which a touch device does not show)
    { name: 'ipad', use: { ...devices['iPad (gen 7) landscape'] }, grepInvert: /numbers are keys|label modes|remap:|home-row preset/ },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/afternote/',
    reuseExistingServer: true,
    timeout: 60000,
    cwd: '..',
  },
});
