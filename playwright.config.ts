import { defineConfig } from '@playwright/test'

// Set E2E_CHROMIUM to use an existing Chromium binary instead of `npx playwright install`.
export default defineConfig({
  testDir: 'e2e',
  webServer: { command: 'npm run build && npm run preview -- --port 4173', port: 4173, reuseExistingServer: true },
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      executablePath: process.env.E2E_CHROMIUM || undefined,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
})
