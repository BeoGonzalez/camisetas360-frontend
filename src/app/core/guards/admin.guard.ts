import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { CognitoAuthService } from '../services/cognito-auth.service';

/**
 * Guard funcional que restringe el acceso exclusivamente a usuarios con rol ADMIN.
 * Protege vistas sensibles como el panel de alertas antifraude de ms-pago.
 */
export const adminGuard: CanActivateFn = (): boolean | UrlTree => {
  const cognitoAuth = inject(CognitoAuthService);
  const router = inject(Router);

  if (cognitoAuth.isAdmin()) {
    return true;
  }

  // Redirigir al catálogo principal si no cuenta con privilegios de administrador
  return router.createUrlTree(['/catalog']);
};
