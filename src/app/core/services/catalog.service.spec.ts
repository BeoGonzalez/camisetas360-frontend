import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';
import { environment } from '../../../environments/environment';
import { ApiError } from '../http/api-error';

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;
  const base = `${environment.apiGateway}/api/v1/catalog/products`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /products', () => {
    let n = -1;
    service.getProducts().subscribe((p) => (n = p.length));
    const req = http.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([{ sku: 'A', name: 'A', category: 'C', price: 1, stock: 1, description: '' }]);
    expect(n).toBe(1);
  });

  it('GET /products/{sku}', () => {
    service.getProduct('CAM-001').subscribe();
    http.expectOne(`${base}/CAM-001`).flush({ sku: 'CAM-001' });
  });

  it('404 -> not_found con mensaje propio', () => {
    let err: ApiError | undefined;
    service.getProduct('NOPE').subscribe({ error: (e) => (err = e) });
    http.expectOne(`${base}/NOPE`).flush({}, { status: 404, statusText: 'Not Found' });
    expect(err?.kind).toBe('not_found');
    expect(err?.message).toBe('El producto no existe.');
  });

  it('GET /products?sku=A&sku=B (filtro por varios sku)', () => {
    service.getProducts(['A', 'B']).subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.getAll('sku')).toEqual(['A', 'B']);
    req.flush([]);
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [503, 'unavailable'],
  ])('GET /products %i -> ApiError %s', (status, kind) => {
    let err: ApiError | undefined;
    service.getProducts().subscribe({ error: (e) => (err = e) });
    http.expectOne(base).flush({ title: 'x', detail: 'stack' }, { status, statusText: 'x' });
    expect(err?.kind).toBe(kind);
    expect(err?.message).not.toContain('stack');
  });

  it('sku inválido no llama al backend (evita 400 y no registra visita)', () => {
    let err: ApiError | undefined;
    service.getProduct('a b/../c').subscribe({ error: (e) => (err = e) });
    http.expectNone(() => true);
    expect(err?.kind).toBe('validation');
  });

  it('error de red -> network y reintentable', () => {
    let err: ApiError | undefined;
    service.getProducts().subscribe({ error: (e) => (err = e) });
    http.expectOne(base).error(new ProgressEvent('error'));
    expect(err?.kind).toBe('network');
    expect(err?.retryable).toBe(true);
  });
});
