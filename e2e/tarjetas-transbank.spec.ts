import { randomUUID } from 'node:crypto';
import { Page } from '@playwright/test';
import { test, expect, iniciarSesion } from './fixtures';
import { CARRITO_VACIO } from './support/datos';
import { TARJETAS_PRUEBA_TRANSBANK } from '../src/app/core/validators/tarjeta.validators';

/**
 * Tarjetas de prueba oficiales de Transbank contra el ms-pagos REAL (pnpm e2e:backend, con el
 * docker compose del backend arriba). Cada tarjeta paga una compra distinta y se verifica el
 * resultado que el backend decide (autorizada / rechazada) tal como lo ve el usuario.
 *
 * Cada corrida hace 1 intento por tarjeta: no la repitas más de 3 veces en 10 s o el antifraude
 * bloqueará esa tarjeta 30 minutos.
 */
test.describe('tarjetas de prueba Transbank contra ms-pagos real @backend', () => {
  // En serie: con 8 navegadores en paralelo + dev server en la misma máquina, el navegador tarda
  // ~10 s entre iniciar y confirmar (medido; el backend responde en ~15 ms aun en concurrencia).
  test.describe.configure({ mode: 'serial' });

  const formatear = (n: string) => n.replace(/(\d{4})(?=\d)/g, '$1 ');

  async function pagarCon(page: Page, numero: string, cvv: string) {
    const ordenId = randomUUID();
    await iniciarSesion(
      page,
      ['CUSTOMER'],
      [
        {
          requestId: ordenId,
          totalAmount: 15990,
          montoPago: 15990,
          createdAt: new Date().toISOString(),
          estado: 'ENCONTRADO',
        },
      ],
    );
    // Solo pagos va al backend real; el carrito que carga la app al iniciar se simula.
    await page.route('**/api/v1/carrito', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CARRITO_VACIO),
      }),
    );
    await page.goto(`/pago/checkout/${ordenId}`);
    // Se tipea agrupado de a 4, como lo haría una persona (la AMEX tiene 15 dígitos).
    await page.locator('#numeroTarjeta').pressSequentially(formatear(numero));
    await page.locator('#nombreTitular').fill('Cliente Transbank');
    await page.locator('#mesVencimiento').selectOption('12');
    await page.locator('#anioVencimiento').selectOption(String(new Date().getFullYear() + 2));
    await page.locator('#cvv').fill(cvv);
    await expect(page.locator('#btnPagar'), `el formulario debe aceptar ${numero}`).toBeEnabled();
    await page.locator('#btnPagar').click();
    await expect(page).toHaveURL(/\/pago\/resultado/, { timeout: 15000 });
  }

  for (const t of TARJETAS_PRUEBA_TRANSBANK) {
    test(`${t.tipo} ${t.numero} -> ${t.autorizada ? 'Autorizada' : 'Rechazada'}`, async ({
      page,
    }) => {
      await pagarCon(page, t.numero, t.tipo.startsWith('AMEX') ? '1234' : '123');
      if (t.autorizada) {
        await expect(page.getByText('¡Pago Autorizado!')).toBeVisible();
        await expect(page.getByText(/AUTH-/)).toBeVisible();
        // El comprobante identifica la tarjeta solo por sus últimos 4 dígitos.
        await expect(page.getByText(t.numero.slice(-4)).first()).toBeVisible();
        await expect(page.getByText('Pago Rechazado')).toHaveCount(0);
      } else {
        await expect(page.getByText('Pago Rechazado')).toBeVisible();
        await expect(
          page.getByText('Rechazada por el emisor (tarjeta de prueba Transbank)'),
        ).toBeVisible();
        await expect(page.getByText('¡Pago Autorizado!')).toHaveCount(0);
      }
      // Nunca se muestra el número completo.
      await expect(page.getByText(t.numero)).toHaveCount(0);
      await expect(page.getByText(formatear(t.numero))).toHaveCount(0);
    });
  }
});
