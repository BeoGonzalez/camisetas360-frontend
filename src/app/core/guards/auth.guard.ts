import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { CognitoAuthService } from '../services/cognito-auth.service';

/**
 * Guard funcional que protege rutas que requieren autenticación.
 *
 * Verifica si existe una cuenta activa en MSAL (Azure Entra ID)
 * o una sesión autenticada en AWS Cognito:
 * - Si hay sesión activa -> permite el acceso (true).
 * - Si no hay sesión -> redirige a la página de login (UrlTree).
 */
export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const msalService = inject(MsalService);
  const cognitoAuth = inject(CognitoAuthService);
  const router = inject(Router);

  const msalAccount = msalService.instance.getActiveAccount();
  const cognitoLoggedIn = cognitoAuth.isLoggedIn();

  if (msalAccount || cognitoLoggedIn) {
    return true;
  }

  // Redirigir al login si no hay sesión activa
  return router.createUrlTree(['/auth/login']);
};
