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
  const catalogUrl = environment.apiGateway + environment.endpoints.catalog + '/products';
  if (req.method === 'GET' && req.url.split('?')[0] === catalogUrl) {
    return next(req.clone({ headers: req.headers.delete('Authorization') }));
  }
  const msalService = inject(MsalService);

  console.log('[JwtInterceptor] Interceptando petición a:', req.url);
  // Solo interceptar peticiones dirigidas al API Gateway
  if (!req.url.startsWith(environment.apiGateway + "/")) {
    console.log('[JwtInterceptor] URL no es del API Gateway. Pasando petición original.');
    return next(req);
  }

  const activeAccount = msalService.instance.getActiveAccount();

  // Si no hay cuenta activa, dejar pasar sin token
  if (!activeAccount) {
    console.log('[JwtInterceptor] No hay cuenta activa. Pasando petición original sin token.');
    return next(req);
  }

  console.log('[JwtInterceptor] Cuenta activa detectada. Solicitando token...');

  // Adquirir token silenciosamente y adjuntarlo al request
  return from(
    msalService.instance.acquireTokenSilent({
      scopes: environment.azure.scopes,
      account: activeAccount,
    })
  ).pipe(
    // Recuperar solo errores de token, sin repetir peticiones HTTP fallidas.
    catchError(() => of(null)),
    switchMap((tokenResponse) => {
      if (!tokenResponse) return next(req);
      console.log('[JwtInterceptor] Token adquirido exitosamente.');
      const clonedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
        },
      });
      return next(clonedReq);
    })
  );
};
