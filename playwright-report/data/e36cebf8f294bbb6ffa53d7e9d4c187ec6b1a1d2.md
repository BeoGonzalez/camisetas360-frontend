# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: roles.spec.ts >> separación de roles >> "Cerrar sesión" en Mi perfil deja el navegador listo para otra persona
- Location: e2e\roles.spec.ts:118:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('link', { name: 'Mi perfil' })
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" getByRole('link', { name: 'Mi perfil' }) with timeout 5000ms
  - waiting for getByRole('link', { name: 'Mi perfil' })
    14 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - text: Premier League y Serie A 2026/27
      - generic [ref=e6]: · Local, visitante y alternativa
    - navigation [ref=e7]:
      - generic [ref=e8]:
        - link "Camisetas360, ir al álbum" [ref=e9] [cursor=pointer]:
          - /url: /catalog
          - text: CAMISETAS360
        - link "Catálogo" [ref=e11] [cursor=pointer]:
          - /url: /catalog
        - generic [ref=e12]:
          - button "Abrir centro de notificaciones" [ref=e13]
          - link "Iniciar Sesión" [ref=e16] [cursor=pointer]:
            - /url: /auth/login
  - main [ref=e17]:
    - generic [ref=e20]:
      - generic [ref=e21]:
        - heading "Inicia sesión" [level=1] [ref=e22]
        - generic [ref=e24]:
          - tablist "Acceso" [ref=e25]:
            - tab "Iniciar sesión" [selected] [ref=e26]
            - tab "Crear cuenta" [ref=e27]
          - tabpanel "Iniciar sesión" [ref=e28]:
            - generic [ref=e29]:
              - generic [ref=e30]:
                - generic [ref=e31]: Correo electrónico
                - textbox "Correo electrónico" [ref=e32]:
                  - /placeholder: tu@correo.com
              - generic [ref=e33]:
                - generic [ref=e34]: Contraseña
                - textbox "Contraseña" [ref=e35]
              - button "Iniciar sesión" [ref=e36]
            - paragraph [ref=e37]:
              - text: ¿No tienes cuenta?
              - button "Crea una aquí" [ref=e38]
          - generic [ref=e39]: O continúa con
          - button "Microsoft Entra ID" [ref=e42]
          - button "Portal Cognito Hosted UI" [ref=e48]
      - paragraph [ref=e49]: Camisetas360 · AWS Academy Learner Lab · ECS Fargate & Lambda Serverless
  - contentinfo [ref=e51]:
    - generic [ref=e52]:
      - generic [ref=e53]:
        - generic [ref=e54]:
          - heading "El álbum" [level=2] [ref=e55]
          - list [ref=e56]:
            - listitem [ref=e57]:
              - link "Todos los equipos" [ref=e58] [cursor=pointer]:
                - /url: /catalog
            - listitem [ref=e59]: Premier League y Serie A 2026/27
            - listitem [ref=e60]: Local, visitante y alternativa
        - generic [ref=e61]:
          - heading "Tu cuenta" [level=2] [ref=e62]
          - list [ref=e63]:
            - listitem [ref=e64]:
              - link "Mi perfil" [ref=e65] [cursor=pointer]:
                - /url: /perfil
            - listitem [ref=e66]:
              - link "Mis pedidos" [ref=e67] [cursor=pointer]:
                - /url: /pedidos
            - listitem [ref=e68]:
              - link "Carrito" [ref=e69] [cursor=pointer]:
                - /url: /carrito
        - generic [ref=e70]:
          - heading "El proyecto" [level=2] [ref=e71]
          - paragraph [ref=e72]: "Proyecto académico en AWS Academy. No se venden camisetas reales: los pagos usan una pasarela Webpay simulada con tarjetas de prueba."
      - paragraph [aria-hidden] [ref=e73]: CAMISETAS360
      - generic [ref=e74]:
        - generic [ref=e75]: © 2026 Camisetas360
        - generic [ref=e76]: Temporada 2026/27
```

# Test source

```ts
  35  | 
  36  |     await page.goto('/catalog');
  37  |     await expect(page.getByRole('link', { name: products[0].name })).toBeVisible();
  38  |     const nav = page.getByRole('navigation').first();
  39  |     await expect(nav.getByRole('link', { name: /Carrito/ })).toHaveCount(0);
  40  |     await expect(nav.getByRole('link', { name: /Métricas/ })).toBeVisible();
  41  |     // Sin rol CUSTOMER tampoco se ofrece agregar al carrito.
  42  |     await expect(page.getByRole('button', { name: /^Añadir .* al carrito$/ })).toHaveCount(0);
  43  | 
  44  |     for (const ruta of ['/carrito', '/pedidos', '/pago/checkout']) {
  45  |       await page.goto(ruta);
  46  |       await expect(page, `ADMIN no debe entrar a ${ruta}`).toHaveURL(/\/sin-permiso$/);
  47  |     }
  48  |   });
  49  | 
  50  |   test('CATALOG_MANAGER: entra al dashboard pero no a las alertas de fraude (solo ADMIN)', async ({
  51  |     page,
  52  |     api,
  53  |   }) => {
  54  |     await iniciarSesion(page, ['CATALOG_MANAGER']);
  55  |     await api.json('**/api/v1/analytics/metricas', metricas);
  56  | 
  57  |     await page.goto('/admin/metricas');
  58  |     await expect(page.getByText('Clics último minuto')).toBeVisible();
  59  |     await expect(page.getByRole('link', { name: /Alertas de fraude/ })).toHaveCount(0);
  60  | 
  61  |     await page.goto('/pago/alertas');
  62  |     await expect(page).toHaveURL(/\/sin-permiso$/);
  63  |   });
  64  | 
  65  |   test('sin sesión: ve las camisetas; "Comprar" obliga a crear cuenta y vuelve a la camiseta', async ({
  66  |     page,
  67  |     api,
  68  |   }) => {
  69  |     await api.json('**/api/v1/catalog/products', products);
  70  |     await api.json('**/api/v1/catalog/products/CAM-001', products[0]);
  71  |     let registro: Record<string, unknown> | undefined;
  72  |     await api.handle('**/api/v1/auth/cognito/register', (route) => {
  73  |       registro = route.request().postDataJSON();
  74  |       return route.fulfill({
  75  |         headers: CORS,
  76  |         json: {
  77  |           accessToken: 'nuevo-token',
  78  |           idToken: 'nuevo-id',
  79  |           user: {
  80  |             username: 'ana@x.com',
  81  |             email: 'ana@x.com',
  82  |             name: 'Ana',
  83  |             sub: 'sub-ana',
  84  |             roles: ['CUSTOMER'],
  85  |           },
  86  |         },
  87  |       });
  88  |     });
  89  |     await api.json('**/api/v1/carrito', CARRITO_VACIO);
  90  |     await api.json('**/api/v1/recomendaciones', RECOS_VACIAS);
  91  |     await api.json('**/api/v1/analytics/recomendaciones', {
  92  |       items: [],
  93  |       perfil: {},
  94  |       generadoEn: null,
  95  |     });
  96  | 
  97  |     await page.goto('/catalog');
  98  |     await expect(page.getByRole('link', { name: products[0].name })).toBeVisible();
  99  |     await expect(page.getByRole('button', { name: /^Añadir .* al carrito$/ })).toHaveCount(0);
  100 |     await page.getByRole('button', { name: `Comprar ${products[0].name}` }).click();
  101 | 
  102 |     await expect(page).toHaveURL(/\/auth\/login\?returnUrl=%2Fcatalog%2FCAM-001&motivo=comprar$/);
  103 |     await expect(page.getByText('Para comprar necesitas una cuenta.')).toBeVisible();
  104 |     await expect(page.getByRole('button', { name: 'Microsoft Entra ID' })).toBeVisible();
  105 | 
  106 |     await page.getByRole('tab', { name: 'Crear cuenta' }).click();
  107 |     await page.getByLabel('Nombre').fill('Ana');
  108 |     await page.getByLabel('Correo electrónico').fill('ana@x.com');
  109 |     await page.getByLabel('Contraseña', { exact: true }).fill('Secreta1!');
  110 |     await page.getByLabel('Repite la contraseña').fill('Secreta1!');
  111 |     await page.getByRole('button', { name: 'Crear cuenta', exact: true }).last().click();
  112 | 
  113 |     await expect(page).toHaveURL(/\/catalog\/CAM-001$/);
  114 |     await expect(page.getByRole('button', { name: 'Añadir al carrito' })).toBeVisible();
  115 |     expect(registro).toMatchObject({ email: 'ana@x.com', name: 'Ana', action: 'register' });
  116 |   });
  117 | 
  118 |   test('"Cerrar sesión" en Mi perfil deja el navegador listo para otra persona', async ({
  119 |     page,
  120 |     api,
  121 |   }) => {
  122 |     await iniciarSesion(page, ['CUSTOMER']);
  123 |     await api.json('**/api/v1/carrito', CARRITO_VACIO);
  124 | 
  125 |     await page.goto('/perfil');
  126 |     await expect(page.getByText('e2e@camisetas360.test').first()).toBeVisible();
  127 |     await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  128 | 
  129 |     await expect(page).toHaveURL(/\/auth\/login$/);
  130 |     await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toBeVisible();
  131 |     expect(await page.evaluate(() => localStorage.getItem('c360_cognito_session'))).toBeNull();
  132 | 
  133 |     // La barra ya no muestra al usuario anterior ni su carrito. (No se recarga: iniciarSesion
  134 |     // usa addInitScript y reinyectaría la sesión en cada navegación.)
> 135 |     await expect(page.getByRole('link', { name: 'Mi perfil' })).toHaveCount(0);
      |                                                                 ^ Error: expect(locator).toHaveCount(expected) failed
  136 |     await expect(page.getByRole('button', { name: 'Salir' })).toHaveCount(0);
  137 |   });
  138 | 
  139 |   test('sin sesión: una ruta protegida redirige al login conservando returnUrl', async ({
  140 |     page,
  141 |     api,
  142 |   }) => {
  143 |     expect(api.noSimuladas).toEqual([]); // el fixture verifica que no se llame a la API
  144 |     await page.goto('/carrito');
  145 |     await expect(page).toHaveURL(/\/auth\/login\?returnUrl=%2Fcarrito$/);
  146 |   });
  147 | });
  148 | 
```