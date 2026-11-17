import { Injectable, signal, computed, inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, throwError, tap, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppRole, UserProfile } from '../models/auth.model';
import { toApiError } from '../http/api-error';
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

  /** Roles del usuario: claim `roles` de Entra (id token) o roles de la sesión Cognito. */
  readonly userRoles = computed<string[]>(() => {
    if (this.cognitoAuth.isLoggedIn()) {
      return this.cognitoAuth.userRoles();
    }
    this._isLoggedIn(); // re-evalúa al cambiar la cuenta activa
    const activeAccount = this.msalService.instance.getActiveAccount();
    const claims = activeAccount?.idTokenClaims as Record<string, unknown> | undefined;
    const roles = claims?.['roles'];
    return Array.isArray(roles) ? (roles as string[]) : [];
  });

  /** Signal reactivo: indica si el usuario posee el rol ADMIN */
  readonly isAdmin = computed<boolean>(() => this.userRoles().includes('ADMIN'));

  readonly isCustomer = computed<boolean>(() => this.userRoles().includes('CUSTOMER'));

  /** ADMIN o CATALOG_MANAGER: dashboard de métricas. */
  readonly canSeeMetrics = computed<boolean>(() => this.hasAnyRole(['ADMIN', 'CATALOG_MANAGER']));

  /** ADMIN o CATALOG_MANAGER: gestión de camisetas (/admin/productos). */
  readonly canManageCatalog = computed<boolean>(() =>
    this.hasAnyRole(['ADMIN', 'CATALOG_MANAGER']),
  );

  hasAnyRole(roles: readonly AppRole[]): boolean {
    const mine = this.userRoles();
    return roles.some((r) => mine.includes(r));
  }

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

  /**
   * Inicia el flujo de login con redirección a Azure Entra ID. Tras volver de Microsoft, MSAL
   * lleva al usuario a `returnUrl` (ruta interna ya validada por quien llama).
   */
  login(returnUrl?: string): void {
    const request = returnUrl
      ? { scopes: [], redirectStartPage: new URL(returnUrl, window.location.origin).href }
      : undefined;
    this.msalService.loginRedirect(request).subscribe();
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
    this.profile.set(null);
    this.profile$ = null;
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

  /** Perfil sincronizado con el backend (GET /auth/profile), o null si aún no se obtiene. */
  readonly profile = signal<UserProfile | null>(null);
  private profile$: Observable<UserProfile> | null = null;

  /**
   * GET /api/v1/auth/profile. Sincroniza el perfil en el backend; se llama UNA vez por
   * sesión (resultado cacheado). Con Cognito no hay perfil Entra: se arma con los datos locales.
   */
  getProfile(): Observable<UserProfile> {
    if (this.cognitoAuth.isLoggedIn()) {
      const u = this.cognitoAuth.currentUser();
      return of({
        userId: u?.sub || '',
        tenantId: '',
        email: u?.email || '',
        name: u?.name || '',
      });
    }
    if (!this.profile$) {
      this.profile$ = this.http.get<UserProfile>(`${this.apiUrl}/profile`).pipe(
        tap((p) => this.profile.set(p)),
        catchError((err) => {
          this.profile$ = null; // permitir reintento manual
          return throwError(() => toApiError(err));
        }),
        shareReplay(1),
      );
    }
    return this.profile$;
  }

  /** Sincroniza el perfil tras el login sin bloquear la UI (errores se muestran en /perfil). */
  syncProfileOnce(): void {
    if (this._isLoggedIn() && !this.cognitoAuth.isLoggedIn()) {
      this.getProfile().subscribe({ error: () => undefined });
    }
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
      return null;
    }
  }
}
