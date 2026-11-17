import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthInterceptor } from './auth.interceptor';
import { CognitoAuthService } from '../services/cognito-auth.service';
import { environment } from '../../../environments/environment';

describe('AuthInterceptor (Bearer de la sesión Cognito)', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let sesion: { logged: boolean; access: string | null; id: string | null };

  beforeEach(() => {
    sesion = { logged: true, access: 'access-tok', id: 'id-tok' };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        {
          provide: CognitoAuthService,
          useValue: {
            isLoggedIn: () => sesion.logged,
            accessToken: () => sesion.access,
            idToken: () => sesion.id,
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  const authDe = (url: string) => {
    http.get(url).subscribe();
    const req = ctrl.expectOne(url);
    const h = req.request.headers.get('Authorization');
    req.flush({});
    return h;
  };

  it('agrega el access token a las peticiones de {API_BASE}', () => {
    expect(authDe(`${environment.apiGateway}/api/v1/orders`)).toBe('Bearer access-tok');
  });

  it('nunca envía el ID token como Bearer (el backend valida access tokens)', () => {
    sesion.access = null;
    expect(authDe(`${environment.apiGateway}/api/v1/orders`)).toBeNull();
  });

  it.each([
    ['otra API con /api/v1/ en la ruta', 'https://tercero.example.com/api/v1/datos'],
    ['otro API Gateway de AWS', 'https://zzzzzzzzzz.execute-api.us-east-1.amazonaws.com/x'],
    ['un host que empieza igual que {API_BASE}', `${environment.apiGateway}.evil.example/api/v1/x`],
  ])('no filtra el token a %s', (_d, url) => {
    expect(authDe(url)).toBeNull();
  });

  it('sin sesión Cognito no agrega nada', () => {
    sesion.logged = false;
    expect(authDe(`${environment.apiGateway}/api/v1/orders`)).toBeNull();
  });

  it('respeta un Authorization que ya traiga la petición', () => {
    const url = `${environment.apiGateway}/api/v1/orders`;
    http.get(url, { headers: { Authorization: 'Bearer otro' } }).subscribe();
    const req = ctrl.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBe('Bearer otro');
    req.flush({});
  });
});
