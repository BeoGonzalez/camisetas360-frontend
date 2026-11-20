import { test, expect, iniciarSesion, CORS } from './fixtures';
import { CARRITO_VACIO, COMPRAS_JSON, REQ } from './support/datos';

/**
 * Pago con Webpay Plus (Transbank) con la API simulada: el frontend solo crea la transacción y
 * envía el navegador a Webpay; el backend devuelve al cliente a /pago/resultado?estado=...
 */
const WEBPAY_URL = 'https://webpay.e2e.test/webpayserver/initTransaction';
const PAGO_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

test.describe('Webpay Plus', () => {
  test('doble clic en pagar crea una sola transacción y va a Webpay una vez', async ({
    page,
    api,
  }) => {
    await iniciarSesion(page, ['CUSTOMER'], JSON.parse(COMPRAS_JSON));
    await api.json('**/api/v1/carrito', CARRITO_VACIO);
    let iniciadas = 0;
    let soltar!: () => void;
    const respuestaRetenida = new Promise<void>((r) => (soltar = r));
    await api.handle('**/api/v1/pago/webpay/iniciar', async (r) => {
      iniciadas++;
      await respuestaRetenida; // Webpay tarda: el botón debe quedar bloqueado mientras tanto
      return r.fulfill({
        status: 201,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({
          pagoId: PAGO_ID,
          ordenId: REQ,
          monto: 1,
          token: 'tok-1',
          url: WEBPAY_URL,
        }),
      });
    });
    const visitasWebpay: string[] = [];
    await page.route(WEBPAY_URL, (r) => {
      visitasWebpay.push(r.request().postData() ?? '');
      return r.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<h1>Webpay simulado</h1>',
      });
    });

    await page.goto(`/pago/checkout/${REQ}`);
    await expect(page.getByText('Webpay de Transbank')).toBeVisible();
    const boton = page.locator('#btnPagar');
    await boton.dblclick();
    await expect(boton).toBeDisabled();
    await expect(boton).toHaveText('Redirigiendo a Webpay…');

    soltar();
    await expect(page.getByRole('heading', { name: 'Webpay simulado' })).toBeVisible();
    expect(iniciadas).toBe(1);
    expect(visitasWebpay).toEqual(['token_ws=tok-1']);
  });

  test('retorno sin sesión con estado=RECHAZADO y sin pagoId: rechazada, sin pedir login', async ({
    page,
  }) => {
    // El cliente vuelve desde Webpay: /pago/resultado es pública y no consulta el pago sin pagoId.
    await page.goto('/pago/resultado?estado=RECHAZADO');
    await expect(page).toHaveURL(/\/pago\/resultado\?estado=RECHAZADO$/);
    await expect(page.getByRole('heading', { name: 'Su compra ha sido rechazada' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver al carrito' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reintentar pago' })).toHaveCount(0);
  });

  test('retorno RECHAZADO con pago: mensaje del emisor y reintento de la misma orden', async ({
    page,
    api,
  }) => {
    await iniciarSesion(page, ['CUSTOMER'], JSON.parse(COMPRAS_JSON));
    await api.json('**/api/v1/carrito', CARRITO_VACIO);
    await api.json(`**/api/v1/pago/${PAGO_ID}`, {
      id: PAGO_ID,
      ordenId: REQ,
      monto: 1,
      moneda: 'CLP',
      estado: 'RECHAZADO',
      tarjetaMarca: 'WEBPAY',
      tarjetaUltimos4: null,
      mensajeRespuesta: 'Transacción rechazada por el emisor',
      createdAt: new Date().toISOString(),
    });

    await page.goto(`/pago/resultado?estado=RECHAZADO&pagoId=${PAGO_ID}&ordenId=${REQ}`);
    await expect(page.getByRole('heading', { name: 'Su compra ha sido rechazada' })).toBeVisible();
    await expect(page.getByText('Transacción rechazada por el emisor')).toBeVisible();
    await page.getByRole('link', { name: 'Reintentar pago' }).click();
    await expect(page).toHaveURL(new RegExp(`/pago/checkout/${REQ}$`));
    await expect(page.locator('#btnPagar')).toContainText('con Webpay');
  });
});
