# Camisetas360 — Frontend

Frontend de e-commerce para **Camisetas360**, construido con **Angular 22** (Standalone Components), **Tailwind CSS 4** y autenticación corporativa con **Azure Entra ID (MSAL)**.

## Arquitectura

```
src/app/
├── core/               # Modelos, interceptor JWT, auth guard
│   ├── guards/         # authGuard (funcional)
│   ├── interceptors/   # jwtInterceptor (funcional)
│   └── models/         # Product, CartItem, UserProfile
├── features/           # Feature modules (lazy loaded)
│   ├── auth/           # Login + AuthService
│   ├── cart/           # Carrito + CartService (Signals)
│   ├── catalog/        # Catálogo + CatalogService
│   └── profile/        # Perfil protegido
└── shared/             # Navbar, Footer (componentes reutilizables)
```

## Requisitos Previos

- **Node.js** >= 22.x
- **pnpm** >= 10.x (gestor de paquetes)
- **Angular CLI** >= 22.x

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/BeoGonzalez/camisetas360-frontend.git
cd camisetas360-frontend

# Instalar dependencias
pnpm install
```

## Configuración

Angular no lee `.env`: `scripts/write-env.mjs` toma `.env` (y las variables de entorno, que
tienen prioridad) y genera `src/environments/env.generated.ts`, que **no se commitea**. Corre
solo con `pnpm start`, `start:local`, `build` y `test`; a mano: `pnpm env:write`.

```bash
cp .env.example .env   # y completa los valores
```

| Variable | Qué es |
|---|---|
| `NG_APP_ENTRA_CLIENT_ID` | Application (client) ID del registro SPA en Entra |
| `NG_APP_ENTRA_TENANT_ID` | Directory (tenant) ID |
| `NG_APP_API_SCOPE_BASE` | Application ID URI de la API (`api://<id>`); los scopes se piden como `<base>/Catalog.Read`, etc. |
| `NG_APP_API_BASE_URL` | API Gateway HTTP. Vacío = mismo origen (local con proxy) |
| `NG_APP_TELEMETRIA_WS_URL` | API Gateway WebSocket de telemetría (`wss://…/<stage>`). Vacío = polling de métricas cada 5 s |

La redirect URI de MSAL es `<origen>/auth/microsoft/callback` y debe estar registrada en Entra
como *Aplicación de página única* para cada origen desde el que se sirve el SPA.

## Desarrollo Local

### Backend + frontend en local (docker compose)

```bash
# en camisetas360-backend
docker compose up -d

# en este repo
pnpm install
cp .env.example .env          # NG_APP_ENTRA_* y NG_APP_API_SCOPE_BASE (los NG_APP_*_URL no se usan aquí)
pnpm start:local              # → http://localhost:4200
```

`pnpm start:local` usa el proxy de Angular (`proxy.conf.json`): el navegador habla siempre con el
mismo origen (sin CORS) y el dev server reenvía cada prefijo al puerto de su microservicio:

| Prefijo | Puerto |
|---|---|
| `/api/v1/catalog` | 8081 |
| `/api/v1/carrito` | 8082 |
| `/api/v1/auth` | 8083 |
| `/api/v1/orders` | 8084 |
| `/api/v1/notifications` | 8085 |
| `/api/v1/recomendaciones` | 8086 |
| `/api/v1/pago` | 8087 |
| `/api/v1/analytics` y WebSocket `/ws/metricas` (STOMP) | 8089 |

Si el puerto 4200 está ocupado por el contenedor `app-frontend` del backend, usa
`pnpm start:local --port 4201` y registra también `http://localhost:4201/auth/microsoft/callback`
en Entra (si no, el login con Microsoft falla con `AADSTS50011`).

### Frontend contra AWS

```bash
pnpm start          # usa NG_APP_API_BASE_URL y NG_APP_TELEMETRIA_WS_URL de .env
pnpm run build      # build de producción
```

### Testing

| Comando | Qué verifica |
|---|---|
| `pnpm test` / `pnpm test:coverage` | Unitarios (Vitest). Con cobertura falla si baja de los umbrales de `angular.json` |
| `pnpm e2e` | Playwright hermético (API simulada): flujo de compra completo, roles, errores HTTP, 400 px. Falla ante llamadas no simuladas o errores de consola |
| `pnpm e2e:rendimiento` | Build de producción con gzip: LCP, CLS, TBT (CPU 4x), JS transferido/descomprimido, lazy loading |
| `pnpm e2e:backend` | Pagos contra `ms-pagos` real (requiere `docker compose` del backend) |
| `bash scripts/smoke-image.sh <imagen>` | Salud de la imagen: nginx arranca, `/health`, deep links, gzip y caché |

La primera vez: `pnpm exec playwright install chromium`. Para usar Edge en local: `PW_CHANNEL=msedge`.

### Producción (Docker / CI)

El `Dockerfile` recibe las cinco variables como `--build-arg` y falla si falta la configuración
de Entra (`ENV_STRICT=1`). En GitHub Actions se leen de **Settings → Secrets and variables →
Actions → Variables** (`vars.NG_APP_*`); no son secretos (terminan en el bundle del navegador).

```bash
docker build   --build-arg NG_APP_ENTRA_CLIENT_ID=<client-id>   --build-arg NG_APP_ENTRA_TENANT_ID=<tenant-id>   --build-arg NG_APP_API_SCOPE_BASE=api://<api-id>   --build-arg NG_APP_API_BASE_URL=https://<api-gw>.execute-api.us-east-1.amazonaws.com   --build-arg NG_APP_TELEMETRIA_WS_URL=wss://<ws-gw>.execute-api.us-east-1.amazonaws.com/<stage>   -t camisetas360-frontend .
```

## Tecnologías Clave

| Tecnología | Uso |
|---|---|
| Angular 22 | Framework, Standalone Components, Signals |
| Tailwind CSS 4 | Estilos responsive y diseño premium |
| MSAL Angular | Autenticación OAuth2 con Azure Entra ID |
| RxJS | Comunicación HTTP reactiva |
| Angular Signals | Estado reactivo del carrito |

## Endpoints Consumidos

Todas las llamadas usan una única base `{API_BASE}` (`environment.apiGateway`). El usuario lo
determina siempre el token; nunca se envía `userId` en la URL. El backend exige rol **y** scope
(ADMIN no hereda los permisos de CUSTOMER); la UI solo oculta lo que el rol no puede usar.

| Servicio | Endpoints | Rol + scope | Pantalla |
|---|---|---|---|
| auth | `GET /api/v1/auth/profile` | cualquier rol + Profile.Read | Perfil (sincronizado tras el login) |
| catalog | `GET /api/v1/catalog/products[?sku=]`, `GET /products/{sku}` | cualquier rol + Catalog.Read | Catálogo (home), detalle |
| carrito | `GET /carrito`, `POST /items`, `DELETE /items/{sku}`, `PUT /envio`, `POST /checkout` (202) | CUSTOMER + Checkout.Create | Carrito |
| orders | `GET /api/v1/orders`, `GET /orders/{orderId}` | CUSTOMER + Orders.Read | Mis pedidos (polling cada 2 s, ~30 s, tras el checkout) |
| recomendaciones | `GET /api/v1/recomendaciones` | CUSTOMER + Catalog.Read | Home |
| analytics | `GET /analytics/recomendaciones`, `GET /analytics/metricas`, STOMP `/ws/metricas` (local) | CUSTOMER / ADMIN o CATALOG_MANAGER + Catalog.Read | Detalle y perfil; dashboard |
| telemetría | API Gateway WebSocket `?token=` (`productos.actualizados`) | ADMIN o CATALOG_MANAGER | Dashboard en producción |
| pagos | `POST /pago/iniciar` (201/429), `POST /confirmar`, `GET /{id}`, `GET /orden/{ordenId}` | sin auth | Pago, resultado, historial |
| notifications | `POST /api/v1/notifications/email` | ADMIN + Notifications.Send | Centro de notificaciones |

Errores (ProblemDetail): 400 validación, 401 renovar token una vez y si no login, 403 sin
permisos, 404 no encontrado, 429 pago bloqueado por seguridad, 503 servicio no disponible.
Nunca se muestra el detalle crudo del backend.

## Publicación HTTPS en AWS

Consulta [el procedimiento de TLS, CORS y validación](docs/aws-publication.md).
La imagen requiere certificados públicos montados desde el host antes de arrancar.
