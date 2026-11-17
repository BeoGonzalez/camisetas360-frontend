import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  RecomendacionesModeloResponse,
  RecomendacionesResponse,
} from '../models/recommendation.model';
import { toApiError } from '../http/api-error';

/**
 * Recomendaciones personalizadas (CUSTOMER + Catalog.Read). El usuario lo determina el token.
 * - GET /api/v1/recomendaciones: ranking del microservicio (fuente MODELO | PESOS | POPULARES).
 * - GET /api/v1/analytics/recomendaciones: vista de analytics con motivo y perfil de intereses.
 * Lista vacía si el usuario aún no tiene historial (no se inventan datos de respaldo).
 */
@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.analytics}`;
  private readonly modeloUrl = `${environment.apiGateway}${environment.endpoints.recomendaciones}`;

  /** GET /recomendaciones */
  getRecomendacionesModelo(): Observable<RecomendacionesModeloResponse> {
    return this.http
      .get<RecomendacionesModeloResponse>(this.modeloUrl)
      .pipe(catchError((e) => throwError(() => toApiError(e))));
  }

  /** GET /analytics/recomendaciones */
  getRecomendaciones(): Observable<RecomendacionesResponse> {
    return this.http
      .get<RecomendacionesResponse>(`${this.apiUrl}/recomendaciones`)
      .pipe(catchError((e) => throwError(() => toApiError(e))));
  }
}
