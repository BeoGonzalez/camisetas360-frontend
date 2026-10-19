import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
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
    return this.http
      .post<CognitoAuthResponse>(this.loginUrl, { email, password })
      .pipe(
        tap((response) => this.setSession(response)),
        catchError(this.handleError)
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
        catchError(this.handleError)
      );
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
        })
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

