import { test, expect } from '@playwright/test';

// Sesión mockeada de Cognito con rol ADMIN y CUSTOMER para permitir acceso a rutas protegidas
const ADMIN_SESSION = JSON.stringify({
  user: {
    username: 'admin',
    email: 'admin@camisetas360.test',
    name: 'Administrador Demo',
    sub: 'sub-admin-123',
    roles: ['CUSTOMER', 'ADMIN'],
  },
  accessToken: 'e2e-test-token-valid',
  idToken: 'e2e-test-id-token',
});

// requestId del checkout usado como ordenId de pago (SUPUESTO, ver CheckoutTrackerService).
const COMPRAS = JSON.stringify(
  [
    ['00000000-0000-0000-0000-000000000001', 15990],
    ['11111111-1111-1111-1111-111111111111', 15990],
  ].map(([requestId, montoPago]) => ({
    requestId,
    totalAmount: montoPago,
    montoPago,
    createdAt: '2026-11-10T00:00:00Z',
    estado: 'ENCONTRADO',
  })),
);

test.describe('Flujo de Pago contra ms-pagos real @backend', () => {
  /** Compra registrada que TC-02 paga con Webpay; TC-03 y TC-04 usan su pago. */
  const ORDEN_WEBPAY = '11111111-1111-1111-1111-111111111111';
  let pagoIdWebpay = '';

  // Contra el backend real: TC-03 y TC-04 dependen del pago creado en TC-02 (orden secuencial).
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Configurar sesión activa en localStorage antes de cargar la página
    await page.addInitScript(
      ({ session, compras }) => {
        window.localStorage.setItem('c360_cognito_session', session);
        // Compras registradas por un checkout (202): el formulario solo paga estas.
        window.localStorage.setItem('c360_compras', compras);
      },
      { session: ADMIN_SESSION, compras: COMPRAS },
    );
    // Solo pagos va contra el backend real (no valida JWT). El carrito que la app carga al
    // iniciar exige un JWT de Entra válido: se simula vacío para no forzar re-login.
    await page.route('**/api/v1/carrito', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], envio: null, subtotal: 0, costoEnvio: 0, total: 0 }),
      }),
    );
  });

  test('TC-01: el formulario muestra el resumen y deriva la tarjeta a Webpay', async ({ page }) => {
    await page.goto('/pago/checkout/00000000-0000-0000-0000-000000000001');

    await expect(page.locator('text=Finalizar Pago')).toBeVisible();
    await expect(page.locator('p.text-2xl.font-black')).toContainText(/15[.,]990/);
    await expect(page.getByText('Webpay de Transbank')).toBeVisible();
    // Camisetas360 nunca pide la tarjeta.
    await expect(page.locator('#numeroTarjeta, #cvv, input[autocomplete^="cc-"]')).toHaveCount(0);
    await expect(page.locator('#btnPagar')).toBeEnabled();
    await expect(page.locator('#btnPagar')).toContainText(/Pagar \$?15[.,]990 con Webpay/);
  });

  test('TC-02: ms-pagos crea la transacción y el navegador va a Webpay con POST token_ws', async ({
    page,
  }) => {
    await page.goto(`/pago/checkout/${ORDEN_WEBPAY}`);

    const respuesta = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/pago/webpay/iniciar') && r.request().method() === 'POST',
    );
    const haciaWebpay = page.waitForRequest(
      (r) => r.method() === 'POST' && (r.postData() ?? '').startsWith('token_ws='),
    );
    await page.locator('#btnPagar').click();

    const res = await respuesta;
    expect(res.status()).toBe(201);
    expect(res.request().postDataJSON()).toEqual({ ordenId: ORDEN_WEBPAY, monto: 15990 });
    const cuerpo = await res.json();
    expect(cuerpo).toMatchObject({ ordenId: ORDEN_WEBPAY, monto: 15990 });
    expect(cuerpo.token).toBeTruthy();
    expect(cuerpo.url).toMatch(/^https:\/\//);
    pagoIdWebpay = cuerpo.pagoId;

    const req = await haciaWebpay;
    expect(req.url()).toBe(cuerpo.url);
    expect(req.postData()).toBe(`token_ws=${encodeURIComponent(cuerpo.token)}`);
  });

  test('TC-03: retorno RECHAZADO con un pago real: rechazada y reintento de la orden', async ({
    page,
  }) => {
    expect(pagoIdWebpay, 'depende del pago creado en TC-02').toBeTruthy();
    await page.goto(
      `/pago/resultado?estado=RECHAZADO&pagoId=${pagoIdWebpay}&ordenId=${ORDEN_WEBPAY}`,
    );
    await expect(page.getByRole('heading', { name: 'Su compra ha sido rechazada' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reintentar pago' })).toHaveAttribute(
      'href',
      `/pago/checkout/${ORDEN_WEBPAY}`,
    );
    await expect(page.getByRole('link', { name: 'Volver al carrito' })).toBeVisible();
  });

  test('TC-04: Historial de pagos de una orden', async ({ page }) => {
    await page.goto(`/pago/historial/${ORDEN_WEBPAY}`);

    await expect(page.locator('text=Historial de Pagos de la Orden')).toBeVisible();
    await expect(page.locator(`text=${ORDEN_WEBPAY}`)).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    // TC-02 dejó una transacción iniciada (no se completa el pago en Transbank).
    await expect(page.locator('td', { hasText: 'INICIADO' }).first()).toBeVisible();
  });

  test('TC-05: Panel de Alertas Antifraude protegido para administradores (/pago/alertas)', async ({
    page,
  }) => {
    await page.goto('/pago/alertas');

    await expect(page.locator('text=Panel Administrativo')).toBeVisible();
    await expect(page.locator('text=Alertas de Fraude Detectadas')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=Intentos / Ventana')).toBeVisible();
  });
});
