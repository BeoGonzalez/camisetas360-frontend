# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rendimiento.spec.ts >> rendimiento (build de producción) >> carga inicial de /catalog dentro de Core Web Vitals y del budget de JS
- Location: e2e\rendimiento.spec.ts:89:3

# Error details

```
Error: TBT (ms)

expect(received).toBeLessThan(expected)

Expected: < 600
Received:   728
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - text: Premier League 2026/27
      - generic [ref=e6]: · Local, visitante y alternativa
    - navigation [ref=e7]:
      - generic [ref=e8]:
        - link "Camisetas360, ir al álbum" [ref=e9] [cursor=pointer]:
          - /url: /catalog
          - text: CAMISETAS360
        - generic [ref=e10]:
          - link "Catálogo" [ref=e11] [cursor=pointer]:
            - /url: /catalog
          - link "Mis pedidos" [ref=e12] [cursor=pointer]:
            - /url: /pedidos
          - link "Productos" [ref=e13] [cursor=pointer]:
            - /url: /admin/productos
          - link "Métricas" [ref=e14] [cursor=pointer]:
            - /url: /admin/metricas
          - link "Alertas Antifraude" [ref=e15] [cursor=pointer]:
            - /url: /pago/alertas
          - link "Mi Perfil" [ref=e16] [cursor=pointer]:
            - /url: /perfil
        - generic [ref=e17]:
          - button "Abrir centro de notificaciones" [ref=e18]
          - link "Carrito 0" [ref=e22] [cursor=pointer]:
            - /url: /carrito
            - generic [ref=e23]: Carrito
            - generic [ref=e24]: "0"
          - generic [aria-hidden] [ref=e25]: UE
          - button "Salir" [ref=e26]
  - main [ref=e27]:
    - generic [ref=e28]:
      - generic [ref=e29]:
        - complementary [ref=e30]:
          - heading "Álbum de camisetas" [level=1] [ref=e31]
          - paragraph [ref=e32]: 2 camisetas · 0 equipos
          - search [ref=e33]:
            - generic [ref=e34]:
              - text: Buscar
              - searchbox "Buscar" [ref=e35]
          - navigation "Índice de equipos" [ref=e36]:
            - list [ref=e37]:
              - listitem [ref=e38]:
                - button "Otras camisetas 001–002" [ref=e39]:
                  - generic [ref=e40]: Otras camisetas
                  - generic [ref=e41]: 001–002
        - generic [ref=e43]:
          - generic [ref=e44]:
            - heading "Otras camisetas" [level=2] [ref=e45]
            - paragraph [ref=e46]: Sin liga · 2 camisetas
          - generic [ref=e47]:
            - article [ref=e48]:
              - generic [ref=e49]:
                - generic [ref=e50]: "001"
                - img "Imagen no disponible" [ref=e52]
              - generic [ref=e57]:
                - heading "Fútbol" [level=3] [ref=e58]
                - generic [ref=e59]: $39.990
              - link "Camiseta Titular 2026 Edición Oficial de Local" [ref=e60] [cursor=pointer]:
                - /url: /catalog/CAM-001
              - paragraph [ref=e61]: 100 disponibles · CAM-001
              - button "Añadir Camiseta Titular 2026 Edición Oficial de Local al carrito" [ref=e63]: Añadir
            - article [ref=e64]:
              - generic [ref=e65]:
                - generic [ref=e66]: "002"
                - img "Imagen no disponible" [ref=e68]
              - generic [ref=e73]:
                - heading "Fútbol" [level=3] [ref=e74]
                - generic [ref=e75]: $39.990
              - link "Camiseta Visitante 2026" [ref=e76] [cursor=pointer]:
                - /url: /catalog/CAM-002
              - paragraph [ref=e77]: Agotada · CAM-002
              - button "Añadir Camiseta Visitante 2026 al carrito" [disabled] [ref=e79]: Agotado
      - generic "Recomendado para ti" [ref=e80]:
        - region "Recomendado para ti" [ref=e81]:
          - generic [ref=e82]:
            - heading "Recomendado para ti" [level=2] [ref=e84]
            - button "Actualizar" [ref=e85]
          - paragraph [ref=e86]: Aún no tenemos recomendaciones para ti. Explora el catálogo y las iremos ajustando a tus gustos.
  - contentinfo [ref=e88]:
    - generic [ref=e89]:
      - generic [ref=e90]:
        - generic [ref=e91]:
          - heading "El álbum" [level=2] [ref=e92]
          - list [ref=e93]:
            - listitem [ref=e94]:
              - link "Todos los equipos" [ref=e95] [cursor=pointer]:
                - /url: /catalog
            - listitem [ref=e96]: Premier League 2026/27
            - listitem [ref=e97]: Local, visitante y alternativa
        - generic [ref=e98]:
          - heading "Tu cuenta" [level=2] [ref=e99]
          - list [ref=e100]:
            - listitem [ref=e101]:
              - link "Mi perfil" [ref=e102] [cursor=pointer]:
                - /url: /perfil
            - listitem [ref=e103]:
              - link "Mis pedidos" [ref=e104] [cursor=pointer]:
                - /url: /pedidos
            - listitem [ref=e105]:
              - link "Carrito" [ref=e106] [cursor=pointer]:
                - /url: /carrito
        - generic [ref=e107]:
          - heading "El proyecto" [level=2] [ref=e108]
          - paragraph [ref=e109]: "Proyecto académico en AWS Academy. No se venden camisetas reales: los pagos usan una pasarela Webpay simulada con tarjetas de prueba."
      - paragraph [aria-hidden] [ref=e110]: CAMISETAS360
      - generic [ref=e111]:
        - generic [ref=e112]: © 2026 Camisetas360
        - generic [ref=e113]: Temporada 2026/27
```

# Test source

```ts
  3   | import { CARRITO_VACIO, metricas, products, RECOS_VACIAS } from './support/datos';
  4   | 
  5   | /**
  6   |  * Rendimiento del BUILD DE PRODUCCIÓN (proyecto "rendimiento", servido con gzip como nginx).
  7   |  * Umbrales = "Good" de Core Web Vitals; los de bytes reflejan los budgets de angular.json.
  8   |  * Se aplica throttling de CPU (4x) para acercarse a un teléfono de gama media.
  9   |  */
  10  | const PRESUPUESTO = {
  11  |   lcpMs: 2500,
  12  |   cls: 0.1,
  13  |   /**
  14  |    * Total Blocking Time (suma de duración - 50 ms de las long tasks). Objetivo "Good" < 200 ms;
  15  |    * hoy mide ~330-420 ms con CPU 4x (deuda: bundle inicial de 714 kB > budget de 500 kB). El gate
  16  |    * queda en el límite de "Poor" (600 ms) para frenar regresiones; bajarlo al reducir el bundle.
  17  |    */
  18  |   tbtMs: 600,
  19  |   /** JS transferido (comprimido) en la carga inicial de /catalog. */
  20  |   jsTransferidoKb: 250,
  21  |   /** JS descomprimido: coincide con budget initial maximumError (1 MB) de angular.json. */
  22  |   jsDecodificadoKb: 1024,
  23  |   /**
  24  |    * Navegación + render de 500 tarjetas con CPU 4x: hoy ~2,6 s (no hay virtualización). Gate de
  25  |    * "claramente roto" para no ser intermitente en runners de CI más lentos.
  26  |    */
  27  |   renderListaMs: 5000,
  28  |   /** Filtrar 500 productos ya renderizados (signals + @for con track). */
  29  |   filtrarMs: 1500,
  30  | };
  31  | 
  32  | async function medir(page: Page) {
  33  |   return page.evaluate(
  34  |     () =>
  35  |       new Promise<{
  36  |         lcp: number;
  37  |         cls: number;
  38  |         tbt: number;
  39  |         js: { transfer: number; decoded: number; n: number };
  40  |       }>((resolve) => {
  41  |         let lcp = 0;
  42  |         let cls = 0;
  43  |         let tbt = 0;
  44  |         new PerformanceObserver((l) => {
  45  |           for (const e of l.getEntries()) lcp = e.startTime;
  46  |         }).observe({ type: 'largest-contentful-paint', buffered: true });
  47  |         new PerformanceObserver((l) => {
  48  |           for (const e of l.getEntries() as (PerformanceEntry & {
  49  |             value: number;
  50  |             hadRecentInput: boolean;
  51  |           })[])
  52  |             if (!e.hadRecentInput) cls += e.value;
  53  |         }).observe({ type: 'layout-shift', buffered: true });
  54  |         new PerformanceObserver((l) => {
  55  |           for (const e of l.getEntries()) tbt += Math.max(0, e.duration - 50);
  56  |         }).observe({ type: 'longtask', buffered: true });
  57  |         setTimeout(() => {
  58  |           const js = (
  59  |             performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  60  |           ).filter((r) => r.initiatorType === 'script' || r.name.endsWith('.js'));
  61  |           resolve({
  62  |             lcp,
  63  |             cls,
  64  |             tbt,
  65  |             js: {
  66  |               transfer: js.reduce((s, r) => s + r.transferSize, 0) / 1024,
  67  |               decoded: js.reduce((s, r) => s + r.decodedBodySize, 0) / 1024,
  68  |               n: js.length,
  69  |             },
  70  |           });
  71  |         }, 1000);
  72  |       }),
  73  |   );
  74  | }
  75  | 
  76  | test.describe('rendimiento (build de producción)', () => {
  77  |   // En serie: workers en paralelo compiten por CPU y falsean las mediciones.
  78  |   test.describe.configure({ mode: 'serial' });
  79  | 
  80  |   test.beforeEach(async ({ page, api }) => {
  81  |     await iniciarSesion(page, ['CUSTOMER', 'ADMIN']);
  82  |     await api.json('**/api/v1/carrito', CARRITO_VACIO);
  83  |     await api.json('**/api/v1/recomendaciones', RECOS_VACIAS);
  84  |     await api.json('**/api/v1/analytics/metricas', metricas);
  85  |     const cdp = await page.context().newCDPSession(page);
  86  |     await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  87  |   });
  88  | 
  89  |   test('carga inicial de /catalog dentro de Core Web Vitals y del budget de JS', async ({
  90  |     page,
  91  |     api,
  92  |   }) => {
  93  |     await api.json('**/api/v1/catalog/products', products);
  94  |     await page.goto('/catalog', { waitUntil: 'load' });
  95  |     await expect(page.getByRole('link', { name: products[0].name })).toBeVisible();
  96  |     const m = await medir(page);
  97  |     test.info().annotations.push({ type: 'métricas', description: JSON.stringify(m) });
  98  |     console.log(`[rendimiento] /catalog ${JSON.stringify(m)}`);
  99  | 
  100 |     expect(m.lcp, 'LCP (ms)').toBeGreaterThan(0);
  101 |     expect(m.lcp, 'LCP (ms)').toBeLessThan(PRESUPUESTO.lcpMs);
  102 |     expect(m.cls, 'CLS').toBeLessThan(PRESUPUESTO.cls);
> 103 |     expect(m.tbt, 'TBT (ms)').toBeLessThan(PRESUPUESTO.tbtMs);
      |                               ^ Error: TBT (ms)
  104 |     expect(m.js.decoded, 'JS descomprimido (KB)').toBeLessThan(PRESUPUESTO.jsDecodificadoKb);
  105 |     // Si el servidor no comprime, transferSize ≈ decodedBodySize y esto falla.
  106 |     expect(m.js.transfer, 'JS transferido (KB)').toBeLessThan(PRESUPUESTO.jsTransferidoKb);
  107 |     expect(m.js.transfer, 'el JS debe viajar comprimido').toBeLessThan(m.js.decoded * 0.5);
  108 |   });
  109 | 
  110 |   test('las features se cargan bajo demanda (lazy): el dashboard trae chunks nuevos', async ({
  111 |     page,
  112 |     api,
  113 |   }) => {
  114 |     await api.json('**/api/v1/catalog/products', products);
  115 |     const js = new Set<string>();
  116 |     page.on('response', (r) => {
  117 |       if (r.url().endsWith('.js')) js.add(r.url());
  118 |     });
  119 |     await page.goto('/catalog');
  120 |     await expect(page.getByRole('link', { name: products[0].name })).toBeVisible();
  121 |     const inicial = new Set(js);
  122 | 
  123 |     await page
  124 |       .getByRole('navigation')
  125 |       .first()
  126 |       .getByRole('link', { name: /Métricas/ })
  127 |       .click();
  128 |     await expect(page.getByText('Clics último minuto')).toBeVisible();
  129 |     const nuevos = [...js].filter((u) => !inicial.has(u));
  130 |     expect(nuevos.length, 'el dashboard no debe venir en el bundle inicial').toBeGreaterThan(0);
  131 |   });
  132 | 
  133 |   test('render de 500 productos y filtrado responden rápido', async ({ page, api }) => {
  134 |     const muchos = Array.from({ length: 500 }, (_, i) => ({
  135 |       ...products[i % products.length],
  136 |       sku: `SKU-${i}`,
  137 |       name: `Camiseta ${i}`,
  138 |     }));
  139 |     await api.json('**/api/v1/catalog/products', muchos);
  140 |     const t0 = Date.now();
  141 |     await page.goto('/catalog');
  142 |     await expect(page.locator('article')).toHaveCount(500, { timeout: 15000 });
  143 |     const render = Date.now() - t0;
  144 |     test.info().annotations.push({ type: 'render 500 (ms)', description: String(render) });
  145 |     console.log(`[rendimiento] render 500 productos: ${render} ms`);
  146 |     expect(render, 'navegación + render de 500 (ms)').toBeLessThan(PRESUPUESTO.renderListaMs);
  147 | 
  148 |     const t1 = Date.now();
  149 |     await page.getByRole('searchbox').fill('Camiseta 49');
  150 |     await expect(page.locator('article')).toHaveCount(11); // 49 y 490-499
  151 |     expect(Date.now() - t1, 'filtrar 500 productos (ms)').toBeLessThan(PRESUPUESTO.filtrarMs);
  152 |   });
  153 | });
  154 | 
```