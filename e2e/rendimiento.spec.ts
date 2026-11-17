import { Page } from '@playwright/test';
import { test, expect, iniciarSesion } from './fixtures';
import { CARRITO_VACIO, metricas, products, RECOS_VACIAS } from './support/datos';

/**
 * Rendimiento del BUILD DE PRODUCCIÓN (proyecto "rendimiento", servido con gzip como nginx).
 * Umbrales = "Good" de Core Web Vitals; los de bytes reflejan los budgets de angular.json.
 * Se aplica throttling de CPU (4x) para acercarse a un teléfono de gama media.
 */
const PRESUPUESTO = {
  lcpMs: 2500,
  cls: 0.1,
  /**
   * Total Blocking Time (suma de duración - 50 ms de las long tasks). Objetivo "Good" < 200 ms;
   * hoy mide ~330-420 ms con CPU 4x (deuda: bundle inicial de 714 kB > budget de 500 kB). El gate
   * queda en el límite de "Poor" (600 ms) para frenar regresiones; bajarlo al reducir el bundle.
   */
  tbtMs: 600,
  /** JS transferido (comprimido) en la carga inicial de /catalog. */
  jsTransferidoKb: 250,
  /** JS descomprimido: coincide con budget initial maximumError (1 MB) de angular.json. */
  jsDecodificadoKb: 1024,
  /**
   * Navegación + render de 500 tarjetas con CPU 4x: hoy ~2,6 s (no hay virtualización). Gate de
   * "claramente roto" para no ser intermitente en runners de CI más lentos.
   */
  renderListaMs: 5000,
  /** Filtrar 500 productos ya renderizados (signals + @for con track). */
  filtrarMs: 1500,
};

async function medir(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        lcp: number;
        cls: number;
        tbt: number;
        js: { transfer: number; decoded: number; n: number };
      }>((resolve) => {
        let lcp = 0;
        let cls = 0;
        let tbt = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) lcp = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[])
            if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) tbt += Math.max(0, e.duration - 50);
        }).observe({ type: 'longtask', buffered: true });
        setTimeout(() => {
          const js = (
            performance.getEntriesByType('resource') as PerformanceResourceTiming[]
          ).filter((r) => r.initiatorType === 'script' || r.name.endsWith('.js'));
          resolve({
            lcp,
            cls,
            tbt,
            js: {
              transfer: js.reduce((s, r) => s + r.transferSize, 0) / 1024,
              decoded: js.reduce((s, r) => s + r.decodedBodySize, 0) / 1024,
              n: js.length,
            },
          });
        }, 1000);
      }),
  );
}

test.describe('rendimiento (build de producción)', () => {
  // En serie: workers en paralelo compiten por CPU y falsean las mediciones.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page, api }) => {
    await iniciarSesion(page, ['CUSTOMER', 'ADMIN']);
    await api.json('**/api/v1/carrito', CARRITO_VACIO);
    await api.json('**/api/v1/recomendaciones', RECOS_VACIAS);
    await api.json('**/api/v1/analytics/metricas', metricas);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  });

  test('carga inicial de /catalog dentro de Core Web Vitals y del budget de JS', async ({
    page,
    api,
  }) => {
    await api.json('**/api/v1/catalog/products', products);
    await page.goto('/catalog', { waitUntil: 'load' });
    await expect(page.getByRole('link', { name: products[0].name })).toBeVisible();
    const m = await medir(page);
    test.info().annotations.push({ type: 'métricas', description: JSON.stringify(m) });
    console.log(`[rendimiento] /catalog ${JSON.stringify(m)}`);

    expect(m.lcp, 'LCP (ms)').toBeGreaterThan(0);
    expect(m.lcp, 'LCP (ms)').toBeLessThan(PRESUPUESTO.lcpMs);
    expect(m.cls, 'CLS').toBeLessThan(PRESUPUESTO.cls);
    expect(m.tbt, 'TBT (ms)').toBeLessThan(PRESUPUESTO.tbtMs);
    expect(m.js.decoded, 'JS descomprimido (KB)').toBeLessThan(PRESUPUESTO.jsDecodificadoKb);
    // Si el servidor no comprime, transferSize ≈ decodedBodySize y esto falla.
    expect(m.js.transfer, 'JS transferido (KB)').toBeLessThan(PRESUPUESTO.jsTransferidoKb);
    expect(m.js.transfer, 'el JS debe viajar comprimido').toBeLessThan(m.js.decoded * 0.5);
  });

  test('las features se cargan bajo demanda (lazy): el dashboard trae chunks nuevos', async ({
    page,
    api,
  }) => {
    await api.json('**/api/v1/catalog/products', products);
    const js = new Set<string>();
    page.on('response', (r) => {
      if (r.url().endsWith('.js')) js.add(r.url());
    });
    await page.goto('/catalog');
    await expect(page.getByRole('link', { name: products[0].name })).toBeVisible();
    const inicial = new Set(js);

    await page
      .getByRole('navigation')
      .first()
      .getByRole('link', { name: /Métricas/ })
      .click();
    await expect(page.getByText('Clics último minuto')).toBeVisible();
    const nuevos = [...js].filter((u) => !inicial.has(u));
    expect(nuevos.length, 'el dashboard no debe venir en el bundle inicial').toBeGreaterThan(0);
  });

  test('render de 500 productos y filtrado responden rápido', async ({ page, api }) => {
    const muchos = Array.from({ length: 500 }, (_, i) => ({
      ...products[i % products.length],
      sku: `SKU-${i}`,
      name: `Camiseta ${i}`,
    }));
    await api.json('**/api/v1/catalog/products', muchos);
    const t0 = Date.now();
    await page.goto('/catalog');
    await expect(page.locator('article')).toHaveCount(500, { timeout: 15000 });
    const render = Date.now() - t0;
    test.info().annotations.push({ type: 'render 500 (ms)', description: String(render) });
    console.log(`[rendimiento] render 500 productos: ${render} ms`);
    expect(render, 'navegación + render de 500 (ms)').toBeLessThan(PRESUPUESTO.renderListaMs);

    const t1 = Date.now();
    await page.getByRole('searchbox').fill('Camiseta 49');
    await expect(page.locator('article')).toHaveCount(11); // 49 y 490-499
    expect(Date.now() - t1, 'filtrar 500 productos (ms)').toBeLessThan(PRESUPUESTO.filtrarMs);
  });
});
