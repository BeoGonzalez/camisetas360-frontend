import { Injectable, signal, computed, inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserProfile } from '../models/auth.model';
import { CognitoAuthService } from './cognito-auth.service';

/**
 * Servicio de autenticación unificado que encapsula Azure Entra ID (MSAL),
 * AWS Cognito y métodos de respaldo para almacenamiento local de tokens.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly msalService = inject(MsalService);
  private readonly http = inject(HttpClient);
  private readonly cognitoAuth = inject(CognitoAuthService);

  /** Signal reactivo interno para MSAL */
  private readonly _isLoggedIn = signal<boolean>(false);
  private readonly _activeUser = signal<string>('');

  /** Signal reactivo público: indica si hay sesión activa (MSAL, Cognito o LocalStorage) */
  readonly isLoggedIn = computed<boolean>(() => {
    return this._isLoggedIn() || this.cognitoAuth.isLoggedIn() || !!this.accessToken();
  });

  /** Signal reactivo público: nombre del usuario activo */
  readonly activeUser = computed<string>(() => {
    if (this.cognitoAuth.isLoggedIn()) {
      const u = this.cognitoAuth.currentUser();
      return u?.name || u?.email || 'Usuario Cognito';
    }
    return this._activeUser();
  });

  /** Signal computado: iniciales del usuario para avatar */
  readonly userInitials = computed(() => {
    if (this.cognitoAuth.isLoggedIn()) {
      return this.cognitoAuth.userInitials();
    }
    const name = this._activeUser();
    if (!name) return '?';
    return name
      .split(' ')
      .map((part: string) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  });

  /** Signal reactivo: roles del usuario extraídos del token */
  readonly userRoles = computed<string[]>(() => {
    if (this.cognitoAuth.isLoggedIn()) {
      return this.cognitoAuth.userRoles();
    }
    const activeAccount = this.msalService.instance.getActiveAccount();
    const claims = activeAccount?.idTokenClaims as Record<string, any> | undefined;
    if (claims && Array.isArray(claims['roles'])) {
      return claims['roles'] as string[];
    }
    return [];
  });

  /** Signal reactivo: indica si el usuario posee el rol ADMIN */
  readonly isAdmin = computed<boolean>(() => {
    return this.userRoles().includes('ADMIN');
  });

  /** Signal reactivo: correo electrónico del usuario autenticado */
  readonly userEmail = computed<string>(() => {
    if (this.cognitoAuth.isLoggedIn()) {
      return this.cognitoAuth.currentUser()?.email || '';
    }
    const activeAccount = this.msalService.instance.getActiveAccount();
    return activeAccount?.username || '';
  });

  /** Proveedor de autenticación activo */
  readonly authProvider = computed<'azure' | 'cognito' | 'local' | null>(() => {
    if (this.cognitoAuth.isLoggedIn()) return 'cognito';
    if (this._isLoggedIn()) return 'azure';
    if (this.accessToken()) return 'local';
    return null;
  });

  private readonly apiUrl = `${environment.apiGateway}/api/v1/auth`;

  constructor() {
    this.checkAccount();
  }

  /** Verifica si hay una cuenta activa de MSAL y actualiza los Signals */
  checkAccount(): void {
    const activeAccount = this.msalService.instance.getActiveAccount();
    if (activeAccount) {
      this._isLoggedIn.set(true);
      this._activeUser.set(activeAccount.name || activeAccount.username);
    } else {
      this._isLoggedIn.set(false);
      this._activeUser.set('');
    }
  }

  /** Inicia el flujo de login con redirección a Azure Entra ID */
  login(): void {
    this.msalService.loginRedirect().subscribe();
  }

  /** Inicia el flujo de login redirigiendo a la Interfaz Alojada de AWS Cognito */
  loginCognito(): void {
    const domain = environment.cognito.domain;
    const clientId = environment.cognito.clientId;
    const redirectUri = encodeURIComponent(environment.cognito.redirectUri);
    const scopes = environment.cognito.scopes.join('+');

    const cognitoUrl = `${domain}/login?client_id=${clientId}&response_type=code&scope=${scopes}&redirect_uri=${redirectUri}`;
    window.location.href = cognitoUrl;
  }

  /** Cierra la sesión activa */
  logout(): void {
    if (this.cognitoAuth.isLoggedIn()) {
      this.cognitoAuth.logout();
    }
    if (this.msalService.instance.getActiveAccount()) {
      this.msalService.logoutRedirect().subscribe();
    }
    this.clearTokens();
  }

  // ==========================================
  // MÉTODOS DE SOPORTE PARA EL INTERCEPTOR Y TOKENS
  // ==========================================

  /** Guarda los tokens de acceso e identidad en el almacenamiento local */
  setTokens(accessToken: string, idToken: string): void {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('id_token', idToken);
  }

  /** Retorna el Access Token actual (Cognito, CognitoAuthService o LocalStorage) */
  accessToken(): string | null {
    if (this.cognitoAuth.isLoggedIn()) {
      return this.cognitoAuth.accessToken();
    }
    return localStorage.getItem('access_token');
  }

  /** Retorna el ID Token actual */
  idToken(): string | null {
    if (this.cognitoAuth.isLoggedIn()) {
      return this.cognitoAuth.idToken();
    }
    return localStorage.getItem('id_token');
  }

  /** Limpia los tokens del almacenamiento local */
  clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
  }

  // ==========================================
  // ENDPOINTS HTTP DE AUTENTICACIÓN
  // ==========================================

  getProfile(): Observable<UserProfile> {
    if (this.cognitoAuth.isLoggedIn()) {
      const u = this.cognitoAuth.currentUser();
      return of({
        id: u?.sub || 'cognito-user',
        nombre: u?.name || 'Usuario Cognito',
        correo: u?.email || '',
        identificador: u?.username || u?.email || '',
      });
    }
    return this.http.get<UserProfile>(`${this.apiUrl}/profile`)
      .pipe(catchError(this.handleError));
  }

  verifySession(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/verify-session`, {})
      .pipe(catchError(this.handleError));
  }

  getPublicStatus(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/public/status`)
      .pipe(catchError(this.handleError));
  }

  /** Adquiere un token de acceso asíncrono para MSAL o Cognito */
  async getAccessToken(): Promise<string | null> {
    if (this.cognitoAuth.isLoggedIn()) {
      return this.cognitoAuth.accessToken();
    }

    const localToken = this.accessToken();
    if (localToken) return localToken;

    const activeAccount = this.msalService.instance.getActiveAccount();
    if (!activeAccount) return null;

    try {
      const response = await this.msalService.instance.acquireTokenSilent({
        scopes: environment.azure.scopes,
        account: activeAccount,
      });
      return response.accessToken;
    } catch {
      console.warn('[AuthService] No se pudo adquirir token silencioso de MSAL');
      return null;
    }
  }

  private handleError(error: HttpErrorResponse) {
    console.error('AuthService Error:', error.message);
    return throwError(() => new Error('Ocurrió un error en la autenticación. Inténtalo de nuevo más tarde.'));
  }
}