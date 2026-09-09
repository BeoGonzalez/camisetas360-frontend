import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { environment } from '../../../environments/environment';
import { from, switchMap, catchError, of } from 'rxjs';

/**
 * Interceptor funcional que inyecta el token JWT (Bearer Token)
 * en las cabeceras de peticiones dirigidas al API Gateway.
 *
 * Flujo:
 * 1. Verifica si la URL de la petición apunta al API Gateway configurado.
 * 2. Si es una ruta protegida, obtiene el token vía MSAL (acquireTokenSilent).
 * 3. Clona la petición e inyecta el header `Authorization: Bearer <token>`.
 * 4. Si falla la adquisición silenciosa, deja pasar la petición sin token
 *    (el backend responderá 401 y el flujo de login se activará).
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const msalService = inject(MsalService);

  // Solo interceptar peticiones dirigidas al API Gateway
  if (!req.url.startsWith(environment.apiGateway)) {
    return next(req);
  }

  const activeAccount = msalService.instance.getActiveAccount();

  // Si no hay cuenta activa, dejar pasar sin token
  if (!activeAccount) {
    return next(req);
  }

  // Adquirir token silenciosamente y adjuntarlo al request
  return from(
    msalService.instance.acquireTokenSilent({
      scopes: environment.azure.scopes,
      account: activeAccount,
    })
  ).pipe(
    switchMap((tokenResponse) => {
      const clonedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
        },
      });
      return next(clonedReq);
    }),
    catchError(() => {
      // Si la adquisición silenciosa falla, enviar la petición original
      // El backend responderá 401 y el guard/MSAL manejará el re-login
      console.warn('[JwtInterceptor] No se pudo adquirir token silencioso');
      return next(req);
    })
  );
};
