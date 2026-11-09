import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FormularioPagoComponent } from './formulario-pago.component';
import { PagoService } from '../../../../core/services/pago.service';
import { IniciarPagoResponse, PagoError } from '../../../../core/models/pago.model';

describe('FormularioPagoComponent', () => {
  let component: FormularioPagoComponent;
  let fixture: ComponentFixture<FormularioPagoComponent>;
  let pagoServiceMock: any;
  let router: Router;

  beforeEach(async () => {
    pagoServiceMock = {
      iniciarPago: () =>
        of({
          pagoId: 'pago-123',
          ordenId: 'ord-123',
          monto: 15990,
          estado: 'INICIADO',
          token: 'tok-abc',
          urlRedireccion: 'http://localhost:8087/api/v1/pago/retorno?token_ws=tok-abc',
          tarjetaUltimos4: '0366',
          tarjetaMarca: 'VISA',
        } as IniciarPagoResponse),
    };

    await TestBed.configureTestingModule({
      imports: [FormularioPagoComponent],
      providers: [
        provideRouter([]),
        { provide: PagoService, useValue: pagoServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FormularioPagoComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('debe crearse correctamente e inicializar el formulario inválido', () => {
    expect(component).toBeTruthy();
    expect(component.pagoForm.valid).toBe(false);
  });

  it('el formulario debe ser válido cuando los datos de tarjeta son correctos', () => {
    component.pagoForm.patchValue({
      numeroTarjeta: '4532 0151 1283 0366',
      nombreTitular: 'Carlos Valderrama',
      mesVencimiento: 12,
      anioVencimiento: 2028,
      cvv: '123',
    });

    expect(component.pagoForm.valid).toBe(true);
  });

  it('debe detectar la marca de tarjeta al ingresar el número', () => {
    const event = {
      target: { value: '4532015112830366' },
    } as unknown as Event;

    component.onPanInput(event);
    expect(component.marcaDetectada()).toBe('VISA');
  });

  it('debe llamar a iniciarPago, limpiar el formulario y navegar a /pago/retorno', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.pagoForm.patchValue({
      numeroTarjeta: '4532 0151 1283 0366',
      nombreTitular: 'Carlos Valderrama',
      mesVencimiento: 12,
      anioVencimiento: 2028,
      cvv: '123',
    });

    component.iniciarPago();

    expect(navigateSpy).toHaveBeenCalledWith(['/pago/retorno'], {
      queryParams: { token_ws: 'tok-abc' },
    });
    // Verificación de seguridad PCI: el formulario se resetea
    expect(component.pagoForm.get('cvv')?.value).toBeNull();
  });

  it('debe manejar error 429 de bloqueo antifraude y limpiar el CVV por seguridad', () => {
    const errorFraude: PagoError = {
      status: 429,
      codigo: 'BLOQUEADO_FRAUDE',
      esBloqueoFraude: true,
      mensaje: 'Transacción bloqueada por seguridad preventiva.',
      intentosDetectados: 4,
      ventanaSegundos: 10,
    };

    pagoServiceMock.iniciarPago = () => throwError(() => errorFraude);

    component.pagoForm.patchValue({
      numeroTarjeta: '4532 0151 1283 0366',
      nombreTitular: 'Carlos Valderrama',
      mesVencimiento: 12,
      anioVencimiento: 2028,
      cvv: '123',
    });

    component.iniciarPago();

    expect(component.error()).toEqual(errorFraude);
    expect(component.procesando()).toBe(false);
    // Verificación de seguridad PCI: CVV en memoria limpiado
    expect(component.pagoForm.get('cvv')?.value).toBeNull();
  });
});
