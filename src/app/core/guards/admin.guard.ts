import { CanActivateFn } from '@angular/router';
import { roleGuard } from './role.guard';

/** Restringe vistas sensibles (alertas antifraude, correo manual) al rol ADMIN. */
export const adminGuard: CanActivateFn = roleGuard('ADMIN');
