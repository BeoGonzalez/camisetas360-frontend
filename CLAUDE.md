# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

Gestor de paquetes: **pnpm** (`packageManager: pnpm@10.30.3`, Node 22).

```bash
pnpm install
pnpm start                 # ng serve (development -> environment.ts, backend en AWS)
pnpm start:local           # ng serve --configuration local: backend de docker compose vía proxy.conf.json
pnpm run build             # build de producción (environment.prod.ts)
pnpm test                  # Vitest una vez (ng test --watch=false); pnpm test:watch para modo watch
pnpm test:coverage         # con cobertura; falla bajo los umbrales de angular.json (trinquete)
pnpm ng test --watch=false --include src/app/core/services/cart.service.spec.ts   # un solo archivo
pnpm format:check          # Prettier (no hay ESLint / ng lint)
pnpm e2e                   # Playwright herméticos (levanta start:local en :4201 y el build en :4300)
pnpm e2e:rendimiento       # CWV + budget de JS sobre el build de producción (scripts/serve-dist.mjs)
pnpm e2e:backend           # e2e/pago.spec.ts (@backend) contra ms-pagos real
bash scripts/smoke-image.sh <imagen>   # salud de la imagen Docker (CI lo corre antes del push)
```

- No uses `pnpm test -- --watch=false`: el `--` extra rompe la validación del schema.
- `start`/`build`/`test` corren antes `scripts/write-env.mjs` (genera `src/environments/env.generated.ts`, gitignored, desde `.env` + variables de entorno). Si usas `pnpm ng ...` directo, corre antes `pnpm env:write`.
- Tests con globals de Vitest y `HttpTestingController`; `vi.mock` funciona (ver `metricas.service.spec.ts`). Con fake timers, `timer(0)` de RxJS necesita `vi.advanceTimersByTime(1)`.
- No pongas `expect` dentro de `subscribe(...)`: si el observable no emite, el test pasa igual. Captura el valor en una variable y asierta después del `flush`.
- El build de producción excede el budget `initial` de 500 kB (warning preexistente, ~714 kB); el TBT medido (~350-400 ms con CPU 4x) es deuda ligada a eso.
- E2E: usa `test`/`iniciarSesion` de `e2e/fixtures.ts`. El fixture falla el test ante cualquier `/api/v1/*` no simulado (`api.json`/`api.handle`) y ante errores de consola o excepciones. Datos compartidos en `e2e/support/datos.ts`.
- `e2e/pago.spec.ts` (tag `@backend`) pega contra el `ms-pagos` real y no corre por defecto ni en CI.
- Pago con Webpay Plus real: el formulario no pide tarjeta. `PagoService.iniciarWebpay` (`POST /pago/webpay/iniciar` con `{ordenId, monto}`) y `redirigirAWebpay(url, token)` (form POST con `token_ws`); la tarjeta se ingresa en Transbank y el backend vuelve a `/pago/resultado?estado=APROBADO|RECHAZADO&pagoId&ordenId` (ruta pública). En e2e herméticos Webpay se simula con `page.route` sobre la `url` devuelta (`e2e/webpay.spec.ts`, `flujo-compra.spec.ts`); `pago.spec.ts` @backend verifica el POST a Transbank pero no completa el pago allá.
- Antifraude: el 429 / `BLOQUEADO_FRAUDE` de ms-pagos sigue mapeado en `PagoService` (`segundosParaReintentar`, `Retry-After`, `desbloqueoEn`) y `/pago/resultado` muestra el aviso si el pago está `BLOQUEADO_FRAUDE`; el formulario ya no gestiona el bloqueo.
- Cognito (pool `us-east-1_SmfKHFzMK`, client `12dth99ppcslnukovavrpvg6pb`, dominio `camisetas360-471112640065`): el login/registro del formulario va a la Lambda `camisetas360-cognito-login` (`POST /api/v1/auth/cognito/{login,register}` en el HTTP API del backend `xzaze5dfn5`).
- AWS: el SPA se sirve por el HTTP API del frontend `eabppt8xv5` (`GET /` y `GET /{proxy+}` → VPC Link → listener 80 del NLB interno `camisetas360-nlb` → target group `c360-frontend`). El backend `xzaze5dfn5` llega a cada microservicio por el mismo VPC Link (listeners 8080-8087). El API del frontend también expone `ANY /api/v1/<prefijo>[/{proxy+}]` hacia cada servicio (mismo origen; lo usa el retorno de Webpay, `WEBPAY_RETURN_URL` de pagos). Las rutas protegidas de ambos API usan el authorizer Lambda `camisetas360-authorizer` (`deploy/authorizer/index.mjs`), que acepta tokens de Cognito y de Entra ID. En local, `proxy.conf.json` manda `/api/v1/auth/cognito` a AWS y el resto de `/api/v1/*` al docker compose. El Hosted UI usa authorization code + PKCE (`CognitoAuthService.urlHostedUi`/`completarHostedUi`, state en sessionStorage). Mientras no haya backend en AWS, `pnpm start` (NG_APP_API_BASE_URL) no tiene catálogo: usa `pnpm start:local --port 4201`.
- En local el puerto 4200 suele estar ocupado por el contenedor `app-frontend` del backend: usa `--port 4201` (el entorno local toma `window.location.origin` como base).

## Arquitectura

Angular 22 standalone, Signals, Tailwind 4, sin librería de UI, templates inline. Rutas lazy en `app.routes.ts`, en español (`/` portada estática sin llamadas al backend, `/catalog`, `/carrito`, `/pedidos`, `/pago`, `/perfil`, `/admin/productos`, `/admin/metricas`, `/sin-permiso`).

### Capa de red (`core/`)
- **Una sola base**: toda URL es `environment.apiGateway + environment.endpoints.<x>` (`{API_BASE}`). Nunca hosts/puertos de microservicios en código. En local, `proxy.conf.json` enruta cada prefijo `/api/v1/*` a su puerto de docker compose.
- Los servicios devuelven los DTO **tal cual el backend** (campos en español: `precioUnitario`, `ordenId`...) y mapean errores con `toApiError` (`core/http/api-error.ts`: 400 validation, 401, 403, 404, 422 business, 429, 0/5xx retryable). Las pantallas muestran errores con `<app-api-error>` (reintento manual solo si `retryable`). `PagoService` mantiene su propio `PagoError` (429 = `BLOQUEADO_FRAUDE`).
- El carrito vive en el backend; `CartService` (core) es un espejo del último `CartDTO`. No hay PUT de cantidad: subir = POST con la diferencia, bajar = DELETE + POST. Tras el 202, `checkout()` relee `GET /carrito` y borra los ítems comprados que el backend haya dejado.
- Checkout asíncrono: `CheckoutTrackerService` toma la línea base de `/orders`, hace checkout (202 con `requestId`) y hace polling cada 2 s hasta ~30 s (`environment.ordersPolling`) hasta correlacionar el pedido nuevo (`OrdersService.matchNewOrder`). Guarda en `localStorage['c360_compras']` solo ids y montos.
- **SUPUESTO de pagos**: `ms-pagos` exige `ordenId` UUID y orders usa `orderId` Long, sin relación en el backend. Se paga con el `requestId` del checkout; el único punto de decisión es `CheckoutTrackerService.ordenIdParaPago` + `environment.pagos.ordenIdFuente`. El formulario de pago solo acepta compras registradas (no genera UUIDs ni lee el monto de la URL).
- Datos de tarjeta: PAN/CVV se limpian del formulario apenas se arma la solicitud; nunca a estado global, storage, errores ni consola. `tarjetaHash` de alertas no se muestra.
- Métricas: `MetricasService` usa STOMP (`@stomp/stompjs`) sobre `environment.wsBase + /ws/metricas` solo en local (token en el frame CONNECT); en AWS, telemetría de API Gateway WebSocket (`environment.telemetriaWsUrl?token=`, mensajes `productos.actualizados` reemplazados por sku, renovación antes de 2 h). Sin socket: polling a `GET /analytics/metricas` cada 5 s.
- Gestión de camisetas (`/admin/productos`, `ProductosAdminComponent` + `ProductoFormComponent`, rol CATALOG_MANAGER o ADMIN): `ProductAdminService` hace POST/PUT/DELETE `/catalog/products[/{sku}]` y PUT/DELETE `/{sku}/imagen` (bytes crudos, JPG/PNG/WebP, máx. 2 MB; 409 = SKU duplicado). Cada camiseta (equipo + `kitType` LOCAL/VISITANTE/ALTERNATIVA) es un producto con su SKU, stock y foto; el SKU no se edita. Las fotos se leen con `<app-product-image>` (HttpClient → blob → object URL, porque el endpoint exige Bearer) y `?v={imageVersion}`; `imageVersion` null = sin foto. Si no hay foto en el backend (o falla) y se pasan `team`/`kitType` (catálogo y detalle; admin no, para mostrar el estado real), usa la foto estática `public/camisetas/{claveEquipo}-{local|visitante|alternativa}.avif` registrada en `EQUIPOS_CON_FOTOS` (`shared/components/product-image/kit-photos.ts`). Escudos: `public/logos/` + `TEAM_LOGOS`; colores de club: `shared/utils/team-colors.ts` (`claveEquipo` = slug + alias).
- Errores: `toApiError` nunca muestra el texto crudo del backend (queda en `ApiError.detail`); 503 = `unavailable`.

### Autenticación (dos mecanismos conviviendo, por decisión del usuario)
1. **MSAL / Entra ID** (`app.config.ts`): `protectedResourceMap` se arma desde `core/auth/api-scopes.ts` (`SCOPE_POR_ENDPOINT`, prefijo exacto + `/*`): auth→Profile.Read, catalog, recomendaciones y analytics→Catalog.Read, carrito y pago→Checkout.Create, orders→Orders.Read, notifications→Notifications.Send.
2. **Cognito vía Lambda** (`CognitoAuthService`, sesión en `localStorage['c360_cognito_session']`). `AuthInterceptor` pone su Bearer primero; `MsalUnlessAuthorizedInterceptor` envuelve a `MsalInterceptor` y lo omite si ya hay `Authorization` o si no hay cuenta Entra (sin eso, MSAL sin cuenta intenta un login y deja la petición colgada).
- **Catálogo público**: `/catalog` y `/catalog/:sku` no tienen guard y el ms catalog permite `GET /api/v1/catalog/**` sin token (los tokens que no son de Entra se ignoran en esas lecturas; el detalle anónimo no registra visita). Visitantes ven el botón "Comprar", que lleva a `/auth/login?returnUrl=/catalog/<sku>&motivo=comprar`. El login (`LoginComponent`) tiene pestañas Iniciar sesión / Crear cuenta (Cognito vía Lambda, `action: register`, grupo CUSTOMER) más Microsoft Entra ID (`AuthService.login(returnUrl)` → `redirectStartPage`); `returnUrl` pasa por `rutaSegura` (solo rutas internas, nunca `/auth`). Escrituras siguen exigiendo Entra + CATALOG_MANAGER/ADMIN.
- `unauthorizedInterceptor` (funcional): 401 de `{API_BASE}` → con cuenta Entra, `acquireTokenSilent({forceRefresh})` y reintento único; si falla, `acquireTokenRedirect`. Cognito/sin cuenta → `/auth/login?returnUrl`.
- `AuthService` unifica roles (claim `roles` de Entra o roles Cognito): `isCustomer`, `isAdmin`, `canSeeMetrics`, `hasAnyRole`. `roleGuard(...roles)` → `/auth/login` sin sesión, `/sin-permiso` sin rol. `GET /auth/profile` se llama una vez tras el login (`syncProfileOnce`, cacheado).
- Los tests e2e simulan sesión Cognito escribiendo en localStorage.

### Entornos y despliegue
- `environment.ts` (dev → AWS), `environment.prod.ts` (prod), `environment.local.ts` (docker compose; `ng serve -c local`). Lo común está en `environments/shared.ts`; Entra y URLs salen de `env.generated.ts` (variables `NG_APP_*`, ver `.env.example`), nunca hardcodeadas. Cognito sigue en los environments. Docker recibe las `NG_APP_*` como `--build-arg` (CI: `vars.NG_APP_*`).
- `Dockerfile` construye con pnpm y sirve `dist/camisetas360-frontend/browser` con nginx (`nginx.conf`: fallback SPA, `/health`, proxy local `/api/v1/pago/`).
- CI `.github/workflows/deploy-ecr.yml`: job `test` (pnpm install, `pnpm test`, build) en PRs y pushes a `main`; `build-and-deploy` (ECR + nueva task definition ECS Fargate) solo en push/dispatch y tras `test`. Credenciales temporales de AWS Learner Lab en secrets.

## Convenciones
- Prettier: `printWidth: 100`, `singleQuote: true`.
- No inventar endpoints ni datos de respaldo (fallbacks "resilientes" con datos falsos fueron eliminados a propósito).
- La navegación oculta lo que el rol no puede usar, pero la autorización real es del backend.
