import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ResultadoPagoComponent } from './resultado-pago.component';
import { PagoService } from '../../../../core/services/pago.service';
import { EstadoPago, PagoResponse } from '../../../../core/models/pago.model';

const ORDEN = 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d';
const PAGO_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const pagoWebpay = (cambios: Partial<PagoResponse> = {}): PagoResponse => ({
  id: PAGO_ID,
  ordenId: ORDEN,
  monto: 15990,
  moneda: 'CLP',
  estado: EstadoPago.AUTORIZADO,
  codigoAutorizacion: '1213',
  tarjetaUltimos4: '6623',
  tarjetaMarca: 'WEBPAY-VD',
  createdAt: '2026-11-09T15:00:00Z',
  ...cambios,
});

describe('ResultadoPagoComponent (retorno de Webpay)', () => {
  let fixture: ComponentFixture<ResultadoPagoComponent>;
  let obtenerPagoPorId: ReturnType<typeof vi.fn>;

  async function setup(query: Record<string, string>, respuesta: Observable<PagoResponse>) {
    obtenerPagoPorId = vi.fn(() => respuesta);
    await TestBed.configureTestingModule({
      imports: [ResultadoPagoComponent],
      providers: [
        provideRouter([]),
        {
          provide: PagoService,
          useValue: { obtenerPagoPorId, obtenerPagosPorOrden: vi.fn(() => of([])) },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ResultadoPagoComponent);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const titulo = () => el().querySelector('h1')?.textContent?.trim();
  const enlace = (texto: string) =>
    Array.from(el().querySelectorAll('a')).find((a) => a.textContent?.trim() === texto);

  it('APROBADO con pago: título de aprobada, comprobante y "Seguir comprando"', async () => {
    await setup({ estado: 'APROBADO', pagoId: PAGO_ID, ordenId: ORDEN }, of(pagoWebpay()));

    expect(obtenerPagoPorId).toHaveBeenCalledWith(PAGO_ID);
    expect(titulo()).toBe('Su compra ha sido aprobada');
    const comprobante = el().querySelector('[data-testid="comprobante"]')?.textContent ?? '';
    expect(comprobante).toContain('1213');
    expect(comprobante).toContain('15.990');
    expect(comprobante).toContain('WEBPAY-VD •••• 6623');
    expect(comprobante).toContain(ORDEN);
    expect(comprobante).toContain('09/11/2026');
    expect(enlace('Seguir comprando')?.getAttribute('href')).toBe('/catalog');
  });

  it('APROBADO con pago Webpay sin últimos 4: no muestra la fila de tarjeta', async () => {
    await setup(
      { estado: 'APROBADO', pagoId: PAGO_ID, ordenId: ORDEN },
      of(pagoWebpay({ tarjetaMarca: 'WEBPAY', tarjetaUltimos4: undefined })),
    );
    const comprobante = el().querySelector('[data-testid="comprobante"]')?.textContent ?? '';
    expect(comprobante).not.toContain('Tarjeta');
    expect(comprobante).not.toContain('WEBPAY');
  });

  it('RECHAZADO con pago: título de rechazada, mensaje y botones de reintento y carrito', async () => {
    await setup(
      { estado: 'RECHAZADO', pagoId: PAGO_ID, ordenId: ORDEN },
      of(pagoWebpay({ estado: EstadoPago.RECHAZADO, mensajeRespuesta: 'Transacción rechazada' })),
    );

    expect(titulo()).toBe('Su compra ha sido rechazada');
    expect(el().textContent).toContain('Transacción rechazada');
    expect(enlace('Reintentar pago')?.getAttribute('href')).toBe(`/pago/checkout/${ORDEN}`);
    expect(enlace('Volver al carrito')?.getAttribute('href')).toBe('/carrito');
    expect(el().querySelector('[data-testid="comprobante"]')).toBeNull();
  });

  it('el estado del pago cargado manda sobre el query param', async () => {
    await setup(
      { estado: 'APROBADO', pagoId: PAGO_ID, ordenId: ORDEN },
      of(pagoWebpay({ estado: EstadoPago.RECHAZADO })),
    );
    expect(titulo()).toBe('Su compra ha sido rechazada');
  });

  it('pago INICIADO: decide el query param `estado`', async () => {
    await setup(
      { estado: 'APROBADO', pagoId: PAGO_ID, ordenId: ORDEN },
      of(pagoWebpay({ estado: EstadoPago.INICIADO })),
    );
    expect(titulo()).toBe('Su compra ha sido aprobada');
    expect(el().querySelector('[data-testid="comprobante"]')).toBeNull();
  });

  it('estado=RECHAZADO sin pagoId: rechazada sin consultar ni ofrecer reintento', async () => {
    await setup({ estado: 'RECHAZADO' }, of(pagoWebpay()));

    expect(obtenerPagoPorId).not.toHaveBeenCalled();
    expect(titulo()).toBe('Su compra ha sido rechazada');
    expect(enlace('Reintentar pago')).toBeUndefined();
    expect(enlace('Volver al carrito')).toBeDefined();
  });

  it('estado=APROBADO con un GET que falla: aprobada sin comprobante', async () => {
    await setup(
      { estado: 'APROBADO', pagoId: PAGO_ID, ordenId: ORDEN },
      throwError(() => ({ status: 503 })),
    );

    expect(titulo()).toBe('Su compra ha sido aprobada');
    expect(el().querySelector('[data-testid="comprobante"]')).toBeNull();
    expect(enlace('Seguir comprando')).toBeDefined();
  });

  it('BLOQUEADO_FRAUDE: mantiene el aviso de seguridad sin reintento', async () => {
    await setup(
      { estado: 'RECHAZADO', pagoId: PAGO_ID, ordenId: ORDEN },
      of(pagoWebpay({ estado: EstadoPago.BLOQUEADO_FRAUDE })),
    );

    expect(titulo()).toBe('Operación Bloqueada por Seguridad');
    expect(el().textContent).toContain('NO reintente inmediatamente');
    expect(enlace('Reintentar pago')).toBeUndefined();
  });

  it('sin estado ni pago: no inventa un resultado', async () => {
    await setup({}, of(pagoWebpay()));
    expect(el().textContent).toContain('No se encontró información del pago');
  });
});
