import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { MsalInterceptor, MsalService } from '@azure/msal-angular';
import { of } from 'rxjs';
import { MsalUnlessAuthorizedInterceptor } from './msal-unless-authorized.interceptor';

describe('MsalUnlessAuthorizedInterceptor', () => {
  const msalIntercept = vi.fn((_req: HttpRequest<unknown>, next: HttpHandler) => next.handle(_req));
  const next: HttpHandler = { handle: vi.fn(() => of(new HttpResponse({ status: 200 }))) };
  let cuentas: unknown[];

  beforeEach(() => {
    msalIntercept.mockClear();
    vi.mocked(next.handle).mockClear();
    cuentas = [{ username: 'entra@example.test' }];
  });

  function create() {
    TestBed.configureTestingModule({
      providers: [
        MsalUnlessAuthorizedInterceptor,
        { provide: MsalInterceptor, useValue: { intercept: msalIntercept } },
        {
          provide: MsalService,
          useValue: {
            instance: { getActiveAccount: () => cuentas[0] ?? null, getAllAccounts: () => cuentas },
          },
        },
      ],
    });
    return TestBed.inject(MsalUnlessAuthorizedInterceptor);
  }

  it('delega en MSAL si hay cuenta Entra y la petición no trae Authorization', () => {
    create().intercept(new HttpRequest('GET', '/api/v1/orders'), next).subscribe();
    expect(msalIntercept).toHaveBeenCalledTimes(1);
  });

  it('no invoca MSAL si ya hay Bearer (sesión Cognito)', () => {
    const req = new HttpRequest('GET', '/api/v1/orders').clone({
      setHeaders: { Authorization: 'Bearer c' },
    });
    create().intercept(req, next).subscribe();
    expect(msalIntercept).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalledWith(req);
  });

  it('sin cuenta Entra (visitante) la petición sale sin token y sin login', () => {
    cuentas = [];
    const req = new HttpRequest('GET', '/api/v1/catalog/products');
    create().intercept(req, next).subscribe();
    expect(msalIntercept).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalledWith(req);
  });
});
