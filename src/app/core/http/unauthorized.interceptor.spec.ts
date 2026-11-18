import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { resetReauthState, unauthorizedInterceptor } from './unauthorized.interceptor';
import { CognitoAuthService } from '../services/cognito-auth.service';
import { environment } from '../../../environments/environment';

describe('unauthorizedInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let account: object | null;
  let cognitoLogged: boolean;
  let cognitoVencido: boolean;
  const cognitoMock = {
    isLoggedIn: () => cognitoLogged,
    tokenVencido: () => cognitoVencido,
    logout: vi.fn(() => (cognitoLogged = false)),
  };
  const acquireTokenRedirect = vi.fn(() => Promise.resolve());
  const acquireTokenSilent = vi.fn();
  const navigate = vi.fn(() => Promise.resolve(true));

  beforeEach(() => {
    resetReauthState();
    acquireTokenRedirect.mockClear();
    acquireTokenSilent.mockReset();
    acquireTokenSilent.mockResolvedValue({ accessToken: 'tok-nuevo' });
    navigate.mockClear();
    account = null;
    cognitoLogged = false;
    cognitoVencido = false;
    cognitoMock.logout.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([unauthorizedInterceptor])),
        provideHttpClientTesting(),
        {
          provide: MsalService,
          useValue: {
            instance: { getActiveAccount: () => account, acquireTokenRedirect, acquireTokenSilent },
          },
        },
        { provide: CognitoAuthService, useValue: cognitoMock },
        { provide: Router, useValue: { url: '/carrito', navigate } },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  const url = `${environment.apiGateway}/api/v1/orders`;
  const flush401 = () => ctrl.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
  const tick = () => new Promise((r) => setTimeout(r));

  it('401 con cuenta Entra -> renueva el token del scope y reintenta una vez', async () => {
    account = { username: 'u' };
    let body: unknown;
    http.get(url).subscribe((b) => (body = b));
    flush401();
    await tick();
    expect(acquireTokenSilent).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: [`${environment.azure.apiScope}/Orders.Read`],
        forceRefresh: true,
      }),
    );
    const retry = ctrl.expectOne(url);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer tok-nuevo');
    retry.flush([]);
    expect(body).toEqual([]);
    expect(acquireTokenRedirect).not.toHaveBeenCalled();
  });

  it('si el reintento vuelve a dar 401 -> acquireTokenRedirect y propaga el error', async () => {
    account = { username: 'u' };
    let status = 0;
    http.get(url).subscribe({ error: (e) => (status = e.status) });
    flush401();
    await tick();
    flush401();
    expect(acquireTokenRedirect).toHaveBeenCalledTimes(1);
    expect(status).toBe(401);
  });

  it('InteractionRequiredAuthError al renovar -> acquireTokenRedirect', async () => {
    account = { username: 'u' };
    acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required', 'corr-1'),
    );
    let status = 0;
    http.get(url).subscribe({ error: (e) => (status = e.status) });
    flush401();
    await tick();
    expect(acquireTokenRedirect).toHaveBeenCalledTimes(1);
    expect(status).toBe(401);
  });

  it('401 sin cuenta -> navega al login con returnUrl, sin renovar', () => {
    http.get(url).subscribe({ error: () => undefined });
    flush401();
    expect(acquireTokenSilent).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/carrito' },
    });
  });

  it('401 de un servicio que acepta Cognito (catalog) -> login (Cognito no tiene renovación)', () => {
    account = { username: 'u' };
    cognitoLogged = true;
    const catalog = `${environment.apiGateway}/api/v1/catalog/products/SKU-1`;
    http.delete(catalog).subscribe({ error: () => undefined });
    ctrl.expectOne(catalog).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(acquireTokenSilent).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalled();
    // la sesión vencida se descarta: el login pide credenciales en vez de volver a la ruta
    expect(cognitoMock.logout).toHaveBeenCalled();
  });

  it('401 de un servicio solo-Entra con sesión Cognito vigente NO cierra la sesión', () => {
    cognitoLogged = true;
    const recos = `${environment.apiGateway}/api/v1/recomendaciones`;
    let error: unknown;
    http.get(recos).subscribe({ error: (e) => (error = e) });
    ctrl.expectOne(recos).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(error).toBeTruthy(); // la pantalla recibe el error
    expect(cognitoMock.logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(acquireTokenSilent).not.toHaveBeenCalled();
  });

  it('401 con sesión Cognito vencida -> login aunque el servicio sea solo-Entra', () => {
    cognitoLogged = true;
    cognitoVencido = true;
    http.get(url).subscribe({ error: () => undefined });
    flush401();
    expect(cognitoMock.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/carrito' },
    });
  });

  it('403 no dispara re-login (lo maneja la pantalla)', () => {
    account = { username: 'u' };
    http.get(url).subscribe({ error: () => undefined });
    ctrl.expectOne(url).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(acquireTokenSilent).not.toHaveBeenCalled();
    expect(acquireTokenRedirect).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('URLs fuera de {API_BASE} se ignoran', () => {
    http.get('https://otro.example/x').subscribe({ error: () => undefined });
    ctrl.expectOne('https://otro.example/x').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).not.toHaveBeenCalled();
  });
});
