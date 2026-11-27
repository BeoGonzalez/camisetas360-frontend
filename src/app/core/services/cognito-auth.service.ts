import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import {
  Observable,
  tap,
  catchError,
  throwError,
  map,
  switchMap,
  of,
  finalize,
  shareReplay,
} from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CognitoUser {
  username: string;
  email: string;
  name: string;
  sub: string;
  roles: string[];
}

/**
 * Respuesta de la Lambda (login/refresh): solo tokens. `user` es opcional porque la Lambda no lo
 * envía; si falta, el usuario se arma desde el ID token.
 */
export interface CognitoAuthResponse {
  message?: string;
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  user?: CognitoUser;
}

/** De dónde salió la sesión: el Hosted UI deja además una cookie en el dominio de Cognito. */
type OrigenSesion = 'formulario' | 'hosted-ui';

const STORAGE_KEY = 'c360_cognito_session';
/** Se renueva el access token cuando le queda menos que esto (y ante cualquier 401). */
const MARGEN_RENOVACION_MS = 60_000;
/** Verificador PKCE, state y destino del login con Hosted UI (solo dura la pestaña). */
const HOSTED_UI_KEY = 'c360_cognito_hosted_ui';
const ROLES_CONOCIDOS = ['CUSTOMER', 'CATALOG_MANAGER', 'ADMIN'];

interface HostedUiPendiente {
  verifier: string;
  state: string;
  returnUrl: string;
}

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
}

function base64Url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function aleatorio(bytes: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Claims de un JWT (sin verificar la firma: solo para mostrar datos; el backend valida). */
export function claimsDeJwt(token: string): Record<string, unknown> {
  const payload = token.split('.')[1] ?? '';
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Servicio de autenticación sin servidor (Serverless) con AWS Cognito y Lambda.
 *
 * Conecta el botón de inicio de sesión de Angular con la función Lambda
 * expuesta en el API Gateway para autenticación y registro de usuarios.
 */
@Injectable({
  providedIn: 'root',
})
export class CognitoAuthService {
  private readonly http = inject(HttpClient);
  private readonly loginUrl = `${environment.apiGateway}${environment.endpoints.cognitoLogin}`;
  private readonly registerUrl = `${environment.apiGateway}${environment.endpoints.cognitoRegister}`;
  private readonly refreshUrl = `${environment.apiGateway}${environment.endpoints.cognitoRefresh}`;

  private readonly _currentUser = signal<CognitoUser | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _idToken = signal<string | null>(null);
  private readonly _refreshToken = signal<string | null>(null);
  private origen: OrigenSesion = 'formulario';
  /** Renovación en curso: peticiones simultáneas comparten una sola llamada a la Lambda. */
  private renovacion$: Observable<void> | null = null;

  /** ¿Hay refresh token para renovar la sesión sin pedir la contraseña? */
  readonly puedeRenovar = computed<boolean>(() => !!this._refreshToken());

  /** Indica si hay un usuario autenticado mediante Cognito */
  readonly isLoggedIn = computed<boolean>(() => this._currentUser() !== null);

  /** Datos del usuario actual */
  readonly currentUser = this._currentUser.asReadonly();

  /** Token de acceso para llamadas a servicios */
  readonly accessToken = this._accessToken.asReadonly();

  /** Token de identidad */
  readonly idToken = this._idToken.asReadonly();

  /** Iniciales del usuario para mostrar en avatar */
  readonly userInitials = computed<string>(() => {
    const user = this._currentUser();
    if (!user || !user.name) return '?';
    return user.name
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  });

  /** Roles del usuario (ej: CUSTOMER, ADMIN) */
  readonly userRoles = computed<string[]>(() => {
    const user = this._currentUser();
    return user?.roles || [];
  });

  /** Indica si el usuario autenticado tiene rol ADMIN */
  readonly isAdmin = computed<boolean>(() => {
    return this.userRoles().includes('ADMIN');
  });

  constructor() {
    this.restoreSession();
  }

  /**
   * ¿El access token falta, no se puede leer o ya expiró (claim exp)? Solo para decidir si hay que
   * volver a iniciar sesión; la validez real la decide el backend.
   */
  tokenVencido(ahoraMs: number = Date.now()): boolean {
    return this.tokenPorVencer(0, ahoraMs);
  }

  /** ¿Al access token le quedan menos de `margenMs` (o no hay token legible)? */
  tokenPorVencer(margenMs: number = MARGEN_RENOVACION_MS, ahoraMs: number = Date.now()): boolean {
    const token = this._accessToken();
    if (!token) return true;
    try {
      const exp = claimsDeJwt(token)['exp'];
      return typeof exp !== 'number' || exp * 1000 - margenMs <= ahoraMs;
    } catch {
      return true;
    }
  }

  /**
   * Renueva el access token con el refresh token (Lambda, REFRESH_TOKEN_AUTH). Si varias peticiones
   * la piden a la vez, comparten la misma llamada. Si Cognito rechaza el refresh token (vencido o
   * revocado), la sesión se cierra; un error de red la conserva para reintentar después.
   */
  renovar(): Observable<void> {
    const refreshToken = this._refreshToken();
    if (!refreshToken) return throwError(() => new Error('La sesión no se puede renovar.'));
    if (!this.renovacion$) {
      this.renovacion$ = this.http
        .post<CognitoAuthResponse>(this.refreshUrl, { refreshToken })
        .pipe(
          map((r) => this.setSession({ ...r, refreshToken: r.refreshToken || refreshToken })),
          catchError((e: unknown) => {
            if (e instanceof HttpErrorResponse && e.status >= 400 && e.status < 500) this.logout();
            return throwError(() => e);
          }),
          finalize(() => (this.renovacion$ = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.renovacion$;
  }

  /**
   * Inicia sesión llamando a la función Lambda de Cognito.
   */
  login(email: string, password: string): Observable<CognitoAuthResponse> {
    return this.http.post<CognitoAuthResponse>(this.loginUrl, { email, password }).pipe(
      tap((response) => this.setSession(response)),
      catchError(this.handleError),
    );
  }

  /**
   * Registra y confirma un nuevo usuario en AWS Cognito vía Lambda. La Lambda responde el alta
   * (userSub, email, confirmed) sin tokens: en ese caso se inicia sesión con las mismas credenciales.
   */
  register(email: string, password: string, name?: string): Observable<CognitoAuthResponse> {
    return this.http
      .post<CognitoAuthResponse>(this.registerUrl, {
        email,
        password,
        name: name || email.split('@')[0],
        action: 'register',
      })
      .pipe(
        catchError(this.handleError),
        switchMap((response) => {
          if (response?.accessToken) {
            this.setSession(response);
            return of(response);
          }
          return this.login(email, password);
        }),
      );
  }

  /**
   * URL del Hosted UI de Cognito (OAuth 2.0 authorization code + PKCE S256 + state). Guarda el
   * verificador, el state y el destino en sessionStorage para completar el login al volver.
   */
  async urlHostedUi(returnUrl: string): Promise<string> {
    const verifier = aleatorio(48);
    const state = aleatorio(24);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const pendiente: HostedUiPendiente = { verifier, state, returnUrl };
    sessionStorage.setItem(HOSTED_UI_KEY, JSON.stringify(pendiente));
    const c = environment.cognito;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: c.clientId,
      redirect_uri: c.redirectUri,
      scope: c.scopes.join(' '),
      state,
      code_challenge: base64Url(new Uint8Array(digest)),
      code_challenge_method: 'S256',
    });
    return `${c.domain}/oauth2/authorize?${params}`;
  }

  /**
   * Vuelta del Hosted UI: valida el state, canjea el código (con el verificador PKCE) en
   * /oauth2/token y deja la sesión del usuario que de verdad inició sesión. Emite el destino.
   */
  completarHostedUi(code: string, state: string | null): Observable<string> {
    const pendiente = this.leerPendiente();
    if (!pendiente || !state || state !== pendiente.state) {
      return throwError(
        () => new Error('La respuesta de Cognito no es válida o expiró. Vuelve a iniciar sesión.'),
      );
    }
    const c = environment.cognito;
    const body = new HttpParams({
      fromObject: {
        grant_type: 'authorization_code',
        client_id: c.clientId,
        code,
        redirect_uri: c.redirectUri,
        code_verifier: pendiente.verifier,
      },
    });
    return this.http
      .post<TokenResponse>(`${c.domain}/oauth2/token`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        map((t) => {
          this.setSession(
            {
              accessToken: t.access_token,
              idToken: t.id_token,
              refreshToken: t.refresh_token,
              user: usuarioDeIdToken(t.id_token),
            },
            'hosted-ui',
          );
          return pendiente.returnUrl;
        }),
        catchError(() =>
          throwError(() => new Error('No se pudo completar el inicio de sesión con Cognito.')),
        ),
      );
  }

  private leerPendiente(): HostedUiPendiente | null {
    try {
      const raw = sessionStorage.getItem(HOSTED_UI_KEY);
      sessionStorage.removeItem(HOSTED_UI_KEY); // un solo uso
      return raw ? (JSON.parse(raw) as HostedUiPendiente) : null;
    } catch {
      return null;
    }
  }

  /**
   * Borra la sesión local de Cognito (tokens en memoria y en localStorage). No navega.
   */
  logout(): void {
    this._currentUser.set(null);
    this._accessToken.set(null);
    this._idToken.set(null);
    this._refreshToken.set(null);
    this.origen = 'formulario';
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }

  /**
   * Cierre de sesión pedido por el usuario: revoca el refresh token en Cognito (para que no sirva
   * aunque alguien lo haya copiado), borra la sesión local y, si entró por el Hosted UI, devuelve la
   * URL de /logout del dominio de Cognito para borrar también su cookie (si no, el próximo "entrar
   * con Cognito" volvería a abrir la misma cuenta sin pedir credenciales). Null = ir al login.
   */
  cerrarSesion(): string | null {
    const refreshToken = this._refreshToken();
    const urlLogout = this.origen === 'hosted-ui' ? this.urlLogoutHostedUi() : null;
    if (refreshToken) {
      const c = environment.cognito;
      const body = new HttpParams({ fromObject: { token: refreshToken, client_id: c.clientId } });
      this.http
        .post(`${c.domain}/oauth2/revoke`, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        .subscribe({ error: () => undefined }); // sin conexión: el token vence solo
    }
    this.logout();
    return urlLogout;
  }

  private urlLogoutHostedUi(): string {
    const c = environment.cognito;
    const params = new URLSearchParams({ client_id: c.clientId, logout_uri: c.logoutUri });
    return `${c.domain}/logout?${params}`;
  }

  private setSession(response: CognitoAuthResponse, origen?: OrigenSesion): void {
    // La Lambda no envía `user`: se toma del ID token (claims; la firma la valida el backend).
    const user = response.user ?? usuarioDeIdToken(response.idToken);
    if (origen) this.origen = origen;
    this._currentUser.set(user);
    this._accessToken.set(response.accessToken);
    this._idToken.set(response.idToken);
    this._refreshToken.set(response.refreshToken || null);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user,
          accessToken: response.accessToken,
          idToken: response.idToken,
          refreshToken: response.refreshToken || null,
          origen: this.origen,
        }),
      );
    } catch {
      // Ignorar
    }
  }

  private restoreSession(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.user) {
          this._currentUser.set(parsed.user);
          this._accessToken.set(parsed.accessToken);
          this._idToken.set(parsed.idToken);
          this._refreshToken.set(parsed.refreshToken || null);
          this.origen = parsed.origen === 'hosted-ui' ? 'hosted-ui' : 'formulario';
        }
      }
    } catch {
      this.logout();
    }
  }

  private handleError(error: HttpErrorResponse) {
    let msg = 'Ocurrió un error al procesar la autenticación.';
    if (error.error && typeof error.error === 'object' && error.error.error) {
      msg = error.error.error;
    } else if (error.status === 401) {
      msg = 'Credenciales inválidas. Verifica tu correo y contraseña.';
    } else if (error.status === 0) {
      msg = 'No se pudo conectar con el servidor de autenticación (CORS / Red).';
    }
    return throwError(() => new Error(msg));
  }
}

/** Usuario a partir del ID token de Cognito; sin grupo conocido queda como CUSTOMER (igual que la Lambda). */
function usuarioDeIdToken(idToken: string): CognitoUser {
  const c = claimsDeJwt(idToken);
  const texto = (v: unknown) => (typeof v === 'string' ? v : '');
  const grupos = Array.isArray(c['cognito:groups']) ? (c['cognito:groups'] as unknown[]) : [];
  const roles = grupos.filter(
    (g): g is string => typeof g === 'string' && ROLES_CONOCIDOS.includes(g),
  );
  const email = texto(c['email']);
  return {
    username: texto(c['cognito:username']) || email,
    email,
    name: texto(c['name']) || email.split('@')[0],
    sub: texto(c['sub']),
    roles: roles.length ? roles : ['CUSTOMER'],
  };
}
