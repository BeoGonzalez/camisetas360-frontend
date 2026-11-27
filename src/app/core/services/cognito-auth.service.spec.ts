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

  describe('respuesta real de la Lambda (solo tokens) y renovación', () => {
    const url = (k: 'cognitoLogin' | 'cognitoRegister' | 'cognitoRefresh') =>
      `${environment.apiGateway}${environment.endpoints[k]}`;
    // UTF-8 (claims con tildes), como un JWT real
    const b64 = (o: unknown) =>
      btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    const jwt = (claims: Record<string, unknown>) => `h.${b64(claims)}.s`;
    const ahora = () => Math.floor(Date.now() / 1000);
    const idToken = jwt({
      email: 'ana@camisetas360.com',
      name: 'Ana Pérez',
      sub: 'sub-ana',
      'cognito:username': 'ana@camisetas360.com',
      'cognito:groups': ['CUSTOMER'],
    });
    /** Lo que devuelve de verdad la Lambda: sin `user`. */
    /** `refreshToken` null = la respuesta no trae refresh token. */
    const tokens = (exp: number, refreshToken: string | null = 'rt-1') => ({
      accessToken: jwt({ exp, token_use: 'access' }),
      idToken,
      refreshToken: refreshToken ?? undefined,
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
    const loginCon = (exp: number) => {
      service.login('ana@camisetas360.com', 'Password123!').subscribe();
      httpMock.expectOne(url('cognitoLogin')).flush(tokens(exp));
    };

    it('login sin `user` en la respuesta: el usuario sale del ID token y se guarda el refresh token', () => {
      loginCon(ahora() + 3600);
      expect(service.currentUser()).toEqual({
        username: 'ana@camisetas360.com',
        email: 'ana@camisetas360.com',
        name: 'Ana Pérez',
        sub: 'sub-ana',
        roles: ['CUSTOMER'],
      });
      expect(service.puedeRenovar()).toBe(true);
      expect(localStorage.getItem('c360_cognito_session')).toContain('rt-1');
    });

    it('register sin tokens (la Lambda solo confirma el alta) inicia sesión con las mismas credenciales', () => {
      service.register('ana@camisetas360.com', 'Password123!', 'Ana').subscribe();
      httpMock
        .expectOne(url('cognitoRegister'))
        .flush({ userSub: 'sub-ana', email: 'ana@camisetas360.com', confirmed: true });
      const login = httpMock.expectOne(url('cognitoLogin'));
      expect(login.request.body).toEqual({
        email: 'ana@camisetas360.com',
        password: 'Password123!',
      });
      login.flush(tokens(ahora() + 3600));
      expect(service.isLoggedIn()).toBe(true);
      expect(service.currentUser()?.email).toBe('ana@camisetas360.com');
    });

    it('tokenPorVencer: true con menos de 1 min de vida, false con margen', () => {
      loginCon(ahora() + 30);
      expect(service.tokenPorVencer()).toBe(true);
      expect(service.tokenVencido()).toBe(false);
      service.logout();
      loginCon(ahora() + 600);
      expect(service.tokenPorVencer()).toBe(false);
    });

    it('renovar: POST /refresh con el refresh token, actualiza el access token y conserva el refresh', () => {
      loginCon(ahora() - 10);
      let listo = false;
      service.renovar().subscribe(() => (listo = true));
      const req = httpMock.expectOne(url('cognitoRefresh'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refreshToken: 'rt-1' });
      // REFRESH_TOKEN_AUTH no siempre devuelve un refresh token nuevo
      req.flush(tokens(ahora() + 3600, null));
      expect(listo).toBe(true);
      expect(service.tokenVencido()).toBe(false);
      expect(service.puedeRenovar()).toBe(true);
      expect(localStorage.getItem('c360_cognito_session')).toContain('rt-1');
    });

    it('renovaciones simultáneas comparten una sola llamada a la Lambda', () => {
      loginCon(ahora() - 10);
      let n = 0;
      service.renovar().subscribe(() => n++);
      service.renovar().subscribe(() => n++);
      httpMock.expectOne(url('cognitoRefresh')).flush(tokens(ahora() + 3600));
      expect(n).toBe(2);
    });

    it('refresh token rechazado (400) cierra la sesión; un error de red la conserva', () => {
      loginCon(ahora() - 10);
      service.renovar().subscribe({ error: () => undefined });
      httpMock.expectOne(url('cognitoRefresh')).flush({}, { status: 0, statusText: 'red' });
      expect(service.isLoggedIn()).toBe(true);

      service.renovar().subscribe({ error: () => undefined });
      httpMock.expectOne(url('cognitoRefresh')).flush({}, { status: 400, statusText: 'Bad' });
      expect(service.isLoggedIn()).toBe(false);
      expect(localStorage.getItem('c360_cognito_session')).toBeNull();
    });

    it('sin refresh token, renovar falla sin llamar a la Lambda', () => {
      service.login('ana@camisetas360.com', 'Password123!').subscribe();
      httpMock.expectOne(url('cognitoLogin')).flush(tokens(ahora() - 10, null));
      let error: unknown;
      service.renovar().subscribe({ error: (e) => (error = e) });
      expect(error).toBeTruthy();
      expect(service.puedeRenovar()).toBe(false);
    });

    it('cerrarSesion (formulario): revoca el refresh token, borra la sesión y no pide redirección', () => {
      loginCon(ahora() + 3600);
      const destino = service.cerrarSesion();
      const revoke = httpMock.expectOne(`${environment.cognito.domain}/oauth2/revoke`);
      expect(revoke.request.body).toBe(
        `token=rt-1&client_id=${encodeURIComponent(environment.cognito.clientId)}`,
      );
      revoke.flush({});
      expect(destino).toBeNull();
      expect(service.isLoggedIn()).toBe(false);
      expect(localStorage.getItem('c360_cognito_session')).toBeNull();
    });
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

    it('guarda el refresh token del Hosted UI y al cerrar sesión pide /logout de Cognito', async () => {
      const url = new URL(await service.urlHostedUi('/catalog'));
      service.completarHostedUi('codigo-2', url.searchParams.get('state')).subscribe();
      httpMock.expectOne(`${c.domain}/oauth2/token`).flush({
        access_token: 'acceso',
        id_token: jwt({ sub: 's-2', email: 'ana@x.com' }),
        refresh_token: 'rt-hosted',
      });
      expect(service.puedeRenovar()).toBe(true);

      const destino = new URL(service.cerrarSesion()!);
      httpMock.expectOne(`${c.domain}/oauth2/revoke`).flush({});
      expect(`${destino.origin}${destino.pathname}`).toBe(`${c.domain}/logout`);
      expect(destino.searchParams.get('client_id')).toBe(c.clientId);
      expect(destino.searchParams.get('logout_uri')).toBe(c.logoutUri);
      expect(service.isLoggedIn()).toBe(false);
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
