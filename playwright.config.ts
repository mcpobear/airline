import { defineConfig } from '@playwright/test'

// Set E2E_CHROMIUM to use an existing Chromium binary instead of `npx playwright install`.
export default defineConfig({
  testDir: 'e2e',
  // The globe is rendered by software GL in CI, which runs at a few frames a
  // second. Actions wait for an element to hold still across frames, so the
  // default timeouts are far too tight there.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  webServer: { command: 'npm run build && npm run preview -- --port 4173', port: 4173, reuseExistingServer: true },
  use: {
    baseURL: 'http://localhost:4173',
    actionTimeout: 30_000,
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      executablePath: process.env.E2E_CHROMIUM || undefined,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
})
