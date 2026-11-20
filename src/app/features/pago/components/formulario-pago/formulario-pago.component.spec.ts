import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { FormularioPagoComponent } from './formulario-pago.component';
import { PagoService } from '../../../../core/services/pago.service';
import { CheckoutTrackerService } from '../../../../core/services/checkout-tracker.service';
import { IniciarWebpayResponse, PagoError } from '../../../../core/models/pago.model';

const REQUEST_ID = '7d4e1c2a-1111-4222-8333-944455556666';
const RESPUESTA: IniciarWebpayResponse = {
  pagoId: 'p-1',
  ordenId: REQUEST_ID,
  monto: 4990,
  token: 'tok-webpay',
  url: 'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
};

describe('FormularioPagoComponent (Webpay Plus)', () => {
  let component: FormularioPagoComponent;
  let fixture: ComponentFixture<FormularioPagoComponent>;
  let pago: {
    iniciarWebpay: ReturnType<typeof vi.fn>;
    redirigirAWebpay: ReturnType<typeof vi.fn>;
  };

  const boton = () => fixture.nativeElement.querySelector('#btnPagar') as HTMLButtonElement;
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function setup(ordenId: string | null) {
    pago = {
      iniciarWebpay: vi.fn(() => of(RESPUESTA)),
      redirigirAWebpay: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [FormularioPagoComponent],
      providers: [
        provideRouter([]),
        { provide: PagoService, useValue: pago },
        {
          provide: CheckoutTrackerService,
          useValue: {
            compras: signal([
              {
                requestId: REQUEST_ID,
                totalAmount: 1000,
                montoPago: 4990,
                createdAt: '',
                estado: 'ENCONTRADO',
              },
            ]),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(ordenId ? { ordenId } : {}),
              queryParamMap: convertToParamMap({ monto: '1' }),
            },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FormularioPagoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('con una compra registrada', () => {
    beforeEach(() => setup(REQUEST_ID));

    it('muestra el resumen (total y Orden ID), el aviso de Webpay y no pide la tarjeta', () => {
      expect(component.ordenId()).toBe(REQUEST_ID);
      expect(component.monto()).toBe(4990);
      expect(texto()).toContain(REQUEST_ID);
      expect(texto()).toContain('Webpay de Transbank');
      expect(boton().textContent).toContain('con Webpay');
      expect(boton().disabled).toBe(false);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('input, select').length).toBe(0);
      expect(el.querySelector('form')).toBeNull();
      expect(el.querySelector('a[href="/carrito"]')).not.toBeNull();
      expect(el.querySelector(`a[href="/pago/historial/${REQUEST_ID}"]`)).not.toBeNull();
    });

    it('inicia Webpay con la orden y el monto de la compra y redirige con el token', () => {
      boton().click();
      expect(pago.iniciarWebpay).toHaveBeenCalledWith({ ordenId: REQUEST_ID, monto: 4990 });
      expect(pago.redirigirAWebpay).toHaveBeenCalledWith(RESPUESTA.url, RESPUESTA.token);
    });

    it('mientras procesa deshabilita el botón y un doble clic genera un solo pago', () => {
      const respuesta = new Subject<IniciarWebpayResponse>();
      pago.iniciarWebpay.mockReturnValue(respuesta);

      boton().click();
      fixture.detectChanges();
      expect(boton().disabled).toBe(true);
      expect(boton().textContent).toContain('Redirigiendo a Webpay…');

      component.pagar(); // segundo clic (aunque el botón deshabilitado ya lo impide)
      expect(pago.iniciarWebpay).toHaveBeenCalledTimes(1);

      respuesta.next(RESPUESTA);
      respuesta.complete();
      expect(pago.redirigirAWebpay).toHaveBeenCalledTimes(1);
    });

    it('si falla, muestra el error, no redirige y vuelve a habilitar el botón', () => {
      pago.iniciarWebpay.mockReturnValue(
        throwError(
          () =>
            ({ status: 503, esNoDisponible: true, mensaje: 'Servicio no disponible' }) as PagoError,
        ),
      );
      boton().click();
      fixture.detectChanges();

      expect(pago.redirigirAWebpay).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
        'Servicio no disponible',
      );
      expect(boton().disabled).toBe(false);
      expect(boton().textContent).toContain('con Webpay');

      pago.iniciarWebpay.mockReturnValue(of(RESPUESTA));
      boton().click();
      expect(pago.iniciarWebpay).toHaveBeenCalledTimes(2);
      expect(pago.redirigirAWebpay).toHaveBeenCalledTimes(1);
    });

    it('un 400 (orden ya pagada) se explica sin hablar de datos de tarjeta', () => {
      pago.iniciarWebpay.mockReturnValue(
        throwError(() => ({ status: 400, mensaje: 'Los datos de la tarjeta…' }) as PagoError),
      );
      boton().click();
      fixture.detectChanges();
      expect(texto()).toContain('ya tiene un pago aprobado');
      expect(texto()).not.toContain('tarjeta…');
    });
  });

  it('sin compra registrada no permite pagar (no inventa ordenId ni monto)', async () => {
    await setup('00000000-0000-4000-8000-000000000000');
    expect(component.ordenValida()).toBe(false);
    expect(texto()).toContain('No hay una compra para pagar');
    expect(fixture.nativeElement.querySelector('#btnPagar')).toBeNull();
    component.pagar();
    expect(pago.iniciarWebpay).not.toHaveBeenCalled();
  });
});
