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

Editar `src/environments/environment.ts` con tus credenciales:

```typescript
export const environment = {
  production: false,
  apiGateway: 'https://TU-API-GATEWAY.execute-api.us-east-1.amazonaws.com',
  azure: {
    clientId: 'TU_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/TU_TENANT_ID',
    redirectUri: 'http://localhost:4200/',
    scopes: ['api://TU_CLIENT_ID/Cart.Write', 'User.Read'],
  },
};
```

## Desarrollo Local

```bash
# Iniciar servidor de desarrollo
pnpm start
# → http://localhost:4200

# Build de producción
pnpm run build
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

| Servicio | Endpoint | Protegido |
|---|---|---|
| Catálogo | `GET /api/v1/catalog/products` | No |
| Carrito | `POST /api/v1/carrito/checkout` | Sí (JWT) |
| Perfil | `GET /api/v1/auth/profile` | Sí (JWT) |

## Publicación HTTPS en AWS

Consulta [el procedimiento de TLS, CORS y validación](docs/aws-publication.md).
La imagen requiere certificados públicos montados desde el host antes de arrancar.
