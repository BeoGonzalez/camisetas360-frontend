import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AppRole } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

/**
 * Guard por rol (claim `roles` de Entra o roles de la sesión Cognito).
 * Sin sesión -> /auth/login; con sesión sin rol -> /sin-permiso.
 * Es solo UX: la autorización real la hace el backend (rol + scope).
 */
export function roleGuard(...roles: AppRole[]): CanActivateFn {
  return (_route, state): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) {
      return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state?.url } });
    }
    return auth.hasAnyRole(roles) ? true : router.createUrlTree(['/sin-permiso']);
  };
}
