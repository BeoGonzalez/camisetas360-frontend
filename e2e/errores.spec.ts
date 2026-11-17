import { test, expect, iniciarSesion, CORS } from './fixtures';
import { CARRITO_VACIO, COMPRAS_JSON, products, RECOS_VACIAS, REQ } from './support/datos';

/** Cada clase de error HTTP se traduce a un estado de UI correcto y nunca al detalle crudo. */
test.describe('manejo de errores HTTP', () => {
  test.beforeEach(async ({ page, api }) => {
    await iniciarSesion(page, ['CUSTOMER'], JSON.parse(COMPRAS_JSON));
    await api.json('**/api/v1/carrito', CARRITO_VACIO); // lo carga la app al iniciar (CUSTOMER)
  });

  test('503 en el catálogo: servicio no disponible y el reintento recupera', async ({
    page,
    api,
  }) => {
    let llamadas = 0;
    await api.json('**/api/v1/recomendaciones', RECOS_VACIAS);
    await api.handle('**/api/v1/catalog/products', (r) =>
      ++llamadas === 1
        ? r.fulfill({
            status: 503,
            headers: CORS,
            contentType: 'application/problem+json',
            body: JSON.stringify({
              title: 'Service Unavailable',
              detail: 'Connection refused: catalog-db:5432',
            }),
          })
        : r.fulfill({
            status: 200,
            headers: CORS,
            contentType: 'application/json',
            body: JSON.stringify(products),
          }),
    );
    await page.goto('/catalog');
    const alerta = page.getByRole('alert');
    await expect(alerta).toContainText('Servicio no disponible');
    await expect(page.getByText('catalog-db')).toHaveCount(0); // nunca el detalle crudo
    await alerta.getByRole('button').click();
    await expect(page.getByRole('link', { name: products[0].name })).toBeVisible();
    expect(llamadas).toBe(2);
  });

  test('500 con stack trace en el body: no se muestra al usuario', async ({ page, api }) => {
    await api.json(
      '**/api/v1/orders',
      {
        title: 'Internal Server Error',
        detail:
          'java.lang.NullPointerException at cl.camisetas360.orders.OrderService.list(OrderService.java:42)',
      },
      500,
    );
    await page.goto('/pedidos');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/NullPointerException|OrderService\.java/)).toHaveCount(0);
  });

  test('403: "Sin permiso" sin invitar a reintentar', async ({ page, api }) => {
    await api.json('**/api/v1/orders', { title: 'Forbidden' }, 403);
    await page.goto('/pedidos');
    const alerta = page.getByRole('alert');
    await expect(alerta).toContainText('Sin permiso');
    await expect(alerta.getByRole('button')).toHaveCount(0);
  });

  test('401 con sesión Cognito: redirige al login conservando la ruta', async ({ page, api }) => {
    await api.json('**/api/v1/orders', { title: 'Unauthorized' }, 401);
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=%2Fpedidos$/);
  });

  test('429 antifraude: esperar 30 minutos, cuenta regresiva, persiste al recargar y se libera', async ({
    page,
    api,
  }) => {
    // El reloj simulado sigue corriendo en tiempo real (pausarlo congela el arranque de Angular):
    // las aserciones de la cuenta regresiva toleran los segundos reales que pasan bajo carga.
    await page.clock.install({ time: new Date('2026-11-13T15:00:00') });
    let intentos = 0;
    // Contrato real de ms-pagos: ProblemDetail + segundosParaReintentar + Retry-After.
    await api.handle('**/api/v1/pago/iniciar', (r) => {
      intentos++;
      return r.fulfill({
        status: 429,
        headers: { ...CORS, 'Retry-After': '1800' },
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'TOO_MANY_REQUESTS',
          codigo: 'BLOQUEADO_FRAUDE',
          intentosDetectados: 4,
          ventanaSegundos: 10,
          segundosParaReintentar: 1800,
          desbloqueoEn: '2026-11-13T18:30:00Z',
        }),
      });
    });

    const llenar = async () => {
      await page.locator('#numeroTarjeta').fill('4051 8856 0044 6623');
      await page.locator('#nombreTitular').fill('Cliente E2E');
      await page.locator('#mesVencimiento').selectOption('12');
      await page.locator('#anioVencimiento').selectOption('2028');
      await page.locator('#cvv').fill('123');
    };

    await page.goto(`/pago/checkout/${REQ}`);
    await llenar();
    await page.locator('#btnPagar').click();

    const bloqueo = page.getByTestId('bloqueo-pago');
    await expect(bloqueo).toContainText('Pago bloqueado por seguridad');
    await expect(bloqueo).toContainText('debes esperar 30 minutos antes de volver a comprar');
    await expect(bloqueo).toContainText(/Tiempo restante: (30:00|29:[45]\d)/);
    await expect(bloqueo).toContainText('podrás reintentar a las 15:30');
    await expect(page.getByRole('alert')).toHaveCount(1);
    await expect(page.locator('#btnPagar')).toBeDisabled();
    // PAN y CVV descartados tras enviar.
    await expect(page.locator('#numeroTarjeta')).toHaveValue('');
    await expect(page.locator('#cvv')).toHaveValue('');

    // Pasan 10 minutos y se recarga: el bloqueo sigue con el tiempo correcto.
    await page.clock.fastForward('10:00');
    await page.reload();
    // ~20:00 (no 30:00: no se reinició; no ausente: no se perdió con la recarga).
    await expect(page.getByTestId('bloqueo-pago')).toContainText(
      /Tiempo restante: (20:00|19:[45]\d)/,
    );
    await llenar();
    await expect(page.locator('#btnPagar')).toBeDisabled();
    const guardado = await page.evaluate(() => localStorage.getItem('c360_bloqueos_pago') ?? '');
    expect(guardado).toContain(REQ);
    expect(guardado).not.toContain('4051');

    // A los 30 minutos se libera y se puede volver a pagar.
    await page.clock.fastForward('20:01');
    await expect(page.getByTestId('bloqueo-pago')).toHaveCount(0);
    await expect(page.locator('#btnPagar')).toBeEnabled();
    expect(intentos).toBe(1);
  });
});
