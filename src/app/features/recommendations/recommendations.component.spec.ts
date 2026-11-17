import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RecommendationsComponent } from './recommendations.component';
import { environment } from '../../../environments/environment';

const url = `${environment.apiGateway}/api/v1/analytics/recomendaciones`;
const body = {
  items: [
    {
      sku: 'A',
      nombre: 'Camiseta A',
      categoria: 'Futbol',
      precio: 100,
      score: 0.91,
      motivo: 'Por tus visitas',
    },
    {
      sku: 'B',
      nombre: 'Camiseta B',
      categoria: 'Retro',
      precio: 200,
      score: 0.5,
      motivo: 'Popular',
    },
  ],
  perfil: { Retro: 0.3, Futbol: 0.7 },
  generadoEn: '2026-11-10T10:00:00Z',
};

describe('RecommendationsComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RecommendationsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('muestra las recomendaciones del backend', () => {
    const f = TestBed.createComponent(RecommendationsComponent);
    f.detectChanges();
    http.expectOne(url).flush(body);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('li h3').length).toBe(2);
    expect(f.nativeElement.textContent).toContain('Por tus visitas');
  });

  it('excluye el sku del producto que se está viendo', () => {
    const f = TestBed.createComponent(RecommendationsComponent);
    f.componentRef.setInput('excludeSku', 'A');
    f.detectChanges();
    http.expectOne(url).flush(body);
    f.detectChanges();
    expect(f.componentInstance.items().map((i) => i.sku)).toEqual(['B']);
  });

  it('estado vacío cuando no hay historial', () => {
    const f = TestBed.createComponent(RecommendationsComponent);
    f.detectChanges();
    http.expectOne(url).flush({ items: [], perfil: {}, generadoEn: null });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Aún no tenemos recomendaciones');
  });

  it('perfil de intereses ordenado por afinidad', () => {
    const f = TestBed.createComponent(RecommendationsComponent);
    f.componentRef.setInput('showProfile', true);
    f.detectChanges();
    http.expectOne(url).flush(body);
    f.detectChanges();
    expect(f.componentInstance.perfil().map((p) => p.categoria)).toEqual(['Futbol', 'Retro']);
    expect(f.nativeElement.querySelectorAll('[role="progressbar"]').length).toBe(2);
  });

  it('error de red -> mensaje y reintento', () => {
    const f = TestBed.createComponent(RecommendationsComponent);
    f.detectChanges();
    http.expectOne(url).error(new ProgressEvent('error'));
    f.detectChanges();
    const alert: HTMLElement = f.nativeElement.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    alert.querySelector('button')!.click();
    http.expectOne(url).flush(body);
  });

  describe('fuente="modelo" (GET /api/v1/recomendaciones)', () => {
    const modeloUrl = `${environment.apiGateway}/api/v1/recomendaciones`;
    const item = (posicion: number, sku: string, score: number) => ({
      posicion,
      sku,
      puntaje: 10 - posicion,
      score,
      nombre: `Camiseta ${sku}`,
      categoria: 'Futbol',
      precio: 100,
    });

    function render(respuesta: object) {
      const f = TestBed.createComponent(RecommendationsComponent);
      f.componentRef.setInput('fuente', 'modelo');
      f.detectChanges();
      http.expectNone(url); // no consulta la vista de analytics
      http.expectOne(modeloUrl).flush(respuesta);
      f.detectChanges();
      return f;
    }

    it('respeta el orden por `posicion` aunque el backend las mande desordenadas', () => {
      const f = render({
        fuente: 'MODELO',
        versionModelo: 'v3',
        items: [item(2, 'B', 0.5), item(1, 'A', 0.9), item(3, 'C', 0.1)],
      });
      const titulos = [...f.nativeElement.querySelectorAll('li h3')].map((h: Element) =>
        h.textContent?.trim(),
      );
      expect(titulos).toEqual(['Camiseta A', 'Camiseta B', 'Camiseta C']);
    });

    it.each([
      ['MODELO', 'Elegido para ti por nuestro modelo'],
      ['PESOS', 'Según tus intereses recientes'],
      ['POPULARES', 'Popular en la tienda'],
    ])('fuente %s -> motivo "%s"', (fuente, motivo) => {
      const f = render({ fuente, versionModelo: null, items: [item(1, 'A', 0.9)] });
      expect(f.nativeElement.textContent).toContain(motivo);
    });

    it('solo muestra % de coincidencia si el score está normalizado (0..1)', () => {
      const f = render({
        fuente: 'MODELO',
        versionModelo: 'v3',
        items: [item(1, 'A', 0.82), item(2, 'B', 7.5)],
      });
      const tarjetas = f.nativeElement.querySelectorAll('li');
      expect(tarjetas[0].textContent).toContain('82% match');
      expect(tarjetas[1].textContent).not.toContain('match');
    });
  });
});
