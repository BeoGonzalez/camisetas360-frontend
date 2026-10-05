import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { OrderResponse } from '../../../core/models/order-response.model';

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