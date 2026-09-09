import { Routes } from '@angular/router';
import { ProfileComponent } from './profile.component';

/**
 * Rutas del feature de perfil.
 * Cargadas de forma lazy y protegidas con authGuard desde app.routes.ts.
 */
export const PROFILE_ROUTES: Routes = [
  { path: '', component: ProfileComponent },
];
