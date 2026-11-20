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

  test('400 al iniciar Webpay (orden ya pagada): explica el motivo, sin texto crudo, y permite reintentar', async ({
    page,
    api,
  }) => {
    let intentos = 0;
    await api.handle('**/api/v1/pago/webpay/iniciar', (r) => {
      intentos++;
      return r.fulfill({
        status: 400,
        headers: CORS,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'BAD_REQUEST',
          mensaje: `La orden ${REQ} ya tiene un pago aprobado (PagoServiceImpl.java:88)`,
        }),
      });
    });

    await page.goto(`/pago/checkout/${REQ}`);
    const boton = page.locator('#btnPagar');
    await boton.click();

    const alerta = page.getByRole('alert');
    await expect(alerta).toContainText('No pudimos iniciar el pago');
    await expect(alerta).toContainText('ya tiene un pago aprobado');
    await expect(page.getByText('PagoServiceImpl')).toHaveCount(0); // nunca el detalle crudo
    await expect(page).toHaveURL(new RegExp(`/pago/checkout/${REQ}$`)); // no se fue a Webpay
    await expect(boton).toBeEnabled();
    await expect(boton).toContainText('con Webpay');

    await boton.click();
    await expect.poll(() => intentos).toBe(2);
  });
});
