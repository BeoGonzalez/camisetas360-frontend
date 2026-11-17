import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, throwError, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CognitoUser {
  username: string;
  email: string;
  name: string;
  sub: string;
  roles: string[];
}

export interface CognitoAuthResponse {
  message: string;
  accessToken: string;
  idToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: CognitoUser;
}

const STORAGE_KEY = 'c360_cognito_session';
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

  private readonly _currentUser = signal<CognitoUser | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _idToken = signal<string | null>(null);

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
   * Inicia sesión llamando a la función Lambda de Cognito.
   */
  login(email: string, password: string): Observable<CognitoAuthResponse> {
    return this.http.post<CognitoAuthResponse>(this.loginUrl, { email, password }).pipe(
      tap((response) => this.setSession(response)),
      catchError(this.handleError),
    );
  }

  /**
   * Registra y confirma un nuevo usuario en AWS Cognito vía Lambda.
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
        tap((response) => this.setSession(response)),
        catchError(this.handleError),
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
          this.setSession({
            message: '',
            accessToken: t.access_token,
            idToken: t.id_token,
            refreshToken: '',
            tokenType: 'Bearer',
            expiresIn: 0,
            user: usuarioDeIdToken(t.id_token),
          });
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
   * Cierra la sesión activa de Cognito.
   */
  logout(): void {
    this._currentUser.set(null);
    this._accessToken.set(null);
    this._idToken.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }

  private setSession(response: CognitoAuthResponse): void {
    this._currentUser.set(response.user);
    this._accessToken.set(response.accessToken);
    this._idToken.set(response.idToken);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user: response.user,
          accessToken: response.accessToken,
          idToken: response.idToken,
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
