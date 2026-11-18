import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { CatalogComponent } from './catalog.component';
import { AuthService } from '../../core/services/auth.service';
import { Product } from '../../core/models/product.model';
import { environment } from '../../../environments/environment';

const api = environment.apiGateway;
const productsUrl = `${api}/api/v1/catalog/products`;

const products: Product[] = [
  {
    sku: 'CAM-001',
    name: 'Camiseta Titular',
    category: 'Futbol',
    price: 39990,
    stock: 100,
    description: 'Local',
  },
  {
    sku: 'CAM-002',
    name: 'Camiseta Visitante',
    category: 'Futbol',
    price: 39990,
    stock: 0,
    description: 'Visita',
  },
  {
    sku: 'RET-003',
    name: 'Retro Especial',
    category: 'Coleccion',
    price: 49990,
    stock: 3,
    description: 'Clasico',
  },
];

describe('CatalogComponent', () => {
  let http: HttpTestingController;
  let isCustomer: boolean;
  let loggedIn: boolean;

  beforeEach(() => {
    isCustomer = false;
    loggedIn = true;
    TestBed.configureTestingModule({
      imports: [CatalogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isCustomer: () => isCustomer,
            canSeeRecommendations: () => isCustomer,
            isLoggedIn: () => loggedIn,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render() {
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra skeleton mientras carga y luego los productos', () => {
    const f = render();
    expect(f.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    http.expectOne(productsUrl).flush(products);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('article').length).toBe(3);
  });

  it('NO llama al detalle por producto al listar (no registra visitas)', () => {
    render();
    http.expectOne(productsUrl).flush(products);
    http.expectNone((r) => r.url.startsWith(`${productsUrl}/`));
  });

  it('filtra por búsqueda y por categoría', () => {
    const f = render();
    http.expectOne(productsUrl).flush(products);
    const c = f.componentInstance;
    c.query.set('retro');
    expect(c.filtered().map((p) => p.sku)).toEqual(['RET-003']);
    c.query.set('');
    c.category.set('Futbol');
    expect(c.filtered().length).toBe(2);
    expect(c.categories()).toEqual(['Premier League', 'Serie A']);
  });

  it('las camisetas de una liga se agrupan en la categoría de su liga (Premier League, Serie A)', () => {
    const f = render();
    const deLiga = (sku: string, league: string): Product => ({
      sku,
      name: `Camiseta ${sku}`,
      category: 'Fútbol',
      league,
      price: 89990,
      stock: 10,
      description: '',
    });
    http
      .expectOne(productsUrl)
      .flush([
        ...products,
        deLiga('PL-ARS-LOC-2627', 'Premier League'),
        deLiga('PL-CHE-VIS-2627', 'Premier League'),
        deLiga('SA-INT-LOC-2627', 'Serie A'),
      ]);
    const c = f.componentInstance;
    expect(c.categories()).toEqual(['Premier League', 'Serie A']);
    c.category.set('Premier League');
    expect(c.filtered().map((p) => p.sku)).toEqual(['PL-ARS-LOC-2627', 'PL-CHE-VIS-2627']);
    c.category.set('Serie A');
    expect(c.filtered().map((p) => p.sku)).toEqual(['SA-INT-LOC-2627']);
    // "Coleccion" y "Fútbol" no son categorías del filtro.
    expect(c.categories()).not.toContain('Coleccion');
    expect(c.categories()).not.toContain('Fútbol');
  });

  it('estado vacío', () => {
    const f = render();
    http.expectOne(productsUrl).flush([]);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No hay productos disponibles');
  });

  it('error 5xx muestra mensaje y permite reintento manual', () => {
    const f = render();
    http.expectOne(productsUrl).flush({}, { status: 503, statusText: 'Unavailable' });
    f.detectChanges();
    const alert: HTMLElement = f.nativeElement.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    alert.querySelector('button')!.click();
    http.expectOne(productsUrl).flush(products);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('article').length).toBe(3);
  });

  it('403 muestra "Sin permiso" sin botón de reintento', () => {
    const f = render();
    http.expectOne(productsUrl).flush({}, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    const alert: HTMLElement = f.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('Sin permiso');
    expect(alert.querySelector('button')).toBeNull();
  });

  it('el botón Añadir solo aparece para CUSTOMER y agrega vía POST /carrito/items', () => {
    let f = render();
    http.expectOne(productsUrl).flush(products);
    f.detectChanges();
    expect(f.nativeElement.querySelector('button[aria-label^="Añadir"]')).toBeNull();
    f.destroy();

    isCustomer = true;
    f = render();
    http.expectOne(productsUrl).flush(products);
    http
      .expectOne(`${api}/api/v1/recomendaciones`)
      .flush({ fuente: 'POPULARES', versionModelo: null, items: [] });
    f.detectChanges();
    const btn: HTMLButtonElement = f.nativeElement.querySelector(
      'button[aria-label="Añadir Camiseta Titular al carrito"]',
    );
    btn.click();
    const req = http.expectOne(`${api}/api/v1/carrito/items`);
    expect(req.request.body).toMatchObject({ sku: 'CAM-001', cantidad: 1, precioUnitario: 39990 });
    req.flush({ items: [], envio: null, subtotal: 0, costoEnvio: 0, total: 0 });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="status"]').textContent).toContain('se añadió');
  });

  it('producto sin stock tiene el botón deshabilitado', () => {
    isCustomer = true;
    const f = render();
    http.expectOne(productsUrl).flush(products);
    http
      .expectOne(`${api}/api/v1/recomendaciones`)
      .flush({ fuente: 'POPULARES', versionModelo: null, items: [] });
    f.detectChanges();
    const btn: HTMLButtonElement = f.nativeElement.querySelector(
      'button[aria-label="Añadir Camiseta Visitante al carrito"]',
    );
    expect(btn.disabled).toBe(true);
  });

  it('visitante sin sesión: ve "Comprar" y al presionarlo va al login con la camiseta como destino', () => {
    loggedIn = false;
    const f = render();
    http.expectOne(productsUrl).flush(products);
    f.detectChanges();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const comprar = [
      ...f.nativeElement.querySelectorAll('button[aria-label^="Comprar"]'),
    ] as HTMLButtonElement[];
    expect(comprar.map((b) => b.textContent?.trim())).toEqual(['Comprar', 'Agotado', 'Comprar']);
    expect(comprar[1].disabled).toBe(true);
    expect(f.nativeElement.querySelector('button[aria-label^="Añadir"]')).toBeNull();

    comprar[0].click();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/catalog/CAM-001', motivo: 'comprar' },
    });
    http.expectNone(() => true); // no intenta agregar al carrito
  });
});
