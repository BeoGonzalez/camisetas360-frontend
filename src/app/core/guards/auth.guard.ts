import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { CognitoAuthService } from '../services/cognito-auth.service';

/**
 * Guard funcional que protege rutas que requieren autenticación.
 * Acepta cuenta activa de MSAL (Entra ID) o sesión Cognito; si no hay, redirige al login.
 */
export const authGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const msalService = inject(MsalService);
  const cognitoAuth = inject(CognitoAuthService);
  const router = inject(Router);

  if (msalService.instance.getActiveAccount() || cognitoAuth.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state?.url } });
};
