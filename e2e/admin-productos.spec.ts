import { test, expect, iniciarSesion, CORS } from './fixtures';
import { CARRITO_VACIO, products, RECOS_VACIAS } from './support/datos';

/** PNG mínimo válido (1x1) para la subida de la foto. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const arsenalLocal = {
  sku: 'PL-ARS-LOC-2627',
  name: 'Camiseta Arsenal Local 2026/27',
  team: 'Arsenal',
  kitType: 'LOCAL',
  league: 'Premier League',
  category: 'Fútbol',
  price: 94.99,
  stock: 120,
  description: null,
  imageVersion: null,
};

test.describe('gestión de camisetas (/admin/productos)', () => {
  test('CATALOG_MANAGER agrega la camiseta visitante que falta, con foto, y elimina otra', async ({
    page,
    api,
  }) => {
    await iniciarSesion(page, ['CATALOG_MANAGER']);
    const recibido: { alta?: Record<string, unknown>; foto?: string; borrado?: string } = {};

    await api.handle('**/api/v1/catalog/products', async (route) => {
      if (route.request().method() === 'POST') {
        recibido.alta = route.request().postDataJSON();
        return route.fulfill({
          status: 201,
          headers: CORS,
          json: { ...recibido.alta, imageVersion: null },
        });
      }
      return route.fulfill({ headers: CORS, json: [arsenalLocal, ...products] });
    });
    await api.handle('**/api/v1/catalog/products/PL-ARS-VIS-2627/imagen**', async (route) => {
      if (route.request().method() === 'PUT') {
        recibido.foto = route.request().headers()['content-type'];
        return route.fulfill({
          headers: CORS,
          json: { ...recibido.alta, imageVersion: 1700000000000 },
        });
      }
      return route.fulfill({ headers: CORS, contentType: 'image/png', body: PNG });
    });
    await api.handle('**/api/v1/catalog/products/CAM-002', async (route) => {
      recibido.borrado = route.request().method();
      return route.fulfill({ status: 204, headers: CORS });
    });

    await page.goto('/catalog');
    await page.getByRole('navigation').first().getByRole('link', { name: 'Productos' }).click();
    await expect(page.getByRole('heading', { name: 'Gestión de camisetas' })).toBeVisible();

    const arsenal = page.getByRole('region', { name: 'Arsenal' });
    await arsenal.getByRole('button', { name: 'Agregar camiseta visitante' }).click();

    const dialogo = page.getByRole('dialog', { name: 'Nueva camiseta' });
    await expect(dialogo.getByLabel('Equipo')).toHaveValue('Arsenal');
    await expect(dialogo.getByLabel('Nombre')).toHaveValue('Camiseta Arsenal Visitante');
    await dialogo.getByLabel('SKU').fill('PL-ARS-VIS-2627');
    await dialogo.getByLabel('Precio (CLP)').fill('94990');
    await dialogo.getByLabel('Stock').fill('100');
    await dialogo
      .getByLabel(/Foto de la camiseta/)
      .setInputFiles({ name: 'visitante.png', mimeType: 'image/png', buffer: PNG });
    await expect(dialogo.getByRole('img', { name: 'Vista previa de la foto' })).toBeVisible();
    await dialogo.getByRole('button', { name: 'Crear camiseta' }).click();

    await expect(dialogo).toBeHidden();
    await expect(page.getByRole('status')).toHaveText('Se creó Camiseta Arsenal Visitante.');
    expect(recibido.alta).toMatchObject({
      sku: 'PL-ARS-VIS-2627',
      team: 'Arsenal',
      kitType: 'VISITANTE',
      league: 'Premier League',
      price: 94990,
      stock: 100,
    });
    expect(recibido.foto).toBe('image/png');
    await expect(arsenal.getByRole('img', { name: 'Camiseta Arsenal Visitante' })).toBeVisible();
    await expect(arsenal.getByRole('button', { name: /Agregar camiseta/ })).toHaveCount(1);

    await page.getByRole('button', { name: 'Eliminar Camiseta Visitante 2026' }).click();
    const confirmar = page.getByRole('alertdialog', { name: '¿Eliminar esta camiseta?' });
    await confirmar.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByRole('status')).toHaveText('Se eliminó Camiseta Visitante 2026.');
    expect(recibido.borrado).toBe('DELETE');
  });

  test('CUSTOMER no ve "Productos" y /admin/productos lo manda a /sin-permiso', async ({
    page,
    api,
  }) => {
    await iniciarSesion(page, ['CUSTOMER']);
    await api.json('**/api/v1/catalog/products', products);
    await api.json('**/api/v1/carrito', CARRITO_VACIO);
    await api.json('**/api/v1/recomendaciones', RECOS_VACIAS);

    await page.goto('/catalog');
    await expect(
      page.getByRole('navigation').first().getByRole('link', { name: 'Productos' }),
    ).toHaveCount(0);
    await page.goto('/admin/productos');
    await expect(page).toHaveURL(/\/sin-permiso$/);
  });
});
