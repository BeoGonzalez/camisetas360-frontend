import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductoFormComponent } from './producto-form.component';
import { Product } from '../../core/models/product.model';
import { environment } from '../../../environments/environment';

const base = `${environment.apiGateway}/api/v1/catalog/products`;

const existente: Product = {
  sku: 'PL-ARS-LOC',
  name: 'Camiseta Arsenal Local',
  team: 'Arsenal',
  kitType: 'LOCAL',
  league: 'Premier League',
  category: 'Fútbol',
  price: 90,
  stock: 10,
  description: null,
  imageVersion: 7,
};

describe('ProductoFormComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductoFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  function render(product: Product | null = null) {
    const f = TestBed.createComponent(ProductoFormComponent);
    f.componentRef.setInput('product', product);
    const saved: Product[] = [];
    let cerrado = 0;
    f.componentInstance.saved.subscribe((p) => saved.push(p));
    f.componentInstance.closed.subscribe(() => cerrado++);
    f.detectChanges();
    if (product?.imageVersion != null) {
      http.expectOne(`${base}/${product.sku}/imagen?v=${product.imageVersion}`).flush(new Blob());
    }
    return { f, saved, cerrado: () => cerrado };
  }

  function escribir(el: HTMLElement, id: string, valor: string) {
    const input = el.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;
    input.value = valor;
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
  }

  function elegirFoto(el: HTMLElement, file: File) {
    const input = el.querySelector('#foto') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  function enviar(el: HTMLElement) {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
  }

  it('no envía si faltan campos obligatorios', () => {
    const { f } = render();
    enviar(f.nativeElement);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Revisa los campos marcados.');
    expect(f.nativeElement.textContent).toContain('Indica el equipo');
  });

  it('crea la camiseta, sube la foto y se cierra', () => {
    const { f, saved, cerrado } = render();
    const el = f.nativeElement;
    escribir(el, 'team', ' Chelsea ');
    escribir(el, 'kitType', 'ALTERNATIVA');
    escribir(el, 'sku', 'PL-CHE-ALT-2728');
    escribir(el, 'price', '89990');
    escribir(el, 'stock', '25');
    const foto = new File([new Uint8Array(4)], 'c.png', { type: 'image/png' });
    elegirFoto(el, foto);
    f.detectChanges();
    expect(el.querySelector('img[alt="Vista previa de la foto"]').getAttribute('src')).toBe(
      'blob:preview',
    );

    enviar(el);
    const alta = http.expectOne(base);
    expect(alta.request.body).toEqual({
      sku: 'PL-CHE-ALT-2728',
      name: 'Camiseta Chelsea Alternativa',
      team: 'Chelsea',
      kitType: 'ALTERNATIVA',
      category: 'Fútbol',
      league: null,
      price: 89990,
      stock: 25,
      description: null,
    });
    const creado: Product = { ...alta.request.body, imageVersion: null };
    alta.flush(creado);

    const subida = http.expectOne(`${base}/PL-CHE-ALT-2728/imagen`);
    expect(subida.request.body).toBe(foto);
    subida.flush({ ...creado, imageVersion: 1 });

    expect(saved.map((p) => p.imageVersion)).toEqual([null, 1]);
    expect(cerrado()).toBe(1);
  });

  it('si la foto falla tras crear, informa que los datos sí se guardaron y no se cierra', () => {
    const { f, saved, cerrado } = render();
    const el = f.nativeElement;
    escribir(el, 'team', 'Chelsea');
    escribir(el, 'sku', 'PL-CHE-LOC');
    escribir(el, 'price', '10');
    escribir(el, 'stock', '1');
    elegirFoto(el, new File([new Uint8Array(4)], 'c.jpg', { type: 'image/jpeg' }));
    enviar(el);
    http.expectOne(base).flush({ sku: 'PL-CHE-LOC', name: 'x', imageVersion: null });
    http
      .expectOne(`${base}/PL-CHE-LOC/imagen`)
      .flush(null, { status: 415, statusText: 'Unsupported' });
    f.detectChanges();

    expect(saved.length).toBe(1);
    expect(cerrado()).toBe(0);
    expect(el.textContent).toContain('Los datos se guardaron, pero la foto no');
    expect(el.textContent).toContain('Editar camiseta');
    expect((el.querySelector('#sku') as HTMLInputElement).disabled).toBe(true);
  });

  it('rechaza una foto de otro formato sin enviarla', () => {
    const { f } = render();
    elegirFoto(f.nativeElement, new File(['x'], 'a.gif', { type: 'image/gif' }));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('La foto debe ser JPG, PNG o WebP.');
  });

  it('edita sin cambiar el SKU y puede quitar la foto existente', () => {
    const { f, saved, cerrado } = render(existente);
    const el = f.nativeElement;
    expect((el.querySelector('#sku') as HTMLInputElement).disabled).toBe(true);
    expect((el.querySelector('#name') as HTMLInputElement).value).toBe('Camiseta Arsenal Local');
    escribir(el, 'stock', '0');
    [...el.querySelectorAll('button')]
      .find((b: HTMLButtonElement) => b.textContent?.includes('Quitar foto'))!
      .click();
    f.detectChanges();
    expect(el.textContent).toContain('Sin foto');

    enviar(el);
    const put = http.expectOne(`${base}/PL-ARS-LOC`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.stock).toBe(0);
    expect(put.request.body.sku).toBeUndefined();
    put.flush({ ...existente, stock: 0 });
    const borrar = http.expectOne(`${base}/PL-ARS-LOC/imagen`);
    expect(borrar.request.method).toBe('DELETE');
    borrar.flush({ ...existente, stock: 0, imageVersion: null });

    expect(saved.at(-1)?.imageVersion).toBeNull();
    expect(cerrado()).toBe(1);
  });

  it('muestra el conflicto de SKU duplicado', () => {
    const { f, saved } = render();
    const el = f.nativeElement;
    escribir(el, 'team', 'Chelsea');
    escribir(el, 'sku', 'PL-ARS-LOC');
    escribir(el, 'price', '10');
    escribir(el, 'stock', '1');
    enviar(el);
    http.expectOne(base).flush(null, { status: 409, statusText: 'Conflict' });
    f.detectChanges();
    expect(el.textContent).toContain('Ya existe un producto con ese SKU.');
    expect(saved.length).toBe(0);
  });

  it('Escape cierra el diálogo', () => {
    const { cerrado } = render();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cerrado()).toBe(1);
  });
});
