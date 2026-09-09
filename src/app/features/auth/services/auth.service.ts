import { Injectable, signal, computed } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UserProfile } from '../../../core/models/user-profile.model';

/**
 * Servicio de autenticación que encapsula la lógica de MSAL (Azure Entra ID).
 *
 * Expone Signals reactivos para el estado de autenticación y métodos
 * para login, logout y obtención del perfil desde el backend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Signal reactivo: indica si el usuario tiene sesión activa */
  private readonly _isLoggedIn = signal<boolean>(false);

  /** Signal reactivo: nombre del usuario activo */
  private readonly _activeUser = signal<string>('');

  /** Señales públicas de solo lectura */
  readonly isLoggedIn = this._isLoggedIn.asReadonly();
  readonly activeUser = this._activeUser.asReadonly();

  /** Signal computado: iniciales del usuario para avatar */
  readonly userInitials = computed(() => {
    const name = this._activeUser();
    if (!name) return '?';
    return name
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  });

  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.auth}`;

  constructor(
    private readonly msalService: MsalService,
    private readonly http: HttpClient
  ) {
    // La inicialización y redirección de MSAL ya fue procesada por el APP_INITIALIZER.
    // Solo verificamos si hay una cuenta activa.
    this.checkAccount();
  }

  /** Verifica si hay una cuenta activa y actualiza los Signals */
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

  /** Cierra la sesión y redirige al usuario */
  logout(): void {
    this.msalService.logoutRedirect().subscribe();
  }

  /**
   * Obtiene el perfil del usuario desde el backend.
   * El interceptor JWT inyecta automáticamente el Bearer Token.
   */
  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/profile`);
  }

  /**
   * Adquiere un token de acceso silenciosamente.
   * Útil para escenarios donde se necesita el token fuera del interceptor.
   */
  async getAccessToken(): Promise<string | null> {
    const activeAccount = this.msalService.instance.getActiveAccount();
    if (!activeAccount) return null;

    try {
      const response = await this.msalService.instance.acquireTokenSilent({
        scopes: environment.azure.scopes,
        account: activeAccount,
      });
      return response.accessToken;
    } catch {
      console.warn('[AuthService] No se pudo adquirir token silencioso');
      return null;
    }
  }
}
