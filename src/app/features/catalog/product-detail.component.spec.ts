import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ProductDetailComponent } from './product-detail.component';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

const api = environment.apiGateway;
const product = {
  sku: 'CAM-001',
  name: 'Titular',
  category: 'Futbol',
  price: 39990,
  stock: 2,
  description: 'Local',
};

describe('ProductDetailComponent', () => {
  let http: HttpTestingController;
  const params = new BehaviorSubject(convertToParamMap({ sku: 'CAM-001' }));

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isCustomer: () => true,
            canSeeRecommendations: () => true,
            isLoggedIn: () => true,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: params, snapshot: { paramMap: params.value } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('al abrir el detalle llama UNA vez a GET /products/{sku}', () => {
    const f = TestBed.createComponent(ProductDetailComponent);
    f.detectChanges();
    http.expectOne(`${api}/api/v1/catalog/products/CAM-001`).flush(product);
    f.detectChanges();
    http
      .expectOne(`${api}/api/v1/analytics/recomendaciones`)
      .flush({ items: [], perfil: {}, generadoEn: null });
    expect(f.nativeElement.querySelector('h1').textContent).toContain('Titular');
    expect(f.nativeElement.textContent).toContain('2 unidades disponibles');
  });

  it('404 -> "El producto no existe."', () => {
    const f = TestBed.createComponent(ProductDetailComponent);
    f.detectChanges();
    http
      .expectOne(`${api}/api/v1/catalog/products/CAM-001`)
      .flush({}, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'El producto no existe.',
    );
  });

  it('la cantidad no puede superar el stock', () => {
    const f = TestBed.createComponent(ProductDetailComponent);
    f.detectChanges();
    http.expectOne(`${api}/api/v1/catalog/products/CAM-001`).flush(product);
    f.detectChanges();
    http
      .expectOne(`${api}/api/v1/analytics/recomendaciones`)
      .flush({ items: [], perfil: {}, generadoEn: null });
    f.componentInstance.qty.set(3);
    f.detectChanges();
    expect(f.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
  });
});
