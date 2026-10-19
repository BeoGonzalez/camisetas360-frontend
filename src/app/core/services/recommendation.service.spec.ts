import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { RecommendationService } from './recommendation.service';
import { CatalogService } from './catalog.service';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let httpTesting: HttpTestingController;
  let catalogService: any;

  const mockProducts: Product[] = [
    {
      sku: 'CAM-001',
      name: 'Camiseta Titular 2026',
      category: 'Fútbol',
      price: 39.99,
      stock: 100,
      description: 'Camiseta oficial de local',
    },
    {
      sku: 'CAM-002',
      name: 'Camiseta Visitante 2026',
      category: 'Fútbol',
      price: 39.99,
      stock: 50,
      description: 'Camiseta alternativa oficial',
    },
  ];

  beforeEach(() => {
    catalogService = {
      getProducts: () => of(mockProducts),
    };

    TestBed.configureTestingModule({
      providers: [
        RecommendationService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CatalogService, useValue: catalogService },
      ],
    });

    service = TestBed.inject(RecommendationService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
    expect(service.status()).toBe('IDLE');
  });

  it('debe procesar recomendaciones del backend cuando están disponibles', () => {
    const mockBackendResponse = {
      id: 1,
      orderId: 10,
      customerEmail: 'cliente@ejemplo.com',
      explanation: 'Estilo ofensivo y clásico',
      recommendations: [
        {
          name: 'Camiseta Alternativa',
          reason: 'Combina con tu compra previa',
        },
      ],
    };

    service.getRecommendationsForOrder(10).subscribe((result) => {
      expect(result.id).toBe(1);
      expect(result.orderId).toBe(10);
      expect(result.explanation).toBe('Estilo ofensivo y clásico');
      expect(result.recommendations.length).toBe(1);
      expect(result.isFallback).toBe(false);
      expect(service.status()).toBe('COMPLETED');
    });

    const req = httpTesting.expectOne(
      `${environment.apiGateway}${environment.endpoints.recommendation}/orders/10`
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockBackendResponse);
  });

  it('debe degradar elegantemente al catálogo cuando el microservicio devuelve 404 (worker asíncrono)', () => {
    service.getRecommendationsForOrder(42).subscribe((result) => {
      expect(result.orderId).toBe(42);
      expect(result.isFallback).toBe(true);
      expect(result.recommendations.length).toBe(2);
      expect(result.recommendations[0].name).toBe('Camiseta Titular 2026');
      expect(result.recommendations[0].matchedProduct).toEqual(mockProducts[0]);
      expect(service.status()).toBe('COMPLETED');
    });

    const req = httpTesting.expectOne(
      `${environment.apiGateway}${environment.endpoints.recommendation}/orders/42`
    );
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });
  });

  it('debe manejar estado UNAVAILABLE cuando tanto el backend como el catálogo fallan', () => {
    catalogService.getProducts = () => throwError(() => new Error('Catalogo offline'));

    service.getRecommendationsForOrder(99).subscribe((result) => {
      expect(result.recommendations).toEqual([]);
      expect(service.status()).toBe('UNAVAILABLE');
      expect(service.errorMessage()).toContain('No se pudieron cargar');
    });

    const req = httpTesting.expectOne(
      `${environment.apiGateway}${environment.endpoints.recommendation}/orders/99`
    );
    req.flush('Error', { status: 500, statusText: 'Internal Error' });
  });
});
