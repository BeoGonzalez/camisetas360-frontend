import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrdersService } from './orders.service';
import { environment } from '../../../environments/environment';
import { OrderResponse } from '../models/order-response.model';
import { ApiError } from '../http/api-error';

const base = `${environment.apiGateway}/api/v1/orders`;

function order(
  orderId: number,
  totalAmount = 1000,
  createdAt = '2026-11-10T10:00:30Z',
): OrderResponse {
  return { orderId, userEmail: 'a@b.cl', totalAmount, status: 'CREATED', createdAt, items: [] };
}

describe('OrdersService', () => {
  let service: OrdersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrdersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('GET /orders', () => {
    let n = -1;
    service.getOrders().subscribe((o) => (n = o.length));
    http.expectOne(base).flush([order(1)]);
    expect(n).toBe(1);
  });

  it('GET /orders/{orderId} numérico', () => {
    service.getOrderById(42).subscribe();
    http.expectOne(`${base}/42`).flush(order(42));
  });

  it('404 (inexistente o ajeno) -> not_found', () => {
    let err: ApiError | undefined;
    service.getOrderById(7).subscribe({ error: (e) => (err = e) });
    http.expectOne(`${base}/7`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(err?.kind).toBe('not_found');
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
  ])('GET /orders %i -> ApiError %s', (status, kind) => {
    let err: ApiError | undefined;
    service.getOrders().subscribe({ error: (e) => (err = e) });
    http.expectOne(base).flush({}, { status, statusText: 'x' });
    expect(err?.kind).toBe(kind);
  });

  it('orderId no numérico no llama al backend', () => {
    let err: ApiError | undefined;
    service.getOrderById(Number('abc')).subscribe({ error: (e) => (err = e) });
    http.expectNone(() => true);
    expect(err?.kind).toBe('not_found');
  });

  describe('matchNewOrder', () => {
    const since = '2026-11-10T10:00:00Z';

    it('ignora pedidos conocidos y prefiere el de igual monto', () => {
      const m = OrdersService.matchNewOrder([order(1, 1000), order(2, 500), order(3, 1000)], {
        knownIds: new Set([1]),
        since,
        totalAmount: 1000,
      });
      expect(m?.orderId).toBe(3);
    });

    it('si hay un único candidato nuevo lo acepta aunque el monto difiera', () => {
      const m = OrdersService.matchNewOrder([order(9, 1)], {
        knownIds: new Set(),
        since,
        totalAmount: 5,
      });
      expect(m?.orderId).toBe(9);
    });

    it('descarta pedidos anteriores al checkout', () => {
      const m = OrdersService.matchNewOrder([order(5, 1000, '2026-11-09T00:00:00Z')], {
        knownIds: new Set(),
        since,
        totalAmount: 1000,
      });
      expect(m).toBeNull();
    });
  });

  describe('waitForNewOrder (polling cada 2 s, límite ~30 s)', () => {
    it('por defecto consulta cada 2 s y se rinde a los 30 s', () => {
      vi.useFakeTimers();
      let found: OrderResponse | null | undefined;
      service
        .waitForNewOrder({ knownIds: new Set(), since: '2026-11-10T10:00:00Z', totalAmount: 1 })
        .subscribe((o) => (found = o));
      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(2000);
        http.expectOne(base).flush([]);
      }
      expect(found).toBeNull();
      vi.advanceTimersByTime(10000);
      http.expectNone(base);
    });

    it('consulta en cada intervalo hasta encontrar el pedido', () => {
      vi.useFakeTimers();
      let found: OrderResponse | null | undefined;
      service
        .waitForNewOrder(
          { knownIds: new Set([1]), since: '2026-11-10T10:00:00Z', totalAmount: 1000 },
          2000,
          6000,
        )
        .subscribe((o) => (found = o));

      vi.advanceTimersByTime(1999);
      http.expectNone(base);
      vi.advanceTimersByTime(1);
      http.expectOne(base).flush([order(1)]);
      expect(found).toBeUndefined();

      vi.advanceTimersByTime(2000);
      http.expectOne(base).flush([order(1), order(2)]);
      expect(found?.orderId).toBe(2);

      vi.advanceTimersByTime(10000);
      http.expectNone(base);
    });

    it('emite null al agotar los intentos', () => {
      vi.useFakeTimers();
      let found: OrderResponse | null | undefined;
      service
        .waitForNewOrder(
          { knownIds: new Set(), since: '2026-11-10T10:00:00Z', totalAmount: 1 },
          100,
          200,
        )
        .subscribe((o) => (found = o));
      vi.advanceTimersByTime(100);
      http.expectOne(base).flush([]);
      vi.advanceTimersByTime(100);
      http.expectOne(base).flush({}, { status: 503, statusText: 'Unavailable' });
      expect(found).toBeNull();
    });

    it('corta el polling ante 403', () => {
      vi.useFakeTimers();
      let err: ApiError | undefined;
      service
        .waitForNewOrder(
          { knownIds: new Set(), since: '2026-11-10T10:00:00Z', totalAmount: 1 },
          100,
          200,
        )
        .subscribe({ error: (e) => (err = e) });
      vi.advanceTimersByTime(100);
      http.expectOne(base).flush({}, { status: 403, statusText: 'Forbidden' });
      vi.advanceTimersByTime(500);
      http.expectNone(base);
      expect(err?.kind).toBe('forbidden');
    });
  });
});
