import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CheckoutTrackerService } from './checkout-tracker.service';
import { CartService } from './cart.service';
import { environment } from '../../../environments/environment';

const api = environment.apiGateway;

describe('CheckoutTrackerService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('SUPUESTO: el ordenId de pago es el requestId del checkout', () => {
    expect(environment.pagos.ordenIdFuente).toBe('checkoutRequestId');
    expect(CheckoutTrackerService.ordenIdParaPago({ requestId: 'req-uuid' })).toBe('req-uuid');
  });

  it('checkout: línea base de pedidos -> 202 -> polling hasta vincular orderId', () => {
    const cart = TestBed.inject(CartService);
    cart.load().subscribe();
    http.expectOne(`${api}/api/v1/carrito`).flush({
      items: [
        {
          sku: 'A',
          nombre: 'A',
          categoria: null,
          precioUnitario: 1000,
          cantidad: 1,
          subtotal: 1000,
        },
      ],
      envio: { metodo: 'STANDARD', region: 'RM', comuna: 'Stgo', costo: 3990 },
      subtotal: 1000,
      costoEnvio: 3990,
      total: 4990,
    });

    const tracker = TestBed.inject(CheckoutTrackerService);
    let requestId = '';
    tracker.checkout().subscribe((c) => (requestId = c.requestId));

    http.expectOne(`${api}/api/v1/orders`).flush([
      {
        orderId: 1,
        userEmail: 'a',
        totalAmount: 1,
        status: 'CREATED',
        createdAt: '2026-11-01T00:00:00Z',
        items: [],
      },
    ]);
    http
      .expectOne(`${api}/api/v1/carrito/checkout`)
      .flush({ requestId: 'req-1', userEmail: 'a@b.cl', totalAmount: 1000, status: 'PROCESSING' });
    http.expectOne(`${api}/api/v1/carrito`).flush({
      items: [
        {
          sku: 'A',
          nombre: 'A',
          categoria: null,
          precioUnitario: 1000,
          cantidad: 1,
          subtotal: 1000,
        },
      ],
      envio: null,
      subtotal: 1000,
      costoEnvio: 0,
      total: 1000,
    });
    http
      .expectOne(`${api}/api/v1/carrito/items/A`)
      .flush({ items: [], envio: null, subtotal: 0, costoEnvio: 0, total: 0 });

    expect(requestId).toBe('req-1');
    const compra = tracker.porRequestId('req-1')!;
    expect(compra.estado).toBe('BUSCANDO');
    expect(compra.montoPago).toBe(4990); // total mostrado al cliente (incluye envío)
    expect(compra.totalAmount).toBe(1000);

    vi.advanceTimersByTime(environment.ordersPolling.intervalMs);
    http.expectOne(`${api}/api/v1/orders`).flush([
      {
        orderId: 1,
        userEmail: 'a',
        totalAmount: 1,
        status: 'CREATED',
        createdAt: '2026-11-01T00:00:00Z',
        items: [],
      },
      {
        orderId: 2,
        userEmail: 'a',
        totalAmount: 1000,
        status: 'CREATED',
        createdAt: '2026-11-10T10:00:01Z',
        items: [],
      },
    ]);
    expect(tracker.porRequestId('req-1')?.estado).toBe('ENCONTRADO');
    expect(tracker.porOrderId(2)?.requestId).toBe('req-1');

    // Persistencia: solo ids y montos, nada sensible.
    const stored = localStorage.getItem('c360_compras') ?? '';
    expect(stored).toContain('req-1');
    expect(stored).not.toMatch(/numeroTarjeta|cvv|token/i);
  });
});
