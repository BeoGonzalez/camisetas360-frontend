import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { products } from './support/datos';

/** Carga las imágenes diferidas (escudos con loading=lazy) antes de capturar la página. */
async function esperarImagenes(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = 'eager';
    await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined)));
  });
}

test.describe('portada (/)', () => {
  test('es la primera página y lleva al catálogo', async ({ page, api }) => {
    await api.json('**/api/v1/catalog/products', products);
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('portada-titulo')).toContainText('El álbum de la temporada');
    await esperarImagenes(page);
    await page.screenshot({ path: 'test-results/portada-desktop.png', fullPage: true });

    await page.getByRole('tab', { name: 'Serie A' }).click();
    await expect(page.getByRole('img', { name: /Camiseta local de Inter de Milán/ })).toBeVisible();

    await page.getByRole('link', { name: 'Abrir el álbum →' }).first().click();
    await expect(page).toHaveURL(/\/catalog$/);
    // El logotipo vuelve a la portada.
    await page.getByRole('link', { name: 'Camisetas360, ir a la portada' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('una ruta desconocida vuelve a la portada', async ({ page }) => {
    await page.goto('/no-existe');
    await expect(page.getByTestId('portada-titulo')).toBeVisible();
  });

  test('400px: sin scroll horizontal y con acceso al catálogo', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto('/');
    await expect(page.getByTestId('portada-titulo')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await esperarImagenes(page);
    await page.screenshot({ path: 'test-results/portada-400.png', fullPage: true });
    // Sin sesión, en móvil «Catálogo» e «Iniciar sesión» están en el menú.
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Catálogo' }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Iniciar Sesión' }),
    ).toBeVisible();
  });

  test('modo oscuro', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.getByTestId('portada-titulo')).toBeVisible();
    await esperarImagenes(page);
    await page.screenshot({ path: 'test-results/portada-oscuro.png', fullPage: true });
  });
});
