import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { adminGuard } from '../../core/guards/admin.guard';

export const PAGO_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'checkout',
    pathMatch: 'full',
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('./components/formulario-pago/formulario-pago.component').then(
        (m) => m.FormularioPagoComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'checkout/:ordenId',
    loadComponent: () =>
      import('./components/formulario-pago/formulario-pago.component').then(
        (m) => m.FormularioPagoComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'retorno',
    loadComponent: () =>
      import('./components/retorno-pago/retorno-pago.component').then(
        (m) => m.RetornoPagoComponent
      ),
  },
  {
    path: 'resultado',
    loadComponent: () =>
      import('./components/resultado-pago/resultado-pago.component').then(
        (m) => m.ResultadoPagoComponent
      ),
  },
  {
    path: 'historial/:ordenId',
    loadComponent: () =>
      import('./components/historial-pagos/historial-pagos.component').then(
        (m) => m.HistorialPagosComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'alertas',
    loadComponent: () =>
      import('./components/panel-alertas/panel-alertas.component').then(
        (m) => m.PanelAlertasComponent
      ),
    canActivate: [authGuard, adminGuard],
  },
];
