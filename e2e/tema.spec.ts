import { test, expect } from './fixtures';
import { products } from './support/datos';

test.describe('modo claro / oscuro', () => {
  test('el botón cambia el tema, y se recuerda al recargar', async ({ page, api }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await api.json('**/api/v1/catalog/products', products);

    await page.goto('/catalog');
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-theme', 'dark');
    const fondoClaro = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Cambiar a modo claro' })).toBeVisible();
    const fondoOscuro = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(fondoOscuro).not.toBe(fondoClaro);

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: 'Cambiar a modo claro' }).click();
    await expect(html).not.toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('c360_tema'))).toBe('claro');
  });

  test('sin preferencia guardada sigue al sistema operativo', async ({ page, api }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await api.json('**/api/v1/catalog/products', products);
    await page.goto('/catalog');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
