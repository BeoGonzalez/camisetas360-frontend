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

// Generador de PAN válido según algoritmo de Luhn (16 dígitos)
function generarPanValido(prefix = '4532'): string {
  let pan15 = prefix;
  while (pan15.length < 15) {
    pan15 += Math.floor(Math.random() * 10).toString();
  }
  let sum = 0;
  let shouldDouble = true;
  for (let i = 14; i >= 0; i--) {
    let digit = parseInt(pan15.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return pan15 + checkDigit.toString();
}

test.describe('Flujo de Pago e-Commerce Pedidos360 (ms-pago)', () => {
  test.beforeEach(async ({ page }) => {
    // Configurar sesión activa en localStorage antes de cargar la página
    await page.addInitScript((session) => {
      window.localStorage.setItem('c360_cognito_session', session);
    }, ADMIN_SESSION);
  });

  test('TC-01: Formulario de Pago y validaciones reactivas (Luhn y campos)', async ({ page }) => {
    await page.goto('/pago/checkout/00000000-0000-0000-0000-000000000001?monto=15990');

    // Verificar resumen de la orden
    await expect(page.locator('text=Finalizar Pago')).toBeVisible();
    await expect(page.locator('p.text-2xl.font-black')).toContainText(/15[.,]990/);

    const btnPagar = page.locator('#btnPagar');
    await expect(btnPagar).toBeDisabled();

    // Ingresar tarjeta con dígito verificador inválido
    const inputPan = page.locator('#numeroTarjeta');
    await inputPan.fill('4532 0151 1283 0367');
    await inputPan.blur();

    // Mensaje de error de Luhn
    await expect(page.locator('text=falla verificación Luhn')).toBeVisible();
    await expect(btnPagar).toBeDisabled();

    // Corregir a tarjeta válida
    await inputPan.fill('4532 0151 1283 0366');
    await expect(page.locator('text=falla verificación Luhn')).not.toBeVisible();

    // Completar el resto de campos
    await page.locator('#nombreTitular').fill('Carlos Valderrama');
    await page.locator('#mesVencimiento').selectOption('12');
    await page.locator('#anioVencimiento').selectOption('2028');
    await page.locator('#cvv').fill('123');

    // Botón habilitado
    await expect(btnPagar).toBeEnabled();
  });

  test('TC-02: Flujo Completo de Pago Autorizado (Tarjeta terminada en 6)', async ({ page }) => {
    const ordenId = '11111111-1111-1111-1111-111111111111';
    await page.goto(`/pago/checkout/${ordenId}?monto=15990`);

    await page.locator('#numeroTarjeta').fill('4532 0151 1283 0366');
    await page.locator('#nombreTitular').fill('Carlos Valderrama');
    await page.locator('#mesVencimiento').selectOption('12');
    await page.locator('#anioVencimiento').selectOption('2028');
    await page.locator('#cvv').fill('123');

    // Clic en pagar
    await page.locator('#btnPagar').click();

    // El flujo navega al retorno y luego a /pago/resultado
    await page.waitForURL(/\/pago\/resultado/, { timeout: 15000 });

    // Validar comprobante autorizado
    await expect(page.locator('text=¡Pago Autorizado!')).toBeVisible();
    await expect(page.locator('text=Código de Autorización:')).toBeVisible();
    await expect(page.locator('text=AUTH-')).toBeVisible();
    await expect(page.locator('text=0366')).toBeVisible();
    await expect(page.locator('dd.font-extrabold.text-blue-600')).toContainText(/15[.,]990/);
  });

  test('TC-03: Flujo de Pago Rechazado (Tarjeta terminada en 0 - fondos insuficientes)', async ({ page }) => {
    const ordenId = '22222222-2222-2222-2222-222222222222';
    await page.goto(`/pago/checkout/${ordenId}?monto=25000`);

    // Tarjeta con Luhn válido terminada en 0 (determinísticamente fondos insuficientes)
    await page.locator('#numeroTarjeta').fill('4532 0151 0000 0030');
    await page.locator('#nombreTitular').fill('Diego Maradona');
    await page.locator('#mesVencimiento').selectOption('12');
    await page.locator('#anioVencimiento').selectOption('2028');
    await page.locator('#cvv').fill('123');

    await page.locator('#btnPagar').click();

    await page.waitForURL(/\/pago\/resultado/, { timeout: 15000 });

    // Validar pantalla de rechazo
    await expect(page.locator('text=Pago Rechazado')).toBeVisible();
    await expect(page.locator('text=Fondos insuficientes')).toBeVisible();
    await expect(page.locator('text=Reintentar con otra tarjeta')).toBeVisible();
  });

  test('TC-04: Bloqueo Antifraude HTTP 429 por ventana deslizante (5 intentos en <10s)', async ({ page, request }) => {
    const ordenId = '33333333-3333-3333-3333-333333333333';
    // Generar tarjeta con Luhn válido nueva para no colisionar con ejecuciones anteriores
    const panRáfaga = generarPanValido('4532');

    // Disparar ráfaga de 3 intentos rápidos previos contra la API (dentro de los 10 segundos)
    for (let i = 1; i <= 3; i++) {
      const resp = await request.post('http://localhost:4200/api/v1/pago/iniciar', {
        headers: {
          'Origin': 'http://localhost:4200',
        },
        data: {
          ordenId,
          monto: 15990,
          numeroTarjeta: panRáfaga,
          cvv: '123',
          mesVencimiento: 12,
          anioVencimiento: 2028,
          nombreTitular: 'Atacante Script',
        },
      });
      expect(resp.status()).toBe(201);
    }

    // El 4.º intento se realiza desde la interfaz de usuario en menos de 10s
    await page.goto(`/pago/checkout/${ordenId}?monto=15990`);
    await page.locator('#numeroTarjeta').fill(panRáfaga);
    await page.locator('#nombreTitular').fill('Atacante Script');
    await page.locator('#mesVencimiento').selectOption('12');
    await page.locator('#anioVencimiento').selectOption('2028');
    await page.locator('#cvv').fill('123');

    await page.locator('#btnPagar').click();

    // Verificar que aparece el mensaje de bloqueo antifraude 429 en la UI
    await expect(page.locator('text=Bloqueo Preventivo Antifraude (Código 429)')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('text=Por motivos de seguridad')).toBeVisible();

    // Verificar que NO invita a reintentar de inmediato
    await expect(page.locator('button:has-text("Reintentar ahora")')).not.toBeVisible();
  });

  test('TC-05: Historial de pagos de una orden', async ({ page }) => {
    const ordenId = '11111111-1111-1111-1111-111111111111';
    await page.goto(`/pago/historial/${ordenId}`);

    await expect(page.locator('text=Historial de Pagos de la Orden')).toBeVisible();
    await expect(page.locator(`text=${ordenId}`)).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=Autorizado').first()).toBeVisible();
  });

  test('TC-06: Panel de Alertas Antifraude protegido para administradores (/pago/alertas)', async ({ page }) => {
    await page.goto('/pago/alertas');

    await expect(page.locator('text=Panel Administrativo')).toBeVisible();
    await expect(page.locator('text=Alertas de Fraude Detectadas')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=Intentos / Ventana')).toBeVisible();
  });
});
