import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'productos', pathMatch: 'full' },
  {
    path: 'productos',
    canActivate: [roleGuard('ADMIN', 'CATALOG_MANAGER')],
    loadComponent: () =>
      import('./productos-admin.component').then((m) => m.ProductosAdminComponent),
  },
  {
    path: 'metricas',
    canActivate: [roleGuard('ADMIN', 'CATALOG_MANAGER')],
    loadComponent: () =>
      import('./metricas-dashboard.component').then((m) => m.MetricasDashboardComponent),
  },
];
