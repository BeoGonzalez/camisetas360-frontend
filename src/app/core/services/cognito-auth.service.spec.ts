import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CognitoAuthService, CognitoAuthResponse, claimsDeJwt } from './cognito-auth.service';
import { environment } from '../../../environments/environment';

describe('CognitoAuthService', () => {
  let service: CognitoAuthService;
  let httpMock: HttpTestingController;

  const mockResponse: CognitoAuthResponse = {
    message: 'Autenticación exitosa con AWS Cognito',
    accessToken: 'mock-access-token',
    idToken: 'mock-id-token',
    refreshToken: 'mock-refresh-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: {
      username: 'usuario@camisetas360.com',
      email: 'usuario@camisetas360.com',
      name: 'Usuario Demo',
      sub: 'mock-sub-123',
      roles: ['CUSTOMER'],
    },
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CognitoAuthService],
    });
    service = TestBed.inject(CognitoAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('sin sesión guardada arranca deslogueado', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('login: POST, sesión en memoria y en localStorage, sin guardar la contraseña', () => {
    let res: CognitoAuthResponse | undefined;
    service.login('usuario@camisetas360.com', 'Password123!').subscribe((r) => (res = r));

    const req = httpMock.expectOne(
      `${environment.apiGateway}${environment.endpoints.cognitoLogin}`,
    );
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    expect(res).toEqual(mockResponse);
    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()?.email).toBe('usuario@camisetas360.com');
    expect(service.userInitials()).toBe('UD');
    expect(service.userRoles()).toEqual(['CUSTOMER']);
    expect(service.isAdmin()).toBe(false);
    const guardado = localStorage.getItem('c360_cognito_session') ?? '';
    expect(guardado).toContain('mock-access-token');
    expect(guardado).not.toContain('Password123!');
  });

  it('una sesión guardada se restaura al crear el servicio (recarga de página)', () => {
    service.login('usuario@camisetas360.com', 'Password123!').subscribe();
    httpMock
      .expectOne(`${environment.apiGateway}${environment.endpoints.cognitoLogin}`)
      .flush(mockResponse);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CognitoAuthService],
    });
    const restaurado = TestBed.inject(CognitoAuthService);
    httpMock = TestBed.inject(HttpTestingController);
    expect(restaurado.isLoggedIn()).toBe(true);
    expect(restaurado.accessToken()).toBe('mock-access-token');
  });

  it('login fallido (401) no deja sesión', () => {
    let mensaje = '';
    service.login('x@y.cl', 'mala').subscribe({ error: (e: Error) => (mensaje = e.message) });
    httpMock
      .expectOne(`${environment.apiGateway}${environment.endpoints.cognitoLogin}`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(mensaje).toContain('Credenciales inválidas');
    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('c360_cognito_session')).toBeNull();
  });

  it('register establece la sesión', () => {
    service.register('nuevo@camisetas360.com', 'Password123!', 'Nuevo Usuario').subscribe();

    const req = httpMock.expectOne(
      `${environment.apiGateway}${environment.endpoints.cognitoRegister}`,
    );
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
    expect(service.isLoggedIn()).toBe(true);
  });

  it('should clear session on logout', () => {
    service.login('usuario@camisetas360.com', 'Password123!').subscribe();
    const req = httpMock.expectOne(
      `${environment.apiGateway}${environment.endpoints.cognitoLogin}`,
    );
    req.flush(mockResponse);

    expect(service.isLoggedIn()).toBe(true);
    service.logout();
    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('c360_cognito_session')).toBeNull();
  });

  describe('Hosted UI (authorization code + PKCE)', () => {
    const c = environment.cognito;
    const b64url = (bytes: Uint8Array) =>
      btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    /** JWT sin firma válida: el front solo lee los claims; la firma la valida el backend. */
    const jwt = (claims: Record<string, unknown>) =>
      `h.${b64url(new TextEncoder().encode(JSON.stringify(claims)))}.s`;

    beforeEach(() => sessionStorage.clear());

    it('arma la URL de /oauth2/authorize con PKCE S256 y state, y guarda el verificador', async () => {
      const url = new URL(await service.urlHostedUi('/catalog/CAM-001'));
      expect(`${url.origin}${url.pathname}`).toBe(`${c.domain}/oauth2/authorize`);
      expect(url.searchParams.get('client_id')).toBe(c.clientId);
      expect(url.searchParams.get('redirect_uri')).toBe(c.redirectUri);
      // Sin aws.cognito.signin.user.admin, carrito no puede leer el email (GetUser) y el checkout da 422.
      expect(url.searchParams.get('scope')).toBe(
        'openid email profile aws.cognito.signin.user.admin',
      );
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      const pendiente = JSON.parse(sessionStorage.getItem('c360_cognito_hosted_ui')!);
      expect(url.searchParams.get('state')).toBe(pendiente.state);
      expect(pendiente.returnUrl).toBe('/catalog/CAM-001');
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(pendiente.verifier),
      );
      expect(url.searchParams.get('code_challenge')).toBe(b64url(new Uint8Array(digest)));
    });

    it('canjea el código con el verificador y deja la sesión del usuario real (ADMIN)', async () => {
      const url = new URL(await service.urlHostedUi('/admin/productos'));
      const state = url.searchParams.get('state');
      const { verifier } = JSON.parse(sessionStorage.getItem('c360_cognito_hosted_ui')!);
      let destino: string | undefined;
      service.completarHostedUi('codigo-1', state).subscribe((d) => (destino = d));

      const req = httpMock.expectOne(`${c.domain}/oauth2/token`);
      const body = new URLSearchParams(req.request.body);
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('codigo-1');
      expect(body.get('code_verifier')).toBe(verifier);
      expect(body.get('client_id')).toBe(c.clientId);
      req.flush({
        access_token: 'acceso',
        id_token: jwt({
          sub: 's-1',
          email: 'admin@camisetas360.com',
          name: 'Administración Ñandú',
          'cognito:username': 'u-1',
          'cognito:groups': ['ADMIN', 'OTRO'],
        }),
      });

      expect(destino).toBe('/admin/productos');
      expect(service.accessToken()).toBe('acceso');
      expect(service.currentUser()).toEqual({
        username: 'u-1',
        email: 'admin@camisetas360.com',
        name: 'Administración Ñandú',
        sub: 's-1',
        roles: ['ADMIN'],
      });
      expect(sessionStorage.getItem('c360_cognito_hosted_ui')).toBeNull();
    });

    it('rechaza un state distinto (código inyectado) sin llamar a Cognito', async () => {
      await service.urlHostedUi('/catalog');
      let error: Error | undefined;
      service.completarHostedUi('codigo', 'otro-state').subscribe({ error: (e) => (error = e) });
      expect(error?.message).toContain('no es válida o expiró');
      expect(service.isLoggedIn()).toBe(false);
    });

    it('sin login pendiente (recarga del callback) tampoco canjea', () => {
      let error: Error | undefined;
      service.completarHostedUi('codigo', 'x').subscribe({ error: (e) => (error = e) });
      expect(error).toBeDefined();
    });

    it('si Cognito rechaza el canje no deja sesión', async () => {
      const url = new URL(await service.urlHostedUi('/catalog'));
      let error: Error | undefined;
      service
        .completarHostedUi('vencido', url.searchParams.get('state'))
        .subscribe({ error: (e) => (error = e) });
      httpMock
        .expectOne(`${c.domain}/oauth2/token`)
        .flush({ error: 'invalid_grant' }, { status: 400, statusText: 'Bad Request' });
      expect(error?.message).toBe('No se pudo completar el inicio de sesión con Cognito.');
      expect(service.isLoggedIn()).toBe(false);
    });

    it('tokenVencido: sin token, ilegible, sin exp o expirado => true; vigente => false', () => {
      const ahora = 1_800_000_000_000;
      const conToken = (accessToken: string) => {
        localStorage.setItem(
          'c360_cognito_session',
          JSON.stringify({ user: { roles: ['ADMIN'] }, accessToken, idToken: 'i' }),
        );
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          imports: [HttpClientTestingModule],
          providers: [CognitoAuthService],
        });
        return TestBed.inject(CognitoAuthService);
      };
      expect(service.tokenVencido(ahora)).toBe(true); // sin sesión
      expect(conToken('no-es-jwt').tokenVencido(ahora)).toBe(true);
      expect(conToken(jwt({ sub: 's' })).tokenVencido(ahora)).toBe(true);
      expect(conToken(jwt({ exp: ahora / 1000 - 1 })).tokenVencido(ahora)).toBe(true);
      expect(conToken(jwt({ exp: ahora / 1000 + 3600 })).tokenVencido(ahora)).toBe(false);
      localStorage.clear();
    });

    it('sin grupos conocidos queda como CUSTOMER', async () => {
      const url = new URL(await service.urlHostedUi('/catalog'));
      service.completarHostedUi('c', url.searchParams.get('state')).subscribe();
      httpMock
        .expectOne(`${c.domain}/oauth2/token`)
        .flush({ access_token: 'a', id_token: jwt({ sub: 's', email: 'x@y.com' }) });
      expect(service.currentUser()?.roles).toEqual(['CUSTOMER']);
      expect(service.currentUser()?.name).toBe('x');
      expect(claimsDeJwt(jwt({ a: 1 }))).toEqual({ a: 1 });
    });
  });
});
