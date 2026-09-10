import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CatalogComponent } from './catalog.component';
import { CartService } from '../cart/services/cart.service';
import { jwtInterceptor } from '../../core/interceptors/jwt.interceptor';
import { MSALInterceptorConfigFactory } from '../../app.config';
import { Product } from '../../core/models/product.model';

const url = 'https://4ohe7l86rh.execute-api.us-east-1.amazonaws.com/api/v1/catalog/products';
const products: Product[] = [
  { sku: 'CAM-001', name: 'Camiseta Titular 2026', category: 'Fútbol', price: 39.99, stock: 100, description: 'Camiseta oficial de local para la temporada' },
  { sku: 'CAM-002', name: 'Camiseta Visitante 2026', category: 'Fútbol', price: 39.99, stock: 80, description: 'Camiseta alternativa de visitante' },
  { sku: 'CAM-003', name: 'Camiseta Retro Edición Especial', category: 'Colección', price: 49.99, stock: 25, description: 'Diseño clásico conmemorativo' },
];

beforeEach(() => TestBed.configureTestingModule({
  imports: [CatalogComponent],
  providers: [provideHttpClient(withInterceptors([jwtInterceptor])), provideHttpClientTesting()],
}));
afterEach(() => TestBed.inject(HttpTestingController).verify());

it('carga sin MSAL ni Bearer y muestra los tres productos y sus decimales', () => {
  const fixture = TestBed.createComponent(CatalogComponent);
  fixture.detectChanges();
  expect(fixture.componentInstance.loading()).toBe(true);
  const request = TestBed.inject(HttpTestingController).expectOne(url);
  expect(request.request.method).toBe('GET');
  expect(request.request.headers.has('Authorization')).toBe(false);
  expect(request.request.withCredentials).toBe(false);
  request.flush(products);
  fixture.detectChanges();
  const content = fixture.nativeElement.textContent;
  for (const product of products) {
    expect(content).toContain(product.name);
    expect(content).toContain(`Stock: ${product.stock}`);
  }
  expect(content.match(/Disponible/g)).toHaveLength(3);
  expect(content).toContain('39.99');
  expect(content).toContain('49.99');
  expect(content).toContain('Imagen no disponible');
  const button = fixture.nativeElement.querySelector('button');
  button.click();
  expect(TestBed.inject(CartService).items()[0]).toMatchObject({ sku: 'CAM-001', productId: 'CAM-001', name: products[0].name, price: 39.99, quantity: 1 });
});

it('excluye el catálogo en MSAL antes del comodín protegido', () => {
  const entries = [...MSALInterceptorConfigFactory().protectedResourceMap];
  expect(entries[0]).toEqual([url, null]);
  expect(entries[1][1]).not.toBeNull();
});

it('muestra lista vacía', () => {
  const fixture = TestBed.createComponent(CatalogComponent);
  fixture.detectChanges();
  TestBed.inject(HttpTestingController).expectOne(url).flush([]);
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('No hay productos disponibles');
});

it('muestra sin stock y deshabilita la compra cuando el stock es cero', () => {
  const fixture = TestBed.createComponent(CatalogComponent);
  fixture.detectChanges();
  TestBed.inject(HttpTestingController).expectOne(url).flush([{ ...products[0], stock: 0 }]);
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Stock: 0');
  expect(fixture.nativeElement.textContent).toContain('Sin stock');
  expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
});

it('muestra error y permite reintentar', () => {
  const fixture = TestBed.createComponent(CatalogComponent);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(url).flush('Error', { status: 500, statusText: 'Server Error' });
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Error al cargar el catálogo');
  fixture.nativeElement.querySelector('button').click();
  http.expectOne(url).flush(products);
  fixture.detectChanges();
  expect(fixture.componentInstance.error()).toBe('');
  expect(fixture.componentInstance.products()).toEqual(products);
});

it('mantiene productos separados por SKU y calcula cantidades y totales', () => {
  const cart = TestBed.inject(CartService);
  cart.addToCart(products[0], '');
  cart.addToCart(products[1], '');
  cart.addToCart(products[0], '');
  expect(cart.items()).toHaveLength(2);
  expect(cart.items()[0].quantity).toBe(2);
  expect(cart.total()).toBeCloseTo(119.97);
  cart.updateQuantity('CAM-002', '', 2);
  expect(cart.total()).toBeCloseTo(159.96);
  cart.removeFromCart('CAM-001', '');
  expect(cart.items()[0].sku).toBe('CAM-002');
  cart.addToCart({ ...products[2], stock: 0 }, '');
  expect(cart.items()).toHaveLength(1);
});
