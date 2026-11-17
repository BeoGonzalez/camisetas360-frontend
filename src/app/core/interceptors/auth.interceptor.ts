import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CognitoAuthService } from '../services/cognito-auth.service';
import { esUrlDeApi } from '../auth/api-scopes';

/**
 * Agrega el Bearer de la sesión Cognito SOLO a las peticiones de {API_BASE} (mismo origen
 * exacto). Antes bastaba con que la URL contuviera `/api/v1/` o `execute-api...`, lo que
 * filtraba el token a cualquier API de terceros.
 *
 * Solo access token: el backend valida access tokens y nunca debe recibir el ID token.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly cognitoAuth = inject(CognitoAuthService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (req.headers.has('Authorization') || !esUrlDeApi(req.url)) {
      return next.handle(req);
    }
    const token = this.cognitoAuth.isLoggedIn() ? this.cognitoAuth.accessToken() : null;
    return next.handle(
      token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req,
    );
  }
}
