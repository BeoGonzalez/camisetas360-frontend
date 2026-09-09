import { Routes } from '@angular/router';
import { LoginComponent } from './login.component';

/**
 * Rutas del feature de autenticación.
 * Cargadas de forma lazy desde app.routes.ts.
 */
export const AUTH_ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
];
