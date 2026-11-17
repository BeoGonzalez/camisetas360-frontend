import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductosAdminComponent } from './productos-admin.component';
import { Product } from '../../core/models/product.model';
import { environment } from '../../../environments/environment';

const base = `${environment.apiGateway}/api/v1/catalog/products`;

const productos: Product[] = [
  {
    sku: 'PL-ARS-LOC',
    name: 'Arsenal Local',
    team: 'Arsenal',
    kitType: 'LOCAL',
    league: 'Premier League',
    category: 'Fútbol',
    price: 90,
    stock: 10,
    description: null,
    imageVersion: null,
  },
  {
    sku: 'PL-ARS-ALT',
    name: 'Arsenal Alternativa',
    team: 'Arsenal',
    kitType: 'ALTERNATIVA',
    league: 'Premier League',
    category: 'Fútbol',
    price: 85,
    stock: 0,
    description: null,
    imageVersion: null,
  },
  {
    sku: 'CAM-001',
    name: 'Camiseta Titular',
    category: 'Fútbol',
    price: 39,
    stock: 3,
    description: 'Genérica',
  },
];

describe('ProductosAdminComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductosAdminComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render() {
    const f = TestBed.createComponent(ProductosAdminComponent);
    f.detectChanges();
    http.expectOne(base).flush(productos);
    f.detectChanges();
    return f;
  }

  const texto = (f: ReturnType<typeof render>) => f.nativeElement.textContent as string;
  const botones = (f: ReturnType<typeof render>, nombre: RegExp) =>
    [...f.nativeElement.querySelectorAll('button')].filter(
      (b: HTMLButtonElement) =>
        nombre.test(b.textContent ?? '') || nombre.test(b.getAttribute('aria-label') ?? ''),
    ) as HTMLButtonElement[];

  it('agrupa por equipo, ordena por tipo y ofrece agregar el tipo que falta', () => {
    const f = render();
    const secciones = [...f.nativeElement.querySelectorAll('section[aria-label]')].map(
      (s: Element) => s.getAttribute('aria-label'),
    );
    expect(secciones).toEqual(['Resumen del catálogo', 'Arsenal', 'Sin equipo asignado']);
    const arsenal = f.nativeElement.querySelector('section[aria-label="Arsenal"]');
    const nombres = [...arsenal.querySelectorAll('h3')].map((h: Element) => h.textContent?.trim());
    expect(nombres).toEqual(['Arsenal Local', 'Arsenal Alternativa']);
    expect(arsenal.textContent).toContain('Agregar camiseta visitante');
    expect(arsenal.textContent).not.toContain('Agregar camiseta local');
  });

  it('resume camisetas, equipos, sin stock y sin foto', () => {
    const f = render();
    const kpis = [
      ...f.nativeElement.querySelectorAll('section[aria-label="Resumen del catálogo"] p'),
    ].map((p: Element) => p.textContent?.trim());
    expect(kpis).toEqual(['Camisetas', '3', 'Equipos', '1', 'Sin stock', '1', 'Sin foto', '3']);
  });

  it('filtra por estado "sin stock" y oculta los faltantes', () => {
    const f = render();
    const estado: HTMLSelectElement = f.nativeElement.querySelector('#admin-estado');
    estado.value = 'sin-stock';
    estado.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('h3').length).toBe(1);
    expect(texto(f)).not.toContain('Agregar camiseta');
  });

  it('busca por SKU', () => {
    const f = render();
    const buscar: HTMLInputElement = f.nativeElement.querySelector('#admin-buscar');
    buscar.value = 'cam-001';
    buscar.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(
      [...f.nativeElement.querySelectorAll('h3')].map((h: Element) => h.textContent?.trim()),
    ).toEqual(['Camiseta Titular']);
  });

  it('el botón de un faltante abre el formulario con equipo y tipo precargados', () => {
    const f = render();
    botones(f, /Agregar camiseta visitante/)[0].click();
    f.detectChanges();
    const dialogo = f.nativeElement.querySelector('[role="dialog"]');
    expect(dialogo.textContent).toContain('Nueva camiseta');
    expect((dialogo.querySelector('#team') as HTMLInputElement).value).toBe('Arsenal');
    expect((dialogo.querySelector('#kitType') as HTMLSelectElement).value).toBe('VISITANTE');
    expect((dialogo.querySelector('#name') as HTMLInputElement).value).toBe(
      'Camiseta Arsenal Visitante',
    );
  });

  it('elimina tras confirmar y saca el producto de la lista', () => {
    const f = render();
    botones(f, /^Eliminar Arsenal Local$/)[0].click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alertdialog"]').textContent).toContain(
      'PL-ARS-LOC',
    );
    botones(f, /^\s*Eliminar\s*$/)
      .at(-1)!
      .click();
    const req = http.expectOne(`${base}/PL-ARS-LOC`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
    expect(texto(f)).toContain('Se eliminó Arsenal Local.');
    expect(texto(f)).toContain('Agregar camiseta local');
  });

  it('si eliminar falla lo informa y conserva el producto', () => {
    const f = render();
    botones(f, /^Eliminar Arsenal Local$/)[0].click();
    f.detectChanges();
    botones(f, /^\s*Eliminar\s*$/)
      .at(-1)!
      .click();
    http.expectOne(`${base}/PL-ARS-LOC`).flush(null, { status: 403, statusText: 'Forbidden' });
    f.detectChanges();
    expect(texto(f)).toContain('Tu perfil no puede administrar el catálogo.');
    expect(texto(f)).toContain('Arsenal Local');
  });

  it('muestra el error de carga con reintento', () => {
    const f = TestBed.createComponent(ProductosAdminComponent);
    f.detectChanges();
    http.expectOne(base).flush(null, { status: 503, statusText: 'Unavailable' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Servicio no disponible',
    );
    [...f.nativeElement.querySelectorAll('button')]
      .find((b: HTMLButtonElement) => b.textContent?.includes('Reintentar'))!
      .click();
    http.expectOne(base).flush(productos);
  });
});
