import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';

/**
 * Guard funcional que protege rutas que requieren autenticación.
 *
 * Verifica si existe una cuenta activa en MSAL:
 * - Si hay cuenta activa → permite el acceso.
 * - Si no hay cuenta → redirige a la página de login.
 */
export const authGuard: CanActivateFn = () => {
  const msalService = inject(MsalService);
  const router = inject(Router);

  const activeAccount = msalService.instance.getActiveAccount();

  if (activeAccount) {
    return true;
  }

  // Redirigir al login si no hay sesión activa
  return router.createUrlTree(['/auth/login']);
};
