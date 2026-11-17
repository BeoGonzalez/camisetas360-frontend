import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { MsalInterceptor, MsalService } from '@azure/msal-angular';
import { Observable } from 'rxjs';

/**
 * Conviven dos logins (Entra/MSAL y Cognito). AuthInterceptor corre antes y pone el Bearer de
 * Cognito si hay esa sesión; en ese caso MSAL no debe intervenir. Tampoco interviene si no hay
 * cuenta Entra (visitante del catálogo público): MSAL intentaría un login por redirección y la
 * petición nunca saldría. Con cuenta Entra y sin header previo, delega en MsalInterceptor.
 */
@Injectable()
export class MsalUnlessAuthorizedInterceptor implements HttpInterceptor {
  private readonly msal = inject(MsalInterceptor);
  private readonly msalService = inject(MsalService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (req.headers.has('Authorization') || !this.hayCuentaEntra()) {
      return next.handle(req);
    }
    return this.msal.intercept(req, next);
  }

  private hayCuentaEntra(): boolean {
    const instance = this.msalService.instance;
    return !!instance.getActiveAccount() || instance.getAllAccounts().length > 0;
  }
}
