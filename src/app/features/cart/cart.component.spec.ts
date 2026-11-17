import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { CartComponent } from './cart.component';
import { CheckoutTrackerService } from '../../core/services/checkout-tracker.service';
import { CartDTO } from '../../core/models/cart.model';
import { environment } from '../../../environments/environment';

const base = `${environment.apiGateway}/api/v1/carrito`;
const conItem: CartDTO = {
  items: [
    {
      sku: 'A',
      nombre: 'Camiseta A',
      categoria: 'Futbol',
      precioUnitario: 1000,
      cantidad: 2,
      subtotal: 2000,
    },
  ],
  envio: null,
  subtotal: 2000,
  costoEnvio: 0,
  total: 2000,
};

describe('CartComponent', () => {
  let http: HttpTestingController;
  const checkout = vi.fn(() => of({ requestId: 'req-9' }));

  beforeEach(() => {
    checkout.mockClear();
    TestBed.configureTestingModule({
      imports: [CartComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CheckoutTrackerService, useValue: { checkout } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render(cart: CartDTO) {
    const f = TestBed.createComponent(CartComponent);
    f.detectChanges();
    http.expectOne(base).flush(cart);
    f.detectChanges();
    return f;
  }

  it('carrito vacío', () => {
    const f = render({ ...conItem, items: [], subtotal: 0, total: 0 });
    expect(f.nativeElement.textContent).toContain('Tu carrito está vacío');
  });

  it('muestra ítems y totales del CartDTO', () => {
    const f = render(conItem);
    expect(f.nativeElement.textContent).toContain('Camiseta A');
    expect(f.nativeElement.textContent).toContain('$2.000');
  });

  it('no permite checkout sin envío; guardar envío hace PUT', () => {
    const f = render(conItem);
    const finalizar = [...f.nativeElement.querySelectorAll('button')].find((b: HTMLButtonElement) =>
      b.textContent?.includes('Finalizar'),
    ) as HTMLButtonElement;
    expect(finalizar.disabled).toBe(true);

    f.componentInstance.envioForm.setValue({
      metodo: 'RETIRO_TIENDA',
      region: 'RM',
      comuna: 'Providencia',
    });
    f.componentInstance.saveShipping();
    const put = http.expectOne(`${base}/envio`);
    expect(put.request.body).toEqual({
      metodo: 'RETIRO_TIENDA',
      region: 'RM',
      comuna: 'Providencia',
    });
    put.flush({
      ...conItem,
      envio: { metodo: 'RETIRO_TIENDA', region: 'RM', comuna: 'Providencia', costo: 0 },
    });
    f.detectChanges();
    expect(finalizar.disabled).toBe(false);
  });

  it('envío incompleto muestra errores y no llama al backend', () => {
    const f = render(conItem);
    f.componentInstance.saveShipping();
    f.detectChanges();
    http.expectNone(`${base}/envio`);
    expect(f.nativeElement.textContent).toContain('Ingresa la región.');
  });

  it('checkout navega al seguimiento de la compra', () => {
    const f = render({
      ...conItem,
      envio: { metodo: 'STANDARD', region: 'RM', comuna: 'Stgo', costo: 3990 },
    });
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    f.componentInstance.checkout();
    expect(checkout).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith(['/pedidos/compra', 'req-9']);
  });

  it('422 al cambiar cantidad se muestra como alerta', () => {
    const f = render(conItem);
    f.componentInstance.setQty(conItem.items[0], 3);
    http.expectOne(`${base}/items`).flush({}, { status: 422, statusText: 'Unprocessable' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain('99');
  });
});
