import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * Rutas principales de la aplicación.
 *
 * Cada feature se carga de forma lazy con loadChildren para optimizar
 * el tamaño del bundle inicial. Las rutas protegidas usan authGuard.
 */
export const routes: Routes = [
  {
    path: 'catalogo',
    loadChildren: () =>
      import('./features/catalog/catalog.routes').then((m) => m.CATALOG_ROUTES),
  },
  {
    path: 'carrito',
    loadChildren: () =>
      import('./features/cart/cart.routes').then((m) => m.CART_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'perfil',
    loadChildren: () =>
      import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
    canActivate: [authGuard],
  },
  { path: '', redirectTo: 'catalogo', pathMatch: 'full' },
  { path: '**', redirectTo: 'catalogo' },
];