import { Routes } from '@angular/router';
import { CatalogoComponent } from './pages/catalogo/catalogo.component';
import { CarritoComponent } from './pages/carrito/carrito.component';
import { MsalGuard } from '@azure/msal-angular';

export const routes: Routes = [
  { path: 'catalogo', component: CatalogoComponent },
  // Protegemos la ruta del carrito exigiendo login corporativo
  { path: 'carrito', component: CarritoComponent, canActivate: [MsalGuard] },
  { path: '', redirectTo: 'catalogo', pathMatch: 'full' },
  { path: '**', redirectTo: 'catalogo' }
];