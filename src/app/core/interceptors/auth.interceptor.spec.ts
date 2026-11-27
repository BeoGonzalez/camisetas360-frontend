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
import { Observable, of, throwError } from 'rxjs';

describe('AuthInterceptor (Bearer de la sesión Cognito)', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let sesion: {
    logged: boolean;
    access: string | null;
    id: string | null;
    porVencer: boolean;
    renovable: boolean;
    renovar: () => Observable<void>;
    renovaciones: number;
  };

  beforeEach(() => {
    sesion = {
      logged: true,
      access: 'access-tok',
      id: 'id-tok',
      porVencer: false,
      renovable: true,
      renovaciones: 0,
      renovar: () => {
        sesion.renovaciones++;
        sesion.access = 'access-renovado';
        return of(undefined);
      },
    };
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
            tokenPorVencer: () => sesion.porVencer,
            puedeRenovar: () => sesion.renovable,
            renovar: () => sesion.renovar(),
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

  describe('renovación antes de enviar', () => {
    const api = `${environment.apiGateway}/api/v1/orders`;

    it('token por vencer -> renueva primero y envía el token nuevo', () => {
      sesion.porVencer = true;
      expect(authDe(api)).toBe('Bearer access-renovado');
      expect(sesion.renovaciones).toBe(1);
    });

    it('token vigente -> no renueva', () => {
      expect(authDe(api)).toBe('Bearer access-tok');
      expect(sesion.renovaciones).toBe(0);
    });

    it('si la renovación falla, envía igual con el token que hay (el 401 lo maneja otro interceptor)', () => {
      sesion.porVencer = true;
      sesion.renovar = () => throwError(() => new Error('red'));
      expect(authDe(api)).toBe('Bearer access-tok');
    });

    it('las rutas de la Lambda de login no llevan Bearer ni disparan la renovación', () => {
      sesion.porVencer = true;
      const refresh = `${environment.apiGateway}${environment.endpoints.cognitoRefresh}`;
      http.post(refresh, {}).subscribe();
      const req = ctrl.expectOne(refresh);
      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({});
      expect(sesion.renovaciones).toBe(0);
    });
  });
});
