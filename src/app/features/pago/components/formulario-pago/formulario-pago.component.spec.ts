import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { FormularioPagoComponent } from './formulario-pago.component';
import { PagoService } from '../../../../core/services/pago.service';
import { CheckoutTrackerService } from '../../../../core/services/checkout-tracker.service';
import {
  EstadoPago,
  IniciarPagoResponse,
  PagoError,
  PagoResponse,
} from '../../../../core/models/pago.model';
import { environment } from '../../../../../environments/environment';
import { TARJETAS_PRUEBA_TRANSBANK } from '../../../../core/validators/tarjeta.validators';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

const REQUEST_ID = '7d4e1c2a-1111-4222-8333-944455556666';
const TARJETA = {
  numeroTarjeta: '4532 0151 1283 0366',
  nombreTitular: 'Carlos Valderrama',
  mesVencimiento: 12,
  anioVencimiento: 2030,
  cvv: '123',
};

describe('FormularioPagoComponent', () => {
  let component: FormularioPagoComponent;
  let fixture: ComponentFixture<FormularioPagoComponent>;
  let pago: { iniciarPago: ReturnType<typeof vi.fn>; confirmarPago: ReturnType<typeof vi.fn> };
  let router: Router;

  async function setup(ordenId: string | null) {
    pago = {
      iniciarPago: vi.fn(() =>
        of({
          pagoId: 'p-1',
          ordenId: REQUEST_ID,
          monto: 4990,
          estado: 'INICIADO',
          token: 'tok-abc',
          urlRedireccion: '',
          tarjetaUltimos4: '0366',
          tarjetaMarca: 'VISA',
        } as IniciarPagoResponse),
      ),
      confirmarPago: vi.fn(() =>
        of({
          id: 'p-1',
          ordenId: REQUEST_ID,
          monto: 4990,
          moneda: 'CLP',
          estado: EstadoPago.AUTORIZADO,
          createdAt: '',
        } as PagoResponse),
      ),
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
    router = TestBed.inject(Router);
    fixture.detectChanges();
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('con una compra registrada', () => {
    beforeEach(() => setup(REQUEST_ID));

    it.each(TARJETAS_PRUEBA_TRANSBANK.map((t) => [t.tipo, t.numero, t.autorizada] as const))(
      'acepta la tarjeta de prueba Transbank %s %s y la envía sin espacios',
      (_tipo, numero) => {
        // Se tipea como lo haría el usuario: agrupado de a 4 (la AMEX tiene 15 dígitos).
        vi.spyOn(router, 'navigate').mockResolvedValue(true);
        const tipeado = numero.replace(/(\d{4})(?=\d)/g, '$1 ');
        component.onPanInput({ target: { value: tipeado } } as unknown as Event);
        component.pagoForm.patchValue({ ...TARJETA, numeroTarjeta: tipeado, cvv: '1234' });
        expect(component.pagoForm.get('numeroTarjeta')?.errors).toBeNull();
        expect(component.pagoForm.valid).toBe(true);
        component.iniciarPago();
        expect(pago.iniciarPago).toHaveBeenCalledWith(
          expect.objectContaining({ numeroTarjeta: numero, cvv: '1234' }),
        );
      },
    );

    it('toma ordenId y monto de la compra (no de la URL)', () => {
      expect(component.ordenValida()).toBe(true);
      expect(component.ordenId()).toBe(REQUEST_ID);
      expect(component.monto()).toBe(4990);
    });

    it('formulario inválido al inicio y válido con datos correctos', () => {
      expect(component.pagoForm.valid).toBe(false);
      component.pagoForm.patchValue(TARJETA);
      expect(component.pagoForm.valid).toBe(true);
    });

    it('detecta la marca de la tarjeta', () => {
      component.onPanInput({ target: { value: '4532015112830366' } } as unknown as Event);
      expect(component.marcaDetectada()).toBe('VISA');
    });

    it('iniciar -> confirmar con token -> resultado; envía el contrato correcto', () => {
      const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.pagoForm.patchValue(TARJETA);
      component.iniciarPago();
      expect(pago.iniciarPago).toHaveBeenCalledWith({
        ordenId: REQUEST_ID,
        monto: 4990,
        numeroTarjeta: '4532015112830366',
        cvv: '123',
        mesVencimiento: 12,
        anioVencimiento: 2030,
        nombreTitular: 'Carlos Valderrama',
      });
      expect(pago.confirmarPago).toHaveBeenCalledWith('tok-abc');
      expect(nav).toHaveBeenCalledWith(['/pago/resultado'], {
        queryParams: { pagoId: 'p-1', ordenId: REQUEST_ID },
      });
    });

    it('PAN y CVV se limpian del formulario apenas se envía (aunque falle)', () => {
      pago.iniciarPago.mockReturnValue(
        throwError(() => ({ status: 400, mensaje: 'x' }) as PagoError),
      );
      component.pagoForm.patchValue(TARJETA);
      component.iniciarPago();
      expect(component.pagoForm.get('numeroTarjeta')?.value).toBe('');
      expect(component.pagoForm.get('cvv')?.value).toBe('');
    });

    describe('BLOQUEADO_FRAUDE (429: más de 3 intentos en 10 s)', () => {
      const TREINTA_MIN = 30 * 60;
      const fraude: PagoError = {
        status: 429,
        codigo: 'BLOQUEADO_FRAUDE',
        esBloqueoFraude: true,
        mensaje: 'Bloqueado',
        intentosDetectados: 4,
        ventanaSegundos: 10,
        segundosParaReintentar: TREINTA_MIN,
      };
      const bloqueo = () => fixture.nativeElement.querySelector('[data-testid="bloqueo-pago"]');
      const boton = () => fixture.nativeElement.querySelector('#btnPagar') as HTMLButtonElement;

      function provocarBloqueo() {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-13T15:00:00'));
        pago.iniciarPago.mockReturnValue(throwError(() => fraude));
        component.pagoForm.patchValue(TARJETA);
        component.iniciarPago();
        fixture.detectChanges();
      }

      it('muestra que hay que esperar 30 minutos, con cuenta regresiva y hora de desbloqueo', () => {
        provocarBloqueo();
        const texto = bloqueo().textContent;
        expect(texto).toContain('Pago bloqueado por seguridad');
        expect(texto).toContain('debes esperar 30 minutos antes de volver a comprar');
        expect(texto).toContain('30:00');
        expect(texto).toContain('podrás reintentar a las 15:30');
        expect(boton().disabled).toBe(true);
        // Un solo aviso (no se duplica con la alerta genérica de error).
        expect(fixture.nativeElement.querySelectorAll('[role="alert"]').length).toBe(1);

        vi.advanceTimersByTime(61_000);
        fixture.detectChanges();
        expect(bloqueo().textContent).toContain('28:59');
      });

      it('no permite reintentar durante el bloqueo aunque el formulario sea válido', () => {
        provocarBloqueo();
        vi.advanceTimersByTime(29 * 60 * 1000);
        component.pagoForm.patchValue(TARJETA);
        component.iniciarPago();
        expect(pago.iniciarPago).toHaveBeenCalledTimes(1);
      });

      it('el bloqueo sobrevive a recargar la página y solo guarda ordenId + hora', async () => {
        provocarBloqueo();
        const guardado = localStorage.getItem('c360_bloqueos_pago') ?? '';
        expect(JSON.parse(guardado)).toEqual({
          [REQUEST_ID]: new Date('2026-11-13T15:30:00').getTime(),
        });
        expect(guardado).not.toContain('4532');

        // "Recarga": componente nuevo, sin el error en memoria.
        vi.advanceTimersByTime(10 * 60 * 1000);
        fixture.destroy();
        TestBed.resetTestingModule();
        await setup(REQUEST_ID);
        expect(bloqueo().textContent).toContain('20:00');
        expect(boton().disabled).toBe(true);
      });

      it('al cumplirse los 30 minutos se libera el pago y se limpia el storage', () => {
        provocarBloqueo();
        vi.advanceTimersByTime(TREINTA_MIN * 1000);
        fixture.detectChanges();
        expect(bloqueo()).toBeNull();
        expect(component.error()).toBeNull();
        expect(localStorage.getItem('c360_bloqueos_pago')).toBeNull();
        component.pagoForm.patchValue(TARJETA);
        fixture.detectChanges();
        expect(boton().disabled).toBe(false);
      });

      it('si el 429 no informa el tiempo, bloquea 30 minutos por defecto', () => {
        vi.useFakeTimers();
        pago.iniciarPago.mockReturnValue(
          throwError(() => ({ ...fraude, segundosParaReintentar: undefined })),
        );
        component.pagoForm.patchValue(TARJETA);
        component.iniciarPago();
        fixture.detectChanges();
        expect(component.segundosBloqueo()).toBe(environment.pagos.bloqueoPorDefectoMinutos * 60);
      });
    });
  });

  describe('con el PagoService real y el backend reflejando el PAN', () => {
    const PAN = '4532015112830366';

    it.each([
      [500, { mensaje: `Timeout procesando tarjeta ${PAN} cvv 123` }],
      [400, { error: 'VALIDATION_FAILED', mensaje: `numeroTarjeta: rechazada ${PAN}` }],
    ])('%i: el PAN no queda en error, DOM, storage ni consola', async (status, body) => {
      const consola = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
        vi.spyOn(console, m).mockImplementation(() => undefined),
      );
      await TestBed.configureTestingModule({
        imports: [FormularioPagoComponent],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          {
            provide: CheckoutTrackerService,
            useValue: {
              compras: signal([
                {
                  requestId: REQUEST_ID,
                  totalAmount: 1,
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
                paramMap: convertToParamMap({ ordenId: REQUEST_ID }),
                queryParamMap: convertToParamMap({}),
              },
            },
          },
        ],
      }).compileComponents();
      const f = TestBed.createComponent(FormularioPagoComponent);
      f.detectChanges();
      f.componentInstance.pagoForm.patchValue(TARJETA);
      f.componentInstance.iniciarPago();

      const req = TestBed.inject(HttpTestingController).expectOne(
        `${environment.apiGateway}/api/v1/pago/iniciar`,
      );
      expect(req.request.body.numeroTarjeta).toBe(PAN); // el PAN viaja SOLO en el body
      req.flush(body, { status, statusText: 'x' });
      f.detectChanges();

      expect(f.componentInstance.error()?.status).toBe(status);
      const volcado = [
        JSON.stringify(f.componentInstance.error()),
        f.nativeElement.textContent,
        JSON.stringify({ ...localStorage }),
        JSON.stringify({ ...sessionStorage }),
        JSON.stringify(consola.flatMap((s) => s.mock.calls)),
      ].join('|');
      expect(volcado).not.toContain(PAN);
      expect(volcado.replace(/\s/g, '')).not.toContain(PAN);
      consola.forEach((s) => s.mockRestore());
    });
  });

  it('sin compra registrada no permite pagar (no inventa ordenId ni monto)', async () => {
    await setup('00000000-0000-4000-8000-000000000000');
    expect(component.ordenValida()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No hay una compra para pagar');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
});
