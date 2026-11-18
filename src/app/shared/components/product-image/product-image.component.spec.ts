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

  describe('foto estática de la camiseta (equipo + tipo)', () => {
    function renderEquipo(version: number | null, team: string, kitType: string) {
      const f = TestBed.createComponent(ProductImageComponent);
      f.componentRef.setInput('sku', 'SKU-A');
      f.componentRef.setInput('version', version);
      f.componentRef.setInput('alt', 'Camiseta');
      f.componentRef.setInput('team', team);
      f.componentRef.setInput('kitType', kitType);
      f.detectChanges();
      return f;
    }
    const src = (f: { nativeElement: HTMLElement }) =>
      f.nativeElement.querySelector('img')?.getAttribute('src');

    it('sin foto en el backend usa la del equipo y tipo, sin pedir nada a la API', () => {
      const f = renderEquipo(null, 'Arsenal', 'VISITANTE');
      http.expectNone(() => true);
      expect(src(f)).toBe('camisetas/arsenal-visitante.avif');
    });

    it('reconoce el nombre largo del club', () => {
      expect(src(renderEquipo(null, 'Tottenham Hotspur', 'ALTERNATIVA'))).toBe(
        'camisetas/tottenham-alternativa.avif',
      );
    });

    it('la foto subida al backend tiene prioridad', () => {
      const f = renderEquipo(5, 'Arsenal', 'LOCAL');
      http.expectOne(`${url}?v=5`).flush(new Blob(['x']));
      f.detectChanges();
      expect(src(f)).toBe('blob:foto');
    });

    it('si la foto del backend falla, cae a la foto estática', () => {
      const f = renderEquipo(5, 'Arsenal', 'LOCAL');
      http.expectOne(`${url}?v=5`).flush(null, { status: 404, statusText: 'Not Found' });
      f.detectChanges();
      expect(src(f)).toBe('camisetas/arsenal-local.avif');
    });

    it('si el archivo estático falla, muestra la silueta', () => {
      const f = renderEquipo(null, 'Arsenal', 'LOCAL');
      f.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
      f.detectChanges();
      expect(f.nativeElement.querySelector('img')).toBeNull();
      expect(f.nativeElement.textContent).toContain('Imagen no disponible');
    });

    it('un equipo sin fotos registradas muestra la silueta', () => {
      const f = renderEquipo(null, 'Club Inventado', 'LOCAL');
      expect(f.nativeElement.querySelector('img')).toBeNull();
    });
  });

  it('si la descarga falla vuelve al texto alternativo', () => {
    const f = render(5);
    http.expectOne(`${url}?v=5`).flush(null, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('img')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Imagen no disponible');
  });
});
