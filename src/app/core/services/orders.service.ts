import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Sube 3 niveles: services -> core -> app -> src/environments
import { environment } from '../../../environments/environment';

// Sube 1 nivel: services -> core/models
import { OrderResponse } from '../models/order-response.model';

/**
 * Servicio encargado de consultar las órdenes
 * pertenecientes al usuario autenticado.
 *
 * El access token se agrega automáticamente
 * mediante MsalInterceptor.
 */
@Injectable({
  providedIn: 'root',
})
export class OrdersService {

  private readonly apiUrl =
    `${environment.apiGateway}${environment.endpoints.orders}`;

  constructor(
    private readonly http: HttpClient
  ) {}

  /**
   * Obtiene todas las órdenes del usuario autenticado.
   *
   * GET /api/v1/orders
   *
   * Requiere:
   * - ROLE_CUSTOMER
   * - SCOPE_Orders.Read
   */
  getOrders(): Observable<OrderResponse[]> {
    return this.http.get<OrderResponse[]>(
      this.apiUrl
    );
  }

  /**
   * Obtiene una orden específica perteneciente
   * al usuario autenticado.
   *
   * GET /api/v1/orders/{orderId}
   *
   * Requiere:
   * - ROLE_CUSTOMER
   * - SCOPE_Orders.Read
   */
  getOrderById(
    orderId: number
  ): Observable<OrderResponse> {

    return this.http.get<OrderResponse>(
      `${this.apiUrl}/${orderId}`
    );
  }
}
