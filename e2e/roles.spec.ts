import { test, expect, iniciarSesion, CORS } from './fixtures';
import { CARRITO_VACIO, metricas, products, RECOS_VACIAS } from './support/datos';

/**
 * La navegación oculta y los guards bloquean lo que el rol no puede usar. ADMIN NO hereda los
 * permisos de CUSTOMER. (La autorización real es del backend; esto verifica la UX.)
 */
test.describe('separación de roles', () => {
  test('CUSTOMER: ve Carrito, no ve Métricas y /admin/metricas lo manda a /sin-permiso', async ({
    page,
    api,
  }) => {
    await iniciarSesion(page, ['CUSTOMER']);
    await api.json('**/api/v1/catalog/products', products);
    await api.json('**/api/v1/carrito', CARRITO_VACIO);
    await api.json('**/api/v1/recomendaciones', RECOS_VACIAS);

    await page.goto('/catalog');
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('link', { name: /Carrito/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Métricas/ })).toHaveCount(0);

    await page.goto('/admin/metricas');
    await expect(page).toHaveURL(/\/sin-permiso$/);
    await expect(page.getByRole('heading', { name: 'Sin permiso' })).toBeVisible();
  });

  test('ADMIN sin CUSTOMER: no carga el carrito, no ve Carrito y no entra a rutas de compra', async ({
    page,
    api,
  }) => {
    await iniciarSesion(page, ['ADMIN']);
    await api.json('**/api/v1/catalog/products', products);
    // Sin mock de /carrito ni /recomendaciones: si la app los pidiera, el fixture falla el test.

    await page.goto('/catalog');
    await expect(page.getByRole('link', { name: products[0].name })).toBeVisible();
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('link', { name: /Carrito/ })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: /Métricas/ })).toBeVisible();
    // Sin rol CUSTOMER tampoco se ofrece agregar al carrito.
    await expect(page.getByRole('button', { name: /^Añadir .* al carrito$/ })).toHaveCount(0);

    for (const ruta of ['/carrito', '/pedidos', '/pago/checkout']) {
      await page.goto(ruta);
      await expect(page, `ADMIN no debe entrar a ${ruta}`).toHaveURL(/\/sin-permiso$/);
    }
  });

  test('CATALOG_MANAGER: entra al dashboard pero no a las alertas de fraude (solo ADMIN)', async ({
    page,
    api,
  }) => {
    await iniciarSesion(page, ['CATALOG_MANAGER']);
    await api.json('**/api/v1/analytics/metricas', metricas);

    await page.goto('/admin/metricas');
    await expect(page.getByText('Clics último minuto')).toBeVisible();
    await expect(page.getByRole('link', { name: /Alertas de fraude/ })).toHaveCount(0);

    await page.goto('/pago/alertas');
    await expect(page).toHaveURL(/\/sin-permiso$/);
  });

  test('sin sesión: ve las camisetas; "Comprar" obliga a crear cuenta y vuelve a la camiseta', async ({
    page,
    api,
  }) => {
    await api.json('**/api/v1/catalog/products', products);
    await api.json('**/api/v1/catalog/products/CAM-001', products[0]);
    let registro: Record<string, unknown> | undefined;
    await api.handle('**/api/v1/auth/cognito/register', (route) => {
      registro = route.request().postDataJSON();
      return route.fulfill({
        headers: CORS,
        json: {
          accessToken: 'nuevo-token',
          idToken: 'nuevo-id',
          user: {
            username: 'ana@x.com',
            email: 'ana@x.com',
            name: 'Ana',
            sub: 'sub-ana',
            roles: ['CUSTOMER'],
          },
        },
      });
    });
    await api.json('**/api/v1/carrito', CARRITO_VACIO);
    await api.json('**/api/v1/recomendaciones', RECOS_VACIAS);
    await api.json('**/api/v1/analytics/recomendaciones', {
      items: [],
      perfil: {},
      generadoEn: null,
    });

    await page.goto('/catalog');
    await expect(page.getByRole('link', { name: products[0].name })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Añadir .* al carrito$/ })).toHaveCount(0);
    await page.getByRole('button', { name: `Comprar ${products[0].name}` }).click();

    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=%2Fcatalog%2FCAM-001&motivo=comprar$/);
    await expect(page.getByText('Para comprar necesitas una cuenta.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Microsoft Entra ID' })).toBeVisible();

    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await page.getByLabel('Nombre').fill('Ana');
    await page.getByLabel('Correo electrónico').fill('ana@x.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('Secreta1!');
    await page.getByLabel('Repite la contraseña').fill('Secreta1!');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).last().click();

    await expect(page).toHaveURL(/\/catalog\/CAM-001$/);
    await expect(page.getByRole('button', { name: 'Añadir al carrito' })).toBeVisible();
    expect(registro).toMatchObject({ email: 'ana@x.com', name: 'Ana', action: 'register' });
  });

  test('"Cerrar sesión" en Mi perfil deja el navegador listo para otra persona', async ({
    page,
    api,
  }) => {
    await iniciarSesion(page, ['CUSTOMER']);
    await api.json('**/api/v1/carrito', CARRITO_VACIO);

    await page.goto('/perfil');
    await expect(page.getByText('e2e@camisetas360.test').first()).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('c360_cognito_session'))).toBeNull();

    // La barra ya no muestra al usuario anterior ni su carrito. (No se recarga: iniciarSesion
    // usa addInitScript y reinyectaría la sesión en cada navegación.)
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('link', { name: 'Iniciar Sesión' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Mi perfil' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: /Carrito/ })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Salir' })).toHaveCount(0);
  });

  test('sin sesión: una ruta protegida redirige al login conservando returnUrl', async ({
    page,
    api,
  }) => {
    expect(api.noSimuladas).toEqual([]); // el fixture verifica que no se llame a la API
    await page.goto('/carrito');
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=%2Fcarrito$/);
  });
});
