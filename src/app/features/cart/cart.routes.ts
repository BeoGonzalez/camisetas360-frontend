import { Routes } from '@angular/router';
import { CartComponent } from './cart.component';

/**
 * Rutas del feature de carrito.
 * Cargadas de forma lazy y protegidas con authGuard desde app.routes.ts.
 */
export const CART_ROUTES: Routes = [
  { path: '', component: CartComponent },
];
