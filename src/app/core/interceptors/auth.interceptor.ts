import { Injectable, inject } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { CognitoAuthService } from '../services/cognito-auth.service';
import { environment } from '../../../environments/environment';

/**
 * Interceptor HTTP unificado para Camisetas360.
 *
 * Inyecta el Bearer Token del usuario autenticado (AWS Cognito o Microsoft Entra ID)
 * en todas las peticiones dirigidas a los microservicios backend y API Gateway.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly cognitoAuth = inject(CognitoAuthService);

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Si la petición ya tiene encabezado de autorización, no modificarla
    if (req.headers.has('Authorization')) {
      return next.handle(req);
    }

    // Comprobar si la petición va dirigida al API Gateway
    const isApiRequest =
      req.url.startsWith(environment.apiGateway) ||
      req.url.startsWith('/api/v1/');

    if (isApiRequest && this.cognitoAuth.isLoggedIn()) {
      // Priorizar idToken para claims de identidad o accessToken según disponibilidad
      const token =
        this.cognitoAuth.idToken() || this.cognitoAuth.accessToken();

      if (token) {
        const cloned = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });
        return next.handle(cloned);
      }
    }

    return next.handle(req);
  }
}
