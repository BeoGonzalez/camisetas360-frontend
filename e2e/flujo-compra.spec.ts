import { Route } from '@playwright/test';
import { test, expect, iniciarSesion, CORS } from './fixtures';
import { products, RECOS_VACIAS } from './support/datos';

/**
 * Flujo completo con la API simulada y con estado: catálogo -> detalle -> carrito (agregar,
 * envío) -> checkout 202 -> seguimiento por polling -> pago -> resultado.
 * Verifica los CONTRATOS que el frontend envía, no solo que las pantallas aparezcan.
 */
const TOKEN = 'tok-webpay-e2e';
const WEBPAY_URL = 'https://webpay.e2e.test/webpayserver/initTransaction';
const REQUEST_ID = '9b2f6c1e-0d3a-4c55-9e1f-2a7b8c9d0e1f';
const COSTO_EXPRESS = 6990;

interface Item {
  sku: string;
  nombre: string;
  categoria: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

test('compra de punta a punta con seguimiento asíncrono y pago', async ({ page, api }) => {
  test.slow(); // incluye el polling real de /orders (cada 2 s)
  await iniciarSesion(page, ['CUSTOMER']);
  const producto = products[0];

  // ---- estado del "backend" ----
  let items: Item[] = [];
  let envio: { metodo: string; region: string; comuna: string; costo: number } | null = null;
  const carritoDTO = () => {
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const costoEnvio = envio?.costo ?? 0;
    return { items, envio, subtotal, costoEnvio, total: subtotal + costoEnvio };
  };
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      headers: CORS,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

  let checkoutHecho = false;
  let consultasTrasCheckout = 0;
  const cuerpos: Record<string, unknown> = {};
  const webpay: { metodo: string; cuerpo: string }[] = [];

  await api.json('**/api/v1/catalog/products', products);
  await api.json(`**/api/v1/catalog/products/${producto.sku}`, producto);
  await api.json('**/api/v1/recomendaciones', RECOS_VACIAS);
  await api.json('**/api/v1/analytics/recomendaciones', {
    items: [],
    perfil: {},
    generadoEn: null,
  });
  await api.handle('**/api/v1/carrito', (r) => json(r, carritoDTO()));
  await api.handle('**/api/v1/carrito/items', (r) => {
    const b = r.request().postDataJSON();
    cuerpos['item'] = b;
    items = [{ ...b, subtotal: b.precioUnitario * b.cantidad }];
    return json(r, carritoDTO());
  });
  await api.handle('**/api/v1/carrito/items/*', (r) => {
    items = items.filter((i) => !r.request().url().endsWith(`/${i.sku}`));
    return json(r, carritoDTO());
  });
  await api.handle('**/api/v1/carrito/envio', (r) => {
    const b = r.request().postDataJSON();
    cuerpos['envio'] = b;
    const costo = b.metodo === 'EXPRESS' ? COSTO_EXPRESS : b.metodo === 'STANDARD' ? 3990 : 0;
    envio = { ...b, costo };
    return json(r, carritoDTO());
  });
  await api.handle('**/api/v1/carrito/checkout', (r) => {
    cuerpos['checkout'] = r.request().postDataJSON();
    checkoutHecho = true;
    // El backend NO vacía el carrito: el frontend debe releerlo y quitar lo comprado.
    return json(
      r,
      {
        requestId: REQUEST_ID,
        userEmail: 'e2e@camisetas360.test',
        totalAmount: producto.price,
        status: 'PROCESSING',
      },
      202,
    );
  });
  await api.handle('**/api/v1/orders', (r) => {
    if (checkoutHecho) consultasTrasCheckout++;
    // El pedido "aparece" recién en la 2.ª consulta posterior al checkout (RabbitMQ asíncrono).
    const ordenes =
      consultasTrasCheckout >= 2
        ? [
            {
              orderId: 42,
              userEmail: 'e2e@camisetas360.test',
              totalAmount: producto.price,
              status: 'CREATED',
              createdAt: new Date().toISOString(),
              items: [{ sku: producto.sku, quantity: 1, unitPrice: producto.price }],
            },
          ]
        : [];
    return json(r, ordenes);
  });
  const monto = producto.price + COSTO_EXPRESS;
  await api.handle('**/api/v1/pago/webpay/iniciar', (r) => {
    cuerpos['pago'] = r.request().postDataJSON();
    return json(
      r,
      { pagoId: 'pago-1', ordenId: REQUEST_ID, monto, token: TOKEN, url: WEBPAY_URL },
      201,
    );
  });
  // Webpay (Transbank) simulado: recibe el POST con token_ws y, como hace el retorno del backend,
  // devuelve al cliente a /pago/resultado.
  await page.route(WEBPAY_URL, (r) => {
    webpay.push({ metodo: r.request().method(), cuerpo: r.request().postData() ?? '' });
    const destino = `${new URL(page.url()).origin}/pago/resultado?estado=APROBADO&pagoId=pago-1&ordenId=${REQUEST_ID}`;
    return r.fulfill({ status: 303, headers: { Location: destino } });
  });
  const pagoAutorizado = {
    id: 'pago-1',
    ordenId: REQUEST_ID,
    monto,
    moneda: 'CLP',
    estado: 'AUTORIZADO',
    codigoAutorizacion: 'AUTH-E2E',
    tarjetaUltimos4: '6623',
    tarjetaMarca: 'WEBPAY-VD',
    createdAt: new Date().toISOString(),
  };
  await api.json('**/api/v1/pago/pago-1', pagoAutorizado);

  // ---- catálogo -> detalle -> agregar ----
  await page.goto('/catalog');
  await page.getByRole('link', { name: producto.name }).click();
  await expect(page.getByRole('heading', { level: 1, name: producto.name })).toBeVisible();
  await page.getByRole('button', { name: 'Añadir al carrito' }).click();
  await expect
    .poll(() => cuerpos['item'])
    .toEqual({
      sku: producto.sku,
      // nombre, categoría y precio salen del ProductDTO del catálogo
      nombre: producto.name,
      categoria: producto.category,
      precioUnitario: producto.price,
      cantidad: 1,
    });

  // ---- carrito: envío ----
  await page
    .getByRole('navigation')
    .first()
    .getByRole('link', { name: /Carrito/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  const finalizar = page.getByRole('button', { name: 'Finalizar compra' });
  await expect(finalizar).toBeDisabled(); // sin envío guardado no hay checkout
  await page.getByLabel(/Express/).check();
  await page.getByLabel('Región').fill('Metropolitana');
  await page.getByLabel('Comuna').fill('Providencia');
  await page.getByRole('button', { name: 'Guardar envío' }).click();
  await expect
    .poll(() => cuerpos['envio'])
    .toEqual({ metodo: 'EXPRESS', region: 'Metropolitana', comuna: 'Providencia' });
  await expect(finalizar).toBeEnabled();

  // ---- checkout 202 -> seguimiento ----
  await finalizar.click();
  await expect(page).toHaveURL(new RegExp(`/pedidos/compra/${REQUEST_ID}$`));
  expect(cuerpos['checkout']).toEqual({
    items: [{ sku: producto.sku, quantity: 1, unitPrice: producto.price }],
  });
  await expect(page.getByRole('heading', { name: '¡Pedido recibido!' })).toBeVisible();
  await expect(page.getByText('Estamos creando tu pedido')).toBeVisible();
  await expect(page.getByText(/Tu pedido\s*#42\s*fue creado/)).toBeVisible({ timeout: 15000 });
  expect(consultasTrasCheckout).toBe(2);
  expect(items, 'tras el 202 se quitan del carrito los ítems comprados').toEqual([]);

  // ---- pago ----
  await page.getByRole('link', { name: 'Pagar ahora' }).click();
  await expect(page).toHaveURL(new RegExp(`/pago/checkout/${REQUEST_ID}$`));
  // La tarjeta se ingresa en Webpay: aquí no hay campos de tarjeta.
  await expect(page.locator('#numeroTarjeta, #cvv')).toHaveCount(0);
  await page.locator('#btnPagar').click();

  await expect(page).toHaveURL(/\/pago\/resultado\?estado=APROBADO&pagoId=pago-1/);
  await expect(page.getByRole('heading', { name: 'Su compra ha sido aprobada' })).toBeVisible();
  await expect(page.getByText('AUTH-E2E')).toBeVisible();
  // Se cobra el total mostrado (ítems + envío) y el requestId del checkout va como ordenId.
  expect(cuerpos['pago']).toEqual({ ordenId: REQUEST_ID, monto });
  // El navegador fue a Webpay con un POST y solo el token_ws (exigencia de Transbank).
  expect(webpay).toEqual([{ metodo: 'POST', cuerpo: `token_ws=${TOKEN}` }]);
});
