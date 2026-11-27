import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { CognitoAuthService } from '../services/cognito-auth.service';
import { esUrlDeApi } from '../auth/api-scopes';

/** Rutas de la Lambda de login: no llevan Bearer ni disparan renovación (evita recursión). */
const RUTA_COGNITO = '/api/v1/auth/cognito/';

/**
 * Agrega el Bearer de la sesión Cognito SOLO a las peticiones de {API_BASE} (mismo origen
 * exacto). Antes bastaba con que la URL contuviera `/api/v1/` o `execute-api...`, lo que
 * filtraba el token a cualquier API de terceros.
 *
 * Si al access token le queda menos de un minuto y hay refresh token, lo renueva antes de enviar
 * (una sola renovación compartida entre peticiones simultáneas). Si la renovación falla se envía
 * igual: el 401 lo maneja `unauthorizedInterceptor`.
 *
 * Solo access token: el backend valida access tokens y nunca debe recibir el ID token.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly cognitoAuth = inject(CognitoAuthService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (
      req.headers.has('Authorization') ||
      !esUrlDeApi(req.url) ||
      req.url.includes(RUTA_COGNITO)
    ) {
      return next.handle(req);
    }
    const cognito = this.cognitoAuth;
    const conToken = () => {
      const token = cognito.isLoggedIn() ? cognito.accessToken() : null;
      return next.handle(
        token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req,
      );
    };
    if (cognito.isLoggedIn() && cognito.puedeRenovar() && cognito.tokenPorVencer()) {
      return cognito.renovar().pipe(
        catchError(() => of(undefined)),
        switchMap(conToken),
      );
    }
    return conToken();
  }
}
