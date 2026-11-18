import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

/**
 * Rutas principales. Cada feature se carga lazy. Los guards por rol solo ocultan/evitan
 * navegación: la seguridad real (rol + scope) la aplica el backend.
 */
export const routes: Routes = [
  {
    // Portada pública: la primera página que ve cualquier visitante.
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'catalog',
    // Público: cualquier visitante (sin sesión, Cognito o Entra) puede ver el catálogo.
    loadChildren: () => import('./features/catalog/catalog.routes').then((m) => m.CATALOG_ROUTES),
  },
  {
    path: 'carrito',
    loadChildren: () => import('./features/cart/cart.routes').then((m) => m.CART_ROUTES),
    canActivate: [roleGuard('CUSTOMER')],
  },
  {
    path: 'pedidos',
    loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES),
    canActivate: [roleGuard('CUSTOMER')],
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'perfil',
    loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'pago',
    loadChildren: () => import('./features/pago/pago.routes').then((m) => m.PAGO_ROUTES),
  },
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'sin-permiso',
    loadComponent: () =>
      import('./shared/components/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
  },
  { path: '**', redirectTo: '' },
];
