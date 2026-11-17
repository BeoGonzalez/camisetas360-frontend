import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductAdminService, MAX_IMAGE_BYTES, validateImage } from './product-admin.service';
import { ApiError } from '../http/api-error';
import { Product, ProductUpdateRequest } from '../models/product.model';
import { environment } from '../../../environments/environment';

const base = `${environment.apiGateway}/api/v1/catalog/products`;

const datos: ProductUpdateRequest = {
  name: 'Camiseta Arsenal Local',
  team: 'Arsenal',
  kitType: 'LOCAL',
  category: 'Fútbol',
  league: 'Premier League',
  price: 94.99,
  stock: 10,
  description: null,
};
const producto: Product = { sku: 'PL-ARS-LOC-2728', ...datos, imageVersion: null };

function archivo(type: string, size = 10): File {
  return new File([new Uint8Array(size)], 'foto', { type });
}

describe('ProductAdminService', () => {
  let service: ProductAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crea con POST /products y devuelve el producto del backend', () => {
    let creado: Product | undefined;
    service.create({ sku: producto.sku, ...datos }).subscribe((p) => (creado = p));
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ sku: producto.sku, ...datos });
    req.flush(producto);
    expect(creado).toEqual(producto);
  });

  it('edita con PUT /products/{sku} codificando el SKU', () => {
    service.update('A B', datos).subscribe();
    const req = http.expectOne(`${base}/A%20B`);
    expect(req.request.method).toBe('PUT');
    req.flush(producto);
  });

  it('elimina con DELETE /products/{sku}', () => {
    let listo = false;
    service.remove(producto.sku).subscribe(() => (listo = true));
    const req = http.expectOne(`${base}/${producto.sku}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(listo).toBe(true);
  });

  it('sube la foto como bytes con su Content-Type', () => {
    const foto = archivo('image/png');
    service.uploadImage(producto.sku, foto).subscribe();
    const req = http.expectOne(`${base}/${producto.sku}/imagen`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toBe(foto);
    expect(req.request.headers.get('Content-Type')).toBe('image/png');
    req.flush({ ...producto, imageVersion: 1 });
  });

  it('no envía fotos de otro formato ni de más de 2 MB', () => {
    const errores: ApiError[] = [];
    service.uploadImage('X', archivo('image/gif')).subscribe({ error: (e) => errores.push(e) });
    service
      .uploadImage('X', archivo('image/jpeg', MAX_IMAGE_BYTES + 1))
      .subscribe({ error: (e) => errores.push(e) });
    http.expectNone(() => true);
    expect(errores.map((e) => e.message)).toEqual([
      'La foto debe ser JPG, PNG o WebP.',
      'La foto no puede superar los 2 MB.',
    ]);
  });

  it('borra la foto con DELETE /products/{sku}/imagen', () => {
    service.deleteImage(producto.sku).subscribe();
    const req = http.expectOne(`${base}/${producto.sku}/imagen`);
    expect(req.request.method).toBe('DELETE');
    req.flush(producto);
  });

  it.each([
    [409, 'Ya existe un producto con ese SKU.'],
    [413, 'La foto no puede superar los 2 MB.'],
    [415, 'La foto debe ser JPG, PNG o WebP.'],
    [404, 'El producto ya no existe. Recarga la lista.'],
    [403, 'Tu perfil no puede administrar el catálogo.'],
  ])('traduce el %s a un mensaje propio', (status, mensaje) => {
    let error: ApiError | undefined;
    service.create({ sku: 'X', ...datos }).subscribe({ error: (e) => (error = e) });
    http.expectOne(base).flush({ detail: 'texto crudo' }, { status, statusText: 'x' });
    expect(error?.message).toBe(mensaje);
    expect(error?.retryable).toBe(false);
  });

  it('acepta JPG, PNG y WebP de hasta 2 MB', () => {
    expect(validateImage(archivo('image/jpeg', MAX_IMAGE_BYTES))).toBeNull();
    expect(validateImage(archivo('image/webp'))).toBeNull();
  });
});
