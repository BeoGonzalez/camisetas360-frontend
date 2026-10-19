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
 * Inyecta el Bearer Token del usuario autenticado en todas las peticiones 
 * dirigidas a los microservicios backend y API Gateway.
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
    // Se añade 'execute-api' e 'includes' para garantizar que atrape la URL de AWS
    const isApiRequest =
      req.url.startsWith(environment.apiGateway) ||
      req.url.includes('/api/v1/') ||
      req.url.includes('execute-api.us-east-1.amazonaws.com');

    console.log(`[AuthInterceptor] Evaluando URL: ${req.url} -> ¿Es API?: ${isApiRequest}`);
    console.log(`[AuthInterceptor] ¿Usuario reconocido como logueado?: ${this.cognitoAuth.isLoggedIn()}`);
    console.log(`[AuthInterceptor] ¿Existe Access Token en memoria?: ${!!this.cognitoAuth.accessToken()}`);

    // DEBUG: Revisa la consola (F12) para confirmar que el interceptor ve la petición
    console.log(`[AuthInterceptor] Evaluando URL: ${req.url} -> ¿Es API?: ${isApiRequest}`);

    if (isApiRequest && this.cognitoAuth.isLoggedIn()) {
      // CAMBIO CRÍTICO: Priorizar accessToken para AWS API Gateway, luego idToken
      const token = this.cognitoAuth.accessToken() || this.cognitoAuth.idToken();

      if (token) {
        console.log('[AuthInterceptor] Inyectando Bearer token en la petición...');
        const cloned = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });
        return next.handle(cloned);
      } else {
        console.warn('[AuthInterceptor] El usuario está logueado pero no se encontró un token válido.');
      }
    }

    return next.handle(req);
  }
}