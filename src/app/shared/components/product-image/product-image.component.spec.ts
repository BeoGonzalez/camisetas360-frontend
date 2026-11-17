import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductImageComponent } from './product-image.component';
import { environment } from '../../../../environments/environment';

const url = `${environment.apiGateway}/api/v1/catalog/products/SKU-A/imagen`;

describe('ProductImageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductImageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:foto');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  function render(version: number | null) {
    const f = TestBed.createComponent(ProductImageComponent);
    f.componentRef.setInput('sku', 'SKU-A');
    f.componentRef.setInput('version', version);
    f.componentRef.setInput('alt', 'Camiseta');
    f.detectChanges();
    return f;
  }

  it('sin versión no pide nada y muestra "Imagen no disponible"', () => {
    const f = render(null);
    http.expectNone(() => true);
    expect(f.nativeElement.textContent).toContain('Imagen no disponible');
  });

  it('descarga la foto con la versión y la muestra como object URL', () => {
    const f = render(5);
    const req = http.expectOne(`${url}?v=5`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
    f.detectChanges();
    const img: HTMLImageElement = f.nativeElement.querySelector('img');
    expect(img.getAttribute('src')).toBe('blob:foto');
    expect(img.alt).toBe('Camiseta');
  });

  it('al cambiar la versión libera la foto anterior y pide la nueva', () => {
    const f = render(5);
    http.expectOne(`${url}?v=5`).flush(new Blob(['x']));
    f.componentRef.setInput('version', 6);
    f.detectChanges();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto');
    http.expectOne(`${url}?v=6`).flush(new Blob(['y']));
  });

  it('si la descarga falla vuelve al texto alternativo', () => {
    const f = render(5);
    http.expectOne(`${url}?v=5`).flush(null, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('img')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Imagen no disponible');
  });
});
