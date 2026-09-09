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
  // Using the exact route requested
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

  private handleError(error: HttpErrorResponse) {
    console.error('AuthService Error:', error.message);
    return throwError(() => new Error('Ocurrió un error en la autenticación. Inténtalo de nuevo más tarde.'));
  }
}
