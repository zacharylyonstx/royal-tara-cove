import { defineConfig } from '@playwright/test';

// Afternote's browser tests, driven through its own hooks (?test=1, render_game_to_text,
// advanceTime, __afternote.bot). Run with `npm run test:afternote:e2e`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/afternote/',
    reuseExistingServer: true,
    timeout: 60000,
    cwd: '..',
  },
});
