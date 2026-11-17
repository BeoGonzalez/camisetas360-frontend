import { test, expect, iniciarSesion, ApiMock } from './fixtures';
import { cart, COMPRAS_JSON, metricas, order, products, REQ } from './support/datos';

/**
 * Pantallas principales a 400 px con la API simulada: sin scroll horizontal, contenido real
 * renderizado y, vía el fixture, sin llamadas no simuladas ni errores de consola.
 */
async function mockApi(api: ApiMock) {
  await api.json('**/api/v1/catalog/products', products);
  await api.json('**/api/v1/catalog/products/*', products[0]);
  await api.json('**/api/v1/carrito', cart);
  await api.json('**/api/v1/orders', [order]);
  await api.json('**/api/v1/orders/7', order);
  await api.json('**/api/v1/recomendaciones', {
    fuente: 'MODELO',
    versionModelo: 'v1',
    items: [
      {
        posicion: 1,
        sku: 'CAM-002',
        puntaje: 3.2,
        score: 0.82,
        nombre: 'Camiseta Visitante 2026',
        categoria: 'Fútbol',
        precio: 39990,
      },
    ],
  });
  await api.json('**/api/v1/analytics/recomendaciones', {
    items: [
      {
        sku: 'CAM-002',
        nombre: 'Camiseta Visitante 2026',
        categoria: 'Fútbol',
        precio: 39990,
        score: 0.82,
        motivo: 'Porque viste camisetas de fútbol',
      },
    ],
    perfil: { Fútbol: 0.9 },
    generadoEn: '2026-11-10T10:00:00Z',
  });
  await api.json('**/api/v1/analytics/metricas', metricas);
}

test.use({ viewport: { width: 400, height: 860 } });

test.beforeEach(async ({ page, api }) => {
  // Un usuario con ambos roles es válido (ADMIN no hereda CUSTOMER: se asignan los dos).
  await iniciarSesion(page, ['CUSTOMER', 'ADMIN'], JSON.parse(COMPRAS_JSON));
  await mockApi(api);
});

const pantallas: [string, string, RegExp][] = [
  ['catalogo', '/catalog', /Álbum de camisetas/],
  ['detalle', '/catalog/CAM-001', /unidades disponibles/],
  ['carrito', '/carrito', /Resumen/],
  ['pedidos', '/pedidos', /Pedido #7/],
  ['detalle-pedido', '/pedidos/7', /Total:/],
  ['compra', `/pedidos/compra/${REQ}`, /Pedido recibido/],
  ['pago', `/pago/checkout/${REQ}`, /Finalizar Pago/],
  ['metricas', '/admin/metricas', /Clics último minuto/],
  ['productos', '/admin/productos', /Gestión de camisetas/],
];

for (const [nombre, ruta, texto] of pantallas) {
  test(`400px: ${nombre} sin scroll horizontal`, async ({ page }) => {
    await page.goto(ruta);
    await expect(page.getByText(texto).first()).toBeVisible({ timeout: 15000 });
    // Ningún estado de error visible: la pantalla cargó con los datos simulados.
    await expect(page.getByRole('alert')).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/400px-${nombre}.png`, fullPage: true });
  });
}

test('dashboard: sin tiempo real cae a polling y muestra métricas', async ({ page }) => {
  await page.goto('/admin/metricas');
  await expect(page.getByText('Sin tiempo real: actualizando cada 5 s')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText('37', { exact: true })).toBeVisible();
  await expect(page.getByText('Tarjeta ****4444 bloqueada')).toBeVisible();
});
