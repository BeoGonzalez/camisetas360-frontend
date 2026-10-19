import { Injectable, signal, computed, inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UserProfile } from '../../../core/models/user-profile.model';
import { CognitoAuthService } from '../../../core/services/cognito-auth.service';

/**
 * Servicio de autenticación unificado que encapsula Azure Entra ID (MSAL)
 * y AWS Cognito (Serverless Lambda).
 *
 * Expone Signals reactivos para el estado de autenticación y métodos
 * para login, logout y obtención del perfil.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly msalService = inject(MsalService);
  private readonly http = inject(HttpClient);
  private readonly cognitoAuth = inject(CognitoAuthService);

  /** Signal reactivo interno para MSAL */
  private readonly _isLoggedIn = signal<boolean>(false);
  private readonly _activeUser = signal<string>('');

  /** Signal reactivo público: indica si hay sesión activa (MSAL o Cognito) */
  readonly isLoggedIn = computed<boolean>(() => {
    return this._isLoggedIn() || this.cognitoAuth.isLoggedIn();
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
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  });

  /** Signal reactivo: roles del usuario extraídos del token (Cognito o MSAL) */
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

  /** Proveedor de autenticación activo ('azure' | 'cognito' | null) */
  readonly authProvider = computed<'azure' | 'cognito' | null>(() => {
    if (this.cognitoAuth.isLoggedIn()) return 'cognito';
    if (this._isLoggedIn()) return 'azure';
    return null;
  });

  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.auth}`;

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

  /** Cierra la sesión activa (tanto de Cognito como de MSAL) */
  logout(): void {
    if (this.cognitoAuth.isLoggedIn()) {
      this.cognitoAuth.logout();
    }
    if (this.msalService.instance.getActiveAccount()) {
      this.msalService.logoutRedirect().subscribe();
    }
  }

  /**
   * Obtiene el perfil del usuario desde el backend o del usuario Cognito.
   */
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
    return this.http.get<UserProfile>(`${this.apiUrl}/profile`);
  }

  /**
   * Adquiere un token de acceso (Cognito o MSAL).
   */
  async getAccessToken(): Promise<string | null> {
    if (this.cognitoAuth.isLoggedIn()) {
      return this.cognitoAuth.accessToken();
    }

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
}

