import { test as base, expect, Page, Route } from '@playwright/test';

/**
 * Fixture común de los e2e herméticos.
 *
 * Cada test falla si:
 *  - la app llama a un endpoint /api/v1/* que el test no simuló (evita tests que "pasan"
 *    porque la pantalla muestra un error genérico que nadie verifica);
 *  - hay errores en consola o excepciones no capturadas (salud del runtime de Angular).
 *
 * Las simulaciones se registran con `api.json(...)`/`api.status(...)`: Playwright evalúa las
 * rutas en orden inverso de registro, así que el catch-all registrado primero solo atiende lo
 * que ningún mock cubrió.
 */
export type Rol = 'CUSTOMER' | 'ADMIN' | 'CATALOG_MANAGER';

export interface ApiMock {
  json(pattern: string, body: unknown, status?: number): Promise<void>;
  handle(pattern: string, handler: (route: Route) => unknown): Promise<void>;
  /** Llamadas a la API que ningún mock atendió. */
  readonly noSimuladas: string[];
}

/** Errores de consola esperables (no son fallas del frontend). */
const CONSOLA_PERMITIDA = [
  // En local el dashboard intenta STOMP por el proxy; sin backend el socket falla y cae a polling.
  /WebSocket connection to '.*\/ws\/metricas' failed/,
  // El navegador registra en consola los 4xx/5xx que los tests simulan a propósito.
  /Failed to load resource: the server responded with a status of (4|5)\d\d/,
];

export function sesionCognito(roles: Rol[]): string {
  return JSON.stringify({
    user: {
      username: 'e2e',
      email: 'e2e@camisetas360.test',
      name: 'Usuario E2E',
      sub: 'sub-e2e',
      roles,
    },
    accessToken: 'e2e-token',
    idToken: 'e2e-id',
  });
}

/** Deja una sesión Cognito (y compras opcionales) antes de que arranque Angular. */
export async function iniciarSesion(page: Page, roles: Rol[], compras?: unknown[]): Promise<void> {
  await page.addInitScript(
    ({ s, c }) => {
      localStorage.setItem('c360_cognito_session', s);
      if (c) localStorage.setItem('c360_compras', c);
    },
    { s: sesionCognito(roles), c: compras ? JSON.stringify(compras) : null },
  );
}

/** El build de producción llama al API Gateway (otro origen): las respuestas simuladas llevan CORS. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export const test = base.extend<{ api: ApiMock; salud: void }>({
  api: async ({ page }, use) => {
    const noSimuladas: string[] = [];
    // page.route no intercepta WebSockets: sin esto el STOMP del dashboard llega por el proxy al
    // backend real (si está levantado) y el resultado del test depende del entorno. Por defecto
    // se corta el socket de la app = "sin tiempo real" (la app debe caer a polling). El socket de
    // recarga en caliente de Vite no se toca.
    await page.routeWebSocket(/\/ws\/metricas/, (ws) =>
      ws.close({ code: 1011, reason: 'sin backend en e2e' }),
    );
    await page.route('**/api/v1/**', (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS });
      }
      noSimuladas.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.fulfill({ status: 599, headers: CORS, body: 'no simulado en el e2e' });
    });
    const api: ApiMock = {
      noSimuladas,
      json: (pattern, body, status = 200) =>
        page.route(pattern, (route) =>
          route.request().method() === 'OPTIONS'
            ? route.fallback()
            : route.fulfill({
                status,
                headers: CORS,
                contentType: 'application/json',
                body: JSON.stringify(body),
              }),
        ),
      handle: (pattern, handler) =>
        page.route(pattern, (route) =>
          route.request().method() === 'OPTIONS' ? route.fallback() : handler(route),
        ),
    };
    await use(api);
    expect(noSimuladas, 'la app llamó endpoints que el test no simuló').toEqual([]);
  },

  salud: [
    async ({ page }, use) => {
      const errores: string[] = [];
      page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const texto = m.text();
        if (!CONSOLA_PERMITIDA.some((re) => re.test(texto))) errores.push(`console: ${texto}`);
      });
      await use();
      expect(errores, 'errores de runtime en el navegador').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect, CORS };
