import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserProfile } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiGateway}/api/v1/auth`;

  /**
   * Obtiene el perfil del usuario (requiere token JWT)
   */
  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/profile`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Valida la sesión activa del usuario (requiere token JWT)
   */
  verifySession(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/verify-session`, {})
      .pipe(catchError(this.handleError));
  }

  /**
   * Endpoint público sin restricciones de seguridad
   */
  getPublicStatus(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/public/status`)
      .pipe(catchError(this.handleError));
  }

  // ==========================================
  // MÉTODOS REQUERIDOS POR EL INTERCEPTOR
  // ==========================================

  /**
   * Guarda los tokens de acceso e identidad en el almacenamiento local
   */
  setTokens(accessToken: string, idToken: string): void {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('id_token', idToken);
  }

  /**
   * Retorna el Access Token actual
   */
  accessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Retorna el ID Token actual
   */
  idToken(): string | null {
    return localStorage.getItem('id_token');
  }

  /**
   * Verifica si el usuario cuenta con una sesión activa
   */
  isLoggedIn(): boolean {
    return !!this.accessToken();
  }

  /**
   * Cierra la sesión limpiando el almacenamiento
   */
  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
  }

  private handleError(error: HttpErrorResponse) {
    console.error('AuthService Error:', error.message);
    return throwError(() => new Error('Ocurrió un error en la autenticación. Inténtalo de nuevo más tarde.'));
  }
}