import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RecommendationService } from './recommendation.service';
import { environment } from '../../../environments/environment';
import { ApiError } from '../http/api-error';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let http: HttpTestingController;
  const url = `${environment.apiGateway}/api/v1/analytics/recomendaciones`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RecommendationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /analytics/recomendaciones y devuelve el contrato tal cual', () => {
    const body = {
      items: [
        {
          sku: 'CAM-1',
          nombre: 'Local',
          categoria: 'Fútbol',
          precio: 100,
          score: 0.9,
          motivo: 'Visto',
        },
      ],
      perfil: { Futbol: 0.8 },
      generadoEn: '2026-11-10T00:00:00Z',
    };
    let res: unknown;
    service.getRecomendaciones().subscribe((r) => (res = r));
    const req = http.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush(body);
    expect(res).toEqual(body);
  });

  it('lista vacía sin historial (no inventa recomendaciones)', () => {
    let items: unknown[] | undefined;
    service.getRecomendaciones().subscribe((r) => (items = r.items));
    http.expectOne(url).flush({ items: [], perfil: {}, generadoEn: null });
    expect(items).toEqual([]);
  });

  it('propaga 403 como ApiError forbidden, sin fallback', () => {
    let err: ApiError | undefined;
    service.getRecomendaciones().subscribe({ error: (e) => (err = e) });
    http.expectOne(url).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(err?.kind).toBe('forbidden');
  });

  describe('GET /api/v1/recomendaciones (modelo)', () => {
    const modeloUrl = `${environment.apiGateway}/api/v1/recomendaciones`;

    it('200 -> devuelve fuente, versión e ítems tal cual', () => {
      const body = {
        fuente: 'MODELO',
        versionModelo: 'v3',
        items: [
          {
            posicion: 1,
            sku: 'CAM-1',
            puntaje: 12.5,
            score: 0.8,
            nombre: 'Local',
            categoria: 'Fútbol',
            precio: 100,
          },
        ],
      };
      let res: unknown;
      service.getRecomendacionesModelo().subscribe((r) => (res = r));
      const req = http.expectOne(modeloUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.url).not.toMatch(/userId/);
      req.flush(body);
      expect(res).toEqual(body);
    });

    it.each([
      [401, 'unauthenticated'],
      [403, 'forbidden'],
      [404, 'not_found'],
      [503, 'unavailable'],
    ])('%i -> ApiError %s', (status, kind) => {
      let err: ApiError | undefined;
      service.getRecomendacionesModelo().subscribe({ error: (e) => (err = e) });
      http.expectOne(modeloUrl).flush({}, { status, statusText: 'x' });
      expect(err?.kind).toBe(kind);
    });
  });
});
