import { defineConfig, devices } from '@playwright/test';

/**
 * Proyectos:
 *  - e2e: herméticos (API simulada con page.route). Corren en CI.
 *  - rendimiento: contra el BUILD DE PRODUCCIÓN servido como nginx (gzip + fallback SPA).
 *  - Los tests @backend (e2e/pago.spec.ts) pegan contra ms-pagos real: solo con E2E_BACKEND=1.
 *
 * Variables: E2E_BASE_URL (usa un servidor ya levantado), PW_CHANNEL (p. ej. msedge en local),
 * E2E_BACKEND=1 (incluye @backend), CI (forbidOnly, reintentos, sin reutilizar servidores).
 */
const CI = !!process.env['CI'];
const DEV_PORT = 4201; // 4200 suele estar ocupado por el contenedor app-frontend del backend
const PERF_PORT = 4300;
const baseURL = process.env['E2E_BASE_URL'] ?? `http://localhost:${DEV_PORT}`;
const navegador = {
  ...devices['Desktop Chrome'],
  ...(process.env['PW_CHANNEL'] ? { channel: process.env['PW_CHANNEL'] } : {}),
};

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  // @backend solo si se pide explícitamente (E2E_BACKEND=1 o --grep @backend).
  grepInvert:
    process.env['E2E_BACKEND'] || process.argv.some((a) => a.includes('@backend'))
      ? undefined
      : /@backend/,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'e2e', testIgnore: /rendimiento\.spec\.ts/, use: navegador },
    {
      name: 'rendimiento',
      testMatch: /rendimiento\.spec\.ts/,
      use: { ...navegador, baseURL: `http://localhost:${PERF_PORT}` },
    },
  ],
  webServer: [
    ...(process.env['E2E_BASE_URL']
      ? []
      : [
          {
            command: `pnpm start:local --port ${DEV_PORT}`,
            url: `http://localhost:${DEV_PORT}`,
            reuseExistingServer: !CI,
            timeout: 180000,
          },
        ]),
    {
      // Build de producción servido con compresión y fallback SPA, como nginx.conf.
      command: `pnpm run build && node scripts/serve-dist.mjs ${PERF_PORT}`,
      url: `http://localhost:${PERF_PORT}/health`,
      reuseExistingServer: !CI,
      timeout: 300000,
    },
  ],
});
