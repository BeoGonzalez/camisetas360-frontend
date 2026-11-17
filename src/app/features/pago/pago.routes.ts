import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';
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
        (m) => m.FormularioPagoComponent,
      ),
    canActivate: [roleGuard('CUSTOMER')],
  },
  {
    path: 'checkout/:ordenId',
    loadComponent: () =>
      import('./components/formulario-pago/formulario-pago.component').then(
        (m) => m.FormularioPagoComponent,
      ),
    canActivate: [roleGuard('CUSTOMER')],
  },
  {
    path: 'retorno',
    loadComponent: () =>
      import('./components/retorno-pago/retorno-pago.component').then(
        (m) => m.RetornoPagoComponent,
      ),
  },
  {
    path: 'resultado',
    loadComponent: () =>
      import('./components/resultado-pago/resultado-pago.component').then(
        (m) => m.ResultadoPagoComponent,
      ),
  },
  {
    path: 'historial/:ordenId',
    loadComponent: () =>
      import('./components/historial-pagos/historial-pagos.component').then(
        (m) => m.HistorialPagosComponent,
      ),
    canActivate: [roleGuard('CUSTOMER')],
  },
  {
    path: 'alertas',
    loadComponent: () =>
      import('./components/panel-alertas/panel-alertas.component').then(
        (m) => m.PanelAlertasComponent,
      ),
    canActivate: [adminGuard],
  },
];
