import { Routes } from '@angular/router';

/** Mis pedidos (lazy; protegido con roleGuard('CUSTOMER') desde app.routes.ts). */
export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./orders-list.component').then((m) => m.OrdersListComponent),
  },
  {
    path: 'compra/:requestId',
    loadComponent: () =>
      import('./checkout-status.component').then((m) => m.CheckoutStatusComponent),
  },
  {
    path: ':orderId',
    loadComponent: () => import('./order-detail.component').then((m) => m.OrderDetailComponent),
  },
];
