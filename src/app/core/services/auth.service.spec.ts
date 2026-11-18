import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MsalService } from '@azure/msal-angular';
import { AuthService } from './auth.service';
import { CognitoAuthService } from './cognito-auth.service';
import { CartService } from './cart.service';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ApiError } from '../http/api-error';

describe('AuthService', () => {
  let http: HttpTestingController;
  let cuentaEntra: {
    username: string;
    name: string;
    idTokenClaims: Record<string, unknown>;
  } | null;
  let cognito: { logged: boolean; roles: string[] };
  const url = `${environment.apiGateway}/api/v1/auth/profile`;

  function crear(): AuthService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MsalService,
          useValue: {
            instance: { getActiveAccount: () => cuentaEntra, getAllAccounts: () => [] },
          },
        },
        {
          provide: CognitoAuthService,
          useValue: {
            isLoggedIn: () => cognito.logged,
            userRoles: () => cognito.roles,
            currentUser: () =>
              cognito.logged
                ? { sub: 's', email: 'c@x.cl', name: 'C', roles: cognito.roles }
                : null,
            accessToken: () => null,
            userInitials: () => 'C',
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  const entra = (roles?: unknown) => ({
    username: 'u@tenant',
    name: 'Usuario Entra',
    idTokenClaims: roles === undefined ? {} : { roles },
  });

  beforeEach(() => {
    cuentaEntra = null;
    cognito = { logged: false, roles: [] };
  });

  afterEach(() => http.verify());

  describe('roles (claim `roles` de Entra o sesión Cognito)', () => {
    it('ADMIN NO hereda los permisos de CUSTOMER', () => {
      cuentaEntra = entra(['ADMIN']);
      const auth = crear();
      expect(auth.isAdmin()).toBe(true);
      expect(auth.isCustomer()).toBe(false);
      expect(auth.hasAnyRole(['CUSTOMER'])).toBe(false);
      expect(auth.canSeeMetrics()).toBe(true);
    });

    it('CATALOG_MANAGER ve métricas pero no es ADMIN ni CUSTOMER', () => {
      cuentaEntra = entra(['CATALOG_MANAGER']);
      const auth = crear();
      expect(auth.canSeeMetrics()).toBe(true);
      expect(auth.isAdmin()).toBe(false);
      expect(auth.isCustomer()).toBe(false);
    });

    it('CUSTOMER no ve métricas', () => {
      cuentaEntra = entra(['CUSTOMER']);
      const auth = crear();
      expect(auth.isCustomer()).toBe(true);
      expect(auth.canSeeMetrics()).toBe(false);
    });

    it('los roles son sensibles a mayúsculas (como en el backend)', () => {
      cuentaEntra = entra(['admin', 'Customer']);
      const auth = crear();
      expect(auth.isAdmin()).toBe(false);
      expect(auth.isCustomer()).toBe(false);
    });

    it('sin claim `roles`, o con un valor que no es lista, no hay roles', () => {
      cuentaEntra = entra();
      expect(crear().userRoles()).toEqual([]);
      TestBed.resetTestingModule();
      cuentaEntra = entra('ADMIN');
      expect(crear().userRoles()).toEqual([]);
    });

    it('con sesión Cognito manda la sesión Cognito, no la cuenta Entra', () => {
      cuentaEntra = entra(['ADMIN']);
      cognito = { logged: true, roles: ['CUSTOMER'] };
      const auth = crear();
      expect(auth.isCustomer()).toBe(true);
      expect(auth.isAdmin()).toBe(false);
    });

    it('recomendaciones solo para clientes con sesión Entra (recommendation no acepta Cognito)', () => {
      cuentaEntra = entra(['CUSTOMER']);
      expect(crear().canSeeRecommendations()).toBe(true);
      TestBed.resetTestingModule();
      cuentaEntra = null;
      cognito = { logged: true, roles: ['CUSTOMER'] };
      expect(crear().canSeeRecommendations()).toBe(false);
      TestBed.resetTestingModule();
      cognito = { logged: false, roles: [] };
      cuentaEntra = entra(['ADMIN']);
      expect(crear().canSeeRecommendations()).toBe(false);
    });
  });

  describe('logout (dejar el navegador listo para otra persona)', () => {
    function crearConEspias() {
      const auth = crear();
      const cognitoSvc = TestBed.inject(CognitoAuthService) as unknown as {
        logout: ReturnType<typeof vi.fn>;
      };
      cognitoSvc.logout = vi.fn();
      const msal = TestBed.inject(MsalService) as unknown as {
        logoutRedirect: ReturnType<typeof vi.fn>;
      };
      msal.logoutRedirect = vi.fn(() => ({ subscribe: vi.fn() }));
      const cart = TestBed.inject(CartService);
      const reset = vi.spyOn(cart, 'reset');
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      return { auth, cognitoSvc, msal, reset, navigate };
    }

    it('Cognito: cierra la sesión, limpia el carrito local y va al login', () => {
      cognito = { logged: true, roles: ['CUSTOMER'] };
      const { auth, cognitoSvc, msal, reset, navigate } = crearConEspias();
      auth.logout();
      expect(cognitoSvc.logout).toHaveBeenCalled();
      expect(reset).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/auth/login']);
      expect(msal.logoutRedirect).not.toHaveBeenCalled();
      expect(auth.profile()).toBeNull();
    });

    it('Entra: limpia el carrito local y delega la vuelta en logoutRedirect', () => {
      cuentaEntra = entra(['CUSTOMER']);
      const { auth, msal, reset, navigate } = crearConEspias();
      auth.logout();
      expect(reset).toHaveBeenCalled();
      expect(msal.logoutRedirect).toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('GET /auth/profile', () => {
    beforeEach(() => (cuentaEntra = entra(['CUSTOMER'])));

    it('200 -> {userId, tenantId, email, name}; sin userId en la URL; se cachea', () => {
      const auth = crear();
      const body = { userId: 'tid:oid', tenantId: 'tid', email: 'a@b.cl', name: 'Ana' };
      let res: unknown;
      auth.getProfile().subscribe((p) => (res = p));
      const req = http.expectOne(url);
      expect(req.request.method).toBe('GET');
      req.flush(body);
      expect(res).toEqual(body);
      expect(auth.profile()).toEqual(body);
      auth.getProfile().subscribe();
      http.expectNone(url);
    });

    it.each([
      [401, 'unauthenticated'],
      [403, 'forbidden'],
    ])('%i -> ApiError %s y permite reintentar', (status, kind) => {
      const auth = crear();
      let err: ApiError | undefined;
      auth.getProfile().subscribe({ error: (e) => (err = e) });
      http.expectOne(url).flush({}, { status, statusText: 'x' });
      expect(err?.kind).toBe(kind);
      auth.getProfile().subscribe({ error: () => undefined });
      http.expectOne(url).flush({}, { status, statusText: 'x' });
    });

    it('con sesión Cognito no llama al backend (no hay perfil Entra)', () => {
      cognito = { logged: true, roles: ['CUSTOMER'] };
      const auth = crear();
      let res: unknown;
      auth.getProfile().subscribe((p) => (res = p));
      http.expectNone(url);
      expect(res).toMatchObject({ email: 'c@x.cl' });
    });
  });
});
