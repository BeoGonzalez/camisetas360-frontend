import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CartService } from './cart.service';
import { environment } from '../../../environments/environment';
import { CartDTO, CartItemDTO, CheckoutResponse } from '../models/cart.model';
import { ApiError } from '../http/api-error';

const base = `${environment.apiGateway}/api/v1/carrito`;

function cart(items: Partial<CartItemDTO>[] = [], envio: CartDTO['envio'] = null): CartDTO {
  const full: CartItemDTO[] = items.map((i) => ({
    sku: 'CAM-1',
    nombre: 'Camiseta',
    categoria: 'Futbol',
    precioUnitario: 10000,
    cantidad: 1,
    subtotal: 10000,
    ...i,
  }));
  const subtotal = full.reduce((s, i) => s + i.subtotal, 0);
  const costoEnvio = envio?.costo ?? 0;
  return { items: full, envio, subtotal, costoEnvio, total: subtotal + costoEnvio };
}

const product = {
  sku: 'CAM-1',
  name: 'Camiseta',
  category: 'Futbol',
  price: 10000,
  stock: 5,
  description: '',
};

describe('CartService', () => {
  let service: CartService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CartService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /carrito actualiza el estado', () => {
    service.load().subscribe();
    http.expectOne(base).flush(cart([{ cantidad: 2, subtotal: 20000 }]));
    expect(service.itemCount()).toBe(2);
    expect(service.loaded()).toBe(true);
  });

  it('POST /carrito/items con los campos en español del contrato', () => {
    service.addItem(product, 3).subscribe();
    const req = http.expectOne(`${base}/items`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      sku: 'CAM-1',
      nombre: 'Camiseta',
      categoria: 'Futbol',
      precioUnitario: 10000,
      cantidad: 3,
    });
    req.flush(cart([{ cantidad: 3, subtotal: 30000 }]));
    expect(service.itemCount()).toBe(3);
  });

  it('no envía si se superarían 99 unidades', () => {
    service.load().subscribe();
    http.expectOne(base).flush(cart([{ cantidad: 98 }]));
    let err: ApiError | undefined;
    service.addItem(product, 2).subscribe({ error: (e) => (err = e) });
    http.expectNone(`${base}/items`);
    expect(err?.kind).toBe('business');
  });

  it('422 del backend -> mensaje de máximo 99', () => {
    let err: ApiError | undefined;
    service.addItem(product, 1).subscribe({ error: (e) => (err = e) });
    http.expectOne(`${base}/items`).flush({}, { status: 422, statusText: 'Unprocessable' });
    expect(err?.message).toContain('99');
  });

  it('DELETE /carrito/items/{sku}; 404 -> not_found', () => {
    let err: ApiError | undefined;
    service.removeItem('CAM-1').subscribe({ error: (e) => (err = e) });
    const req = http.expectOne(`${base}/items/CAM-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({}, { status: 404, statusText: 'Not Found' });
    expect(err?.kind).toBe('not_found');
  });

  it('subir cantidad = POST con la diferencia', () => {
    const item = cart([{ cantidad: 2 }]).items[0];
    service.setQuantity(item, 5).subscribe();
    const req = http.expectOne(`${base}/items`);
    expect(req.request.body.cantidad).toBe(3);
    req.flush(cart([{ cantidad: 5 }]));
  });

  it('bajar cantidad = DELETE y luego POST con la nueva cantidad', () => {
    const item = cart([{ cantidad: 4 }]).items[0];
    service.setQuantity(item, 1).subscribe();
    http.expectOne({ method: 'DELETE', url: `${base}/items/CAM-1` }).flush(cart());
    const post = http.expectOne({ method: 'POST', url: `${base}/items` });
    expect(post.request.body.cantidad).toBe(1);
    post.flush(cart([{ cantidad: 1 }]));
  });

  it('cantidad 0 elimina el ítem', () => {
    service.setQuantity(cart([{}]).items[0], 0).subscribe();
    http.expectOne({ method: 'DELETE', url: `${base}/items/CAM-1` }).flush(cart());
  });

  it('cantidad fuera de 1..99 no llama al backend', () => {
    let err: ApiError | undefined;
    service.setQuantity(cart([{}]).items[0], 100).subscribe({ error: (e) => (err = e) });
    http.expectNone(() => true);
    expect(err?.kind).toBe('validation');
  });

  it('PUT /carrito/envio', () => {
    service.setShipping({ metodo: 'EXPRESS', region: 'RM', comuna: 'Santiago' }).subscribe();
    const req = http.expectOne(`${base}/envio`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ metodo: 'EXPRESS', region: 'RM', comuna: 'Santiago' });
    req.flush(cart([{}], { metodo: 'EXPRESS', region: 'RM', comuna: 'Santiago', costo: 6990 }));
    expect(service.cart().costoEnvio).toBe(6990);
  });

  it('checkout envía {items:[{sku,quantity,unitPrice}]}, relee el carrito y quita lo comprado', () => {
    service.load().subscribe();
    http
      .expectOne(base)
      .flush(cart([{ sku: 'A', cantidad: 2, precioUnitario: 500 }, { sku: 'B' }]));

    let res: CheckoutResponse | undefined;
    service.checkout().subscribe((r) => (res = r));
    const req = http.expectOne(`${base}/checkout`);
    expect(req.request.body).toEqual({
      items: [
        { sku: 'A', quantity: 2, unitPrice: 500 },
        { sku: 'B', quantity: 1, unitPrice: 10000 },
      ],
    });
    req.flush(
      { requestId: 'uuid-1', userEmail: 'a@b.cl', totalAmount: 11000, status: 'PROCESSING' },
      { status: 202, statusText: 'Accepted' },
    );
    // El backend no vació el carrito: se reflejan y eliminan los ítems comprados.
    http
      .expectOne(base)
      .flush(cart([{ sku: 'A', cantidad: 2, precioUnitario: 500 }, { sku: 'B' }]));
    http.expectOne(`${base}/items/A`).flush(cart([{ sku: 'B' }]));
    http.expectOne(`${base}/items/B`).flush(cart());
    expect(res?.requestId).toBe('uuid-1');
    expect(service.items()).toEqual([]);
  });

  it('checkout: si falla vaciar el carrito, el 202 igual se informa', () => {
    service.load().subscribe();
    http.expectOne(base).flush(cart([{ sku: 'A' }]));
    let res: CheckoutResponse | undefined;
    service.checkout().subscribe((r) => (res = r));
    http
      .expectOne(`${base}/checkout`)
      .flush({ requestId: 'u', userEmail: 'a@b.cl', totalAmount: 1, status: 'PROCESSING' });
    http.expectOne(base).flush(cart([{ sku: 'A' }]));
    http.expectOne(`${base}/items/A`).flush({}, { status: 500, statusText: 'Error' });
    expect(res?.requestId).toBe('u');
  });

  it('checkout: si el backend ya vació el carrito, solo se refleja (sin DELETE)', () => {
    service.load().subscribe();
    http.expectOne(base).flush(cart([{ sku: 'A' }]));
    let res: CheckoutResponse | undefined;
    service.checkout().subscribe((r) => (res = r));
    http
      .expectOne(`${base}/checkout`)
      .flush(
        { requestId: 'u', userEmail: 'a@b.cl', totalAmount: 1, status: 'PROCESSING' },
        { status: 202, statusText: 'Accepted' },
      );
    http.expectOne(base).flush(cart());
    http.expectNone(`${base}/items/A`);
    expect(res?.requestId).toBe('u');
    expect(service.items()).toEqual([]);
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
  ])('GET /carrito %i -> ApiError %s', (status, kind) => {
    let err: ApiError | undefined;
    service.load().subscribe({ error: (e) => (err = e) });
    http.expectOne(base).flush({}, { status, statusText: 'x' });
    expect(err?.kind).toBe(kind);
  });

  it('DELETE de un sku que ya no está -> 404 not_found', () => {
    let err: ApiError | undefined;
    service.removeItem('X').subscribe({ error: (e) => (err = e) });
    http.expectOne(`${base}/items/X`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(err?.kind).toBe('not_found');
  });

  it('checkout 422 (token sin email) -> mensaje claro', () => {
    service.load().subscribe();
    http.expectOne(base).flush(cart([{}]));
    let err: ApiError | undefined;
    service.checkout().subscribe({ error: (e) => (err = e) });
    http.expectOne(`${base}/checkout`).flush({}, { status: 422, statusText: 'Unprocessable' });
    expect(err?.kind).toBe('business');
    expect(err?.message).toContain('correo');
  });

  it('checkout con carrito vacío no llama al backend', () => {
    let err: ApiError | undefined;
    service.checkout().subscribe({ error: (e) => (err = e) });
    http.expectNone(`${base}/checkout`);
    expect(err?.kind).toBe('validation');
  });
});
