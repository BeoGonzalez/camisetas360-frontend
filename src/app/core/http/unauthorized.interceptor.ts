import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { esUrlDeApi, scopesForUrl } from '../auth/api-scopes';
import { CognitoAuthService } from '../services/cognito-auth.service';

/** Marca la petición ya reintentada con un token renovado (se reintenta una sola vez). */
const REINTENTADA = new HttpContextToken<boolean>(() => false);

let reauthInProgress = false;

/** Solo para tests. */
export function resetReauthState(): void {
  reauthInProgress = false;
}

/**
 * 401 de {API_BASE} => el access token ya no sirve (expirado/revocado).
 *
 * 1. Sesión Entra: se fuerza la renovación silenciosa del token del scope de esa URL
 *    (`acquireTokenSilent({ forceRefresh: true })`) y se reintenta la petición UNA vez.
 * 2. Si la renovación falla (p. ej. InteractionRequiredAuthError) o el reintento vuelve a dar
 *    401: `acquireTokenRedirect` (Entra) o `/auth/login?returnUrl` (Cognito o sin sesión;
 *    la sesión Cognito vía Lambda no tiene renovación).
 *
 * El error se propaga igualmente para que la pantalla deje su estado de carga.
 */
export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const msal = inject(MsalService);
  const router = inject(Router);
  const cognito = inject(CognitoAuthService);

  const reautenticar = (scopes: string[] | null) => {
    if (reauthInProgress) return;
    reauthInProgress = true;
    const account = cognito.isLoggedIn() ? null : msal.instance.getActiveAccount();
    if (account) {
      msal.instance
        .acquireTokenRedirect({ scopes: scopes ?? environment.azure.scopes, account })
        .catch(() => (reauthInProgress = false));
    } else {
      // Una sesión Cognito rechazada está vencida: se descarta para que el login pida
      // credenciales en vez de devolver al usuario a la ruta que acaba de fallar.
      if (cognito.isLoggedIn()) cognito.logout();
      void router.navigate(['/auth/login'], { queryParams: { returnUrl: router.url } });
      reauthInProgress = false;
    }
  };

  return next(req).pipe(
    catchError((err: unknown) => {
      const is401 = err instanceof HttpErrorResponse && err.status === 401;
      const isApi = esUrlDeApi(req.url);
      if (!is401 || !isApi) return throwError(() => err);

      const scopes = scopesForUrl(req.url);
      const account = cognito.isLoggedIn() ? null : msal.instance.getActiveAccount();
      if (req.context.get(REINTENTADA) || !account || !scopes) {
        reautenticar(scopes);
        return throwError(() => err);
      }

      return from(msal.instance.acquireTokenSilent({ scopes, account, forceRefresh: true })).pipe(
        catchError(() => {
          // Sin token renovable (InteractionRequiredAuthError u otro): interacción.
          reautenticar(scopes);
          return throwError(() => err);
        }),
        switchMap((r) =>
          next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${r.accessToken}` },
              context: req.context.set(REINTENTADA, true),
            }),
          ).pipe(
            catchError((retryErr: unknown) => {
              if (retryErr instanceof HttpErrorResponse && retryErr.status === 401) {
                reautenticar(scopes);
              }
              return throwError(() => retryErr);
            }),
          ),
        ),
      );
    }),
  );
};
