import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  catchError,
  concatMap,
  defaultIfEmpty,
  filter,
  from,
  map,
  of,
  take,
  throwError,
  timer,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrderResponse } from '../models/order-response.model';
import { ApiError, toApiError } from '../http/api-error';

/** Criterio para reconocer el pedido nacido de un checkout (no hay búsqueda por requestId). */
export interface NewOrderCriteria {
  /** orderIds que ya existían antes del checkout. */
  knownIds: ReadonlySet<number>;
  /** Momento del checkout (ISO). */
  since: string;
  /** totalAmount del 202 (suma items * unitPrice, sin envío). */
  totalAmount: number;
}

/** Tolerancia de reloj entre navegador y backend al comparar createdAt. */
const CLOCK_SKEW_MS = 2 * 60 * 1000;

/**
 * Pedidos del usuario autenticado (/api/v1/orders, CUSTOMER + Orders.Read).
 * No existe endpoint para crear pedidos: nacen del checkout asíncrono.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.orders}`;

  /** GET /orders */
  getOrders(): Observable<OrderResponse[]> {
    return this.http
      .get<OrderResponse[]>(this.apiUrl)
      .pipe(catchError((e) => throwError(() => toApiError(e))));
  }

  /** GET /orders/{orderId}; orderId numérico. 404 si no existe o es de otro usuario. */
  getOrderById(orderId: number): Observable<OrderResponse> {
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      const err: ApiError = {
        kind: 'not_found',
        status: 404,
        message: 'El pedido no existe.',
        retryable: false,
      };
      return throwError(() => err);
    }
    return this.http
      .get<OrderResponse>(`${this.apiUrl}/${orderId}`)
      .pipe(
        catchError((e) => throwError(() => toApiError(e, { not_found: 'El pedido no existe.' }))),
      );
  }

  /** Selecciona, entre los pedidos actuales, el que corresponde al checkout. */
  static matchNewOrder(orders: OrderResponse[], c: NewOrderCriteria): OrderResponse | null {
    const since = Date.parse(c.since) - CLOCK_SKEW_MS;
    const candidates = orders
      .filter((o) => !c.knownIds.has(o.orderId))
      .filter((o) => Number.isNaN(Date.parse(o.createdAt)) || Date.parse(o.createdAt) >= since)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return (
      candidates.find((o) => Math.abs(o.totalAmount - c.totalAmount) < 0.01) ??
      (candidates.length === 1 ? candidates[0] : null)
    );
  }

  /**
   * Polling sobre GET /orders cada `intervalMs` (2 s) hasta `timeoutMs` (~30 s) o hasta ver el
   * pedido nuevo (lo crea `orders` por RabbitMQ segundos después del 202). Emite el pedido, o
   * null si se agotó el tiempo. Errores transitorios (red/5xx) se ignoran; 401/403 lo cortan.
   */
  waitForNewOrder(
    criteria: NewOrderCriteria,
    intervalMs: number = environment.ordersPolling.intervalMs,
    timeoutMs: number = environment.ordersPolling.timeoutMs,
  ): Observable<OrderResponse | null> {
    const intentos = Math.max(1, Math.floor(timeoutMs / intervalMs));
    const delaysMs = Array.from({ length: intentos }, () => intervalMs);
    return from(delaysMs).pipe(
      concatMap((d) =>
        timer(d).pipe(
          concatMap(() =>
            this.getOrders().pipe(
              catchError((e: ApiError) =>
                e.kind === 'unauthenticated' || e.kind === 'forbidden'
                  ? throwError(() => e)
                  : of([] as OrderResponse[]),
              ),
            ),
          ),
        ),
      ),
      map((orders) => OrdersService.matchNewOrder(orders, criteria)),
      filter((o): o is OrderResponse => o !== null),
      take(1),
      defaultIfEmpty(null),
    );
  }
}
