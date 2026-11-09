import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ResultadoPagoComponent } from './resultado-pago.component';
import { PagoService } from '../../../../core/services/pago.service';
import { EstadoPago, PagoResponse } from '../../../../core/models/pago.model';

describe('ResultadoPagoComponent', () => {
  let component: ResultadoPagoComponent;
  let fixture: ComponentFixture<ResultadoPagoComponent>;
  let pagoServiceMock: any;

  const mockPagoAutorizado: PagoResponse = {
    id: 'pago-111',
    ordenId: 'ord-111',
    monto: 15990,
    moneda: 'CLP',
    estado: EstadoPago.AUTORIZADO,
    codigoAutorizacion: 'AUTH-12345',
    tarjetaUltimos4: '0366',
    tarjetaMarca: 'VISA',
    createdAt: '2026-11-09T00:00:00Z',
  };

  beforeEach(async () => {
    pagoServiceMock = {
      obtenerPagoPorId: () => of(mockPagoAutorizado),
      obtenerPagosPorOrden: () => of([mockPagoAutorizado]),
    };

    await TestBed.configureTestingModule({
      imports: [ResultadoPagoComponent],
      providers: [
        provideRouter([]),
        { provide: PagoService, useValue: pagoServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => (key === 'pagoId' ? 'pago-111' : null),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResultadoPagoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse y cargar el detalle del pago autorizado', () => {
    expect(component).toBeTruthy();
    expect(component.pago()).toEqual(mockPagoAutorizado);
    expect(component.cargando()).toBe(false);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('¡Pago Autorizado!');
    expect(compiled.textContent).toContain('AUTH-12345');
    expect(compiled.textContent).toContain('0366');
  });

  it('debe mostrar pantalla de rechazo cuando el estado es RECHAZADO', () => {
    component.pago.set({
      ...mockPagoAutorizado,
      estado: EstadoPago.RECHAZADO,
      mensajeRespuesta: 'Fondos insuficientes',
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Pago Rechazado');
    expect(compiled.textContent).toContain('Fondos insuficientes');
    expect(compiled.textContent).toContain('Reintentar con otra tarjeta');
  });

  it('debe mostrar alerta de seguridad cuando el estado es BLOQUEADO_FRAUDE sin reintento inmediato', () => {
    component.pago.set({
      ...mockPagoAutorizado,
      estado: EstadoPago.BLOQUEADO_FRAUDE,
      mensajeRespuesta: 'Bloqueado preventivamente por antifraude',
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Operación Bloqueada por Seguridad');
    expect(compiled.textContent).toContain('NO reintente inmediatamente');
    expect(compiled.textContent).not.toContain('Reintentar con otra tarjeta');
  });
});
