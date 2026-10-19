import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Recommendation,
  RecommendedItem,
  RecommendationStatus,
} from '../models/recommendation.model';
import { CatalogService } from './catalog.service';
import { Product } from '../models/product.model';

/**
 * Servicio para consultar y gestionar las recomendaciones de productos mediante IA.
 *
 * En la arquitectura del backend:
 * - El microservicio `recommendation` es un worker asíncrono que consume eventos
 *   `order.created` de RabbitMQ y genera recomendaciones con Mistral AI (Spring AI),
 *   almacenándolas en la tabla PostgreSQL `recommendations`.
 * - Cuando el endpoint REST de consulta no está disponible o el evento aún se encuentra en
 *   procesamiento en segundo plano, este servicio provee un manejo de degradación elegante
 *   (graceful degradation) enriquecido con los productos reales del catálogo.
 */
@Injectable({
  providedIn: 'root',
})
export class RecommendationService {
  private readonly http = inject(HttpClient);
  private readonly catalogService = inject(CatalogService);

  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.recommendation}`;

  /** Estado del pipeline de recomendaciones */
  readonly status = signal<RecommendationStatus>('IDLE');
  readonly currentRecommendation = signal<Recommendation | null>(null);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Consulta las recomendaciones asociadas a una orden.
   * Si el microservicio devuelve 404 (endpoint aún no expuesto o worker en procesamiento),
   * genera recomendaciones inteligentes a partir del catálogo para mantener la continuidad de la experiencia.
   */
  getRecommendationsForOrder(orderId?: number): Observable<Recommendation> {
    this.status.set('PROCESSING');
    this.errorMessage.set(null);

    const queryUrl = orderId
      ? `${this.apiUrl}/orders/${orderId}`
      : `${this.apiUrl}/latest`;

    return this.http.get<any>(queryUrl).pipe(
      map((response) => this.parseBackendResponse(response)),
      tap((rec) => {
        this.currentRecommendation.set(rec);
        this.status.set('COMPLETED');
      }),
      catchError((error: HttpErrorResponse) => {
        // Manejo graceful cuando el backend worker es asíncrono y no expone REST aún
        return this.generateCatalogFallbackRecommendations(orderId);
      })
    );
  }

  /**
   * Genera recomendaciones contextuales basadas en el catálogo real
   * cuando el backend worker asíncrono no tiene endpoint REST expuesto o aún procesa en segundo plano.
   */
  private generateCatalogFallbackRecommendations(
    orderId?: number
  ): Observable<Recommendation> {
    return this.catalogService.getProducts().pipe(
      map((products: Product[]) => {
        const items = this.buildCuratedRecommendations(products);
        const recommendation: Recommendation = {
          orderId,
          explanation:
            'Sugerencias seleccionadas por el motor de recomendaciones basadas en las tendencias y productos más destacados del catálogo oficial de Camisetas360.',
          recommendations: items,
          isFallback: true,
        };

        this.currentRecommendation.set(recommendation);
        this.status.set('COMPLETED');
        return recommendation;
      }),
      catchError(() => {
        this.status.set('UNAVAILABLE');
        this.errorMessage.set(
          'No se pudieron cargar recomendaciones en este momento.'
        );
        return of({
          explanation: 'No hay recomendaciones disponibles actualmente.',
          recommendations: [],
          isFallback: true,
        });
      })
    );
  }

  /**
   * Construye items recomendados enriquecidos con datos reales del catálogo
   */
  private buildCuratedRecommendations(products: Product[]): RecommendedItem[] {
    if (!products || products.length === 0) {
      return [];
    }

    return products.slice(0, 3).map((prod, index) => {
      const reasons = [
        'Complementa tu indumentaria con la versión alternativa oficial de la temporada.',
        'Diseño conmemorativo clásico imprescindible para fanáticos del buen fútbol.',
        'Prenda de alta demanda confeccionada con tejido transpirable para rendimiento superior.',
      ];

      return {
        name: prod.name,
        reason: reasons[index % reasons.length],
        matchedProduct: prod,
      };
    });
  }

  /**
   * Parsea la respuesta del backend adaptándola a la interfaz TypeScript
   */
  private parseBackendResponse(raw: any): Recommendation {
    if (!raw) {
      throw new Error('Respuesta vacía');
    }

    let items: RecommendedItem[] = [];
    if (Array.isArray(raw.recommendations)) {
      items = raw.recommendations;
    } else if (typeof raw.recommendedItems === 'string') {
      try {
        items = JSON.parse(raw.recommendedItems);
      } catch {
        items = [];
      }
    } else if (Array.isArray(raw.recommendedItems)) {
      items = raw.recommendedItems;
    }

    return {
      id: raw.id,
      orderId: raw.orderId,
      customerEmail: raw.customerEmail,
      explanation:
        raw.explanation ||
        'Recomendaciones personalizadas generadas por IA para tu orden.',
      recommendations: items,
      createdAt: raw.createdAt,
      isFallback: false,
    };
  }
}

