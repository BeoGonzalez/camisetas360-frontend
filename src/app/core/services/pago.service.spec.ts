import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PagoService } from './pago.service';
import { environment } from '../../../environments/environment';
import {
  EstadoPago,
  IniciarPagoRequest,
  IniciarPagoResponse,
  PagoError,
  PagoResponse,
} from '../models/pago.model';

describe('PagoService', () => {
  let service: PagoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PagoService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(PagoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('iniciarPago', () => {
    const dummyReq: IniciarPagoRequest = {
      ordenId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      monto: 15990,
      numeroTarjeta: '4532015112830366',
      cvv: '123',
      mesVencimiento: 12,
      anioVencimiento: 2028,
      nombreTitular: 'Juan Perez',
    };

    it('debe iniciar pago exitosamente y retornar HTTP 201', () => {
      const mockResponse: IniciarPagoResponse = {
        pagoId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        ordenId: dummyReq.ordenId,
        monto: 15990,
        estado: 'INICIADO',
        token: 'tok_abc123',
        urlRedireccion: 'http://localhost:8087/api/v1/pago/retorno?token_ws=tok_abc123',
        tarjetaUltimos4: '0366',
        tarjetaMarca: 'VISA',
      };

      let res: IniciarPagoResponse | undefined;
      service.iniciarPago(dummyReq).subscribe((r) => (res = r));

      const req = httpMock.expectOne(`${service.apiUrl}/iniciar`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dummyReq);
      req.flush(mockResponse, { status: 201, statusText: 'Created' });
      expect(res).toEqual(mockResponse);
    });

    it('debe manejar error 400 de validación de campos adecuadamente', () => {
      let errorCapturado: PagoError | undefined;

      service.iniciarPago(dummyReq).subscribe({
        next: () => expect.unreachable(),
        error: (err: PagoError) => {
          errorCapturado = err;
        },
      });

      const req = httpMock.expectOne(`${service.apiUrl}/iniciar`);
      req.flush(
        {
          timestamp: '2026-11-09T00:00:00Z',
          status: 400,
          error: 'VALIDATION_FAILED',
          mensaje: 'numeroTarjeta: El número de tarjeta es obligatorio, cvv: El CVV es obligatorio',
        },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(errorCapturado).toBeTruthy();
      expect(errorCapturado?.status).toBe(400);
      expect(errorCapturado?.mensaje).toBe('Los datos de la tarjeta o del pago son inválidos.');
      expect(errorCapturado?.detallesPorCampo).toEqual({
        numeroTarjeta: 'El número de tarjeta es obligatorio',
        cvv: 'El CVV es obligatorio',
      });
    });

    it('debe mapear el error 429 de bloqueo antifraude sin invitar a reintentar de inmediato', () => {
      let errorCapturado: PagoError | undefined;

      service.iniciarPago(dummyReq).subscribe({
        next: () => expect.unreachable(),
        error: (err: PagoError) => {
          errorCapturado = err;
        },
      });

      const req = httpMock.expectOne(`${service.apiUrl}/iniciar`);
      req.flush(
        {
          timestamp: '2026-11-09T00:00:00Z',
          status: 429,
          error: 'TOO_MANY_REQUESTS',
          codigo: 'BLOQUEADO_FRAUDE',
          mensaje: 'Bloqueado preventivamente por antifraude: 4 intentos en ventana de 10 segundos',
          ordenId: dummyReq.ordenId,
          pagoId: 'pago-uuid-123',
          tarjetaUltimos4: '0366',
          intentosDetectados: 4,
          ventanaSegundos: 10,
        },
        { status: 429, statusText: 'Too Many Requests' },
      );

      expect(errorCapturado).toBeTruthy();
      expect(errorCapturado?.status).toBe(429);
      expect(errorCapturado?.esBloqueoFraude).toBe(true);
      expect(errorCapturado?.codigo).toBe('BLOQUEADO_FRAUDE');
      expect(errorCapturado?.intentosDetectados).toBe(4);
      expect(errorCapturado?.ventanaSegundos).toBe(10);
      expect(errorCapturado?.mensaje).toContain('Transacción bloqueada por seguridad preventiva');
      expect(errorCapturado?.mensaje).not.toContain('reintentar');
    });

    describe('429: tiempo de bloqueo (contrato de ms-pagos)', () => {
      const capturar429 = (body: object, headers: Record<string, string> = {}) => {
        let err: PagoError | undefined;
        service.iniciarPago(dummyReq).subscribe({ error: (e) => (err = e) });
        httpMock
          .expectOne(`${service.apiUrl}/iniciar`)
          .flush(
            { codigo: 'BLOQUEADO_FRAUDE', ...body },
            { status: 429, statusText: 'Too Many Requests', headers },
          );
        return err;
      };

      it('usa segundosParaReintentar del body (1800 = 30 min)', () => {
        expect(capturar429({ segundosParaReintentar: 1800 })?.segundosParaReintentar).toBe(1800);
      });

      it('sin el campo, usa el header Retry-After', () => {
        expect(capturar429({}, { 'Retry-After': '1795' })?.segundosParaReintentar).toBe(1795);
      });

      it('sin campo ni header, usa desbloqueoEn', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-13T15:00:00Z'));
        const err = capturar429({ desbloqueoEn: '2026-11-13T15:29:00Z' });
        vi.useRealTimers();
        expect(err?.segundosParaReintentar).toBe(29 * 60);
      });

      it('si el 429 no informa nada, 30 minutos por defecto', () => {
        expect(capturar429({})?.segundosParaReintentar).toBe(
          environment.pagos.bloqueoPorDefectoMinutos * 60,
        );
        expect(environment.pagos.bloqueoPorDefectoMinutos).toBe(30);
      });
    });

    it('debe manejar error 503 / 0 de servicio o red no disponible con opción de reintento', () => {
      let errorCapturado: PagoError | undefined;

      service.iniciarPago(dummyReq).subscribe({
        next: () => expect.unreachable(),
        error: (err: PagoError) => {
          errorCapturado = err;
        },
      });

      const req = httpMock.expectOne(`${service.apiUrl}/iniciar`);
      req.flush(null, { status: 503, statusText: 'Service Unavailable' });

      expect(errorCapturado).toBeTruthy();
      expect(errorCapturado?.status).toBe(503);
      expect(errorCapturado?.esNoDisponible).toBe(true);
      expect(errorCapturado?.mensaje).toContain('disponible');
    });
  });

  describe('confirmarPago y retornoWebpay', () => {
    const mockPago: PagoResponse = {
      id: 'pago-uuid-1',
      ordenId: 'orden-uuid-1',
      monto: 15990,
      moneda: 'CLP',
      estado: EstadoPago.AUTORIZADO,
      tokenTransaccion: 'tok_123',
      codigoAutorizacion: 'AUTH-123',
      tarjetaUltimos4: '0366',
      tarjetaMarca: 'VISA',
      mensajeRespuesta: 'Transacción autorizada exitosamente',
      createdAt: '2026-11-09T00:00:00Z',
    };

    it('debe confirmar el pago con el token', () => {
      let res: PagoResponse | undefined;
      service.confirmarPago('tok_123').subscribe((r) => (res = r));

      const req = httpMock.expectOne(`${service.apiUrl}/confirmar`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ token: 'tok_123' });
      req.flush(mockPago);
      expect(res).toEqual(mockPago);
    });

    it('debe procesar el retorno Webpay con el token_ws', () => {
      let res: PagoResponse | undefined;
      service.retornoWebpay('tok_123').subscribe((r) => (res = r));

      const req = httpMock.expectOne((r) => r.url === `${service.apiUrl}/retorno`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('token_ws')).toBe('tok_123');
      req.flush(mockPago);
      expect(res).toEqual(mockPago);
    });

    it('debe manejar error 404 de token no encontrado', () => {
      let errorCapturado: PagoError | undefined;

      service.confirmarPago('token_inexistente').subscribe({
        next: () => expect.unreachable(),
        error: (err: PagoError) => {
          errorCapturado = err;
        },
      });

      const req = httpMock.expectOne(`${service.apiUrl}/confirmar`);
      req.flush(
        {
          timestamp: '2026-11-09T00:00:00Z',
          status: 404,
          error: 'NOT_FOUND',
          mensaje: 'Transacción no encontrada para token: token_inexistente',
        },
        { status: 404, statusText: 'Not Found' },
      );

      expect(errorCapturado).toBeTruthy();
      expect(errorCapturado?.status).toBe(404);
      expect(errorCapturado?.mensaje).toBe('El pago o token de transacción solicitado no existe.');
      // El mensaje crudo del backend repite el token: no debe llegar a la UI.
      expect(JSON.stringify(errorCapturado)).not.toContain('token_inexistente');
    });
  });

  describe('consultas de pago e historial', () => {
    it('debe obtener pago por ID', () => {
      const mockPago: PagoResponse = {
        id: 'pago-uuid-1',
        ordenId: 'orden-uuid-1',
        monto: 25000,
        moneda: 'CLP',
        estado: EstadoPago.AUTORIZADO,
        createdAt: '2026-11-09T00:00:00Z',
      };

      let res: PagoResponse | undefined;
      service.obtenerPagoPorId('pago-uuid-1').subscribe((r) => (res = r));

      const req = httpMock.expectOne(`${service.apiUrl}/pago-uuid-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockPago);
      expect(res).toEqual(mockPago);
    });

    it('debe obtener el historial de pagos de una orden', () => {
      const mockList: PagoResponse[] = [
        {
          id: 'p1',
          ordenId: 'ord-1',
          monto: 10000,
          moneda: 'CLP',
          estado: EstadoPago.RECHAZADO,
          createdAt: '2026-11-09T00:00:00Z',
        },
        {
          id: 'p2',
          ordenId: 'ord-1',
          monto: 10000,
          moneda: 'CLP',
          estado: EstadoPago.AUTORIZADO,
          createdAt: '2026-11-09T00:05:00Z',
        },
      ];

      let res: PagoResponse[] | undefined;
      service.obtenerPagosPorOrden('ord-1').subscribe((r) => (res = r));

      const req = httpMock.expectOne(`${service.apiUrl}/orden/ord-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockList);
      expect(res).toEqual(mockList);
    });

    it('debe obtener la lista de alertas antifraude', () => {
      let alertas: unknown[] | undefined;
      service.obtenerAlertas().subscribe((a) => (alertas = a));

      const req = httpMock.expectOne(`${service.apiUrl}/alertas`);
      expect(req.request.method).toBe('GET');
      req.flush([
        {
          id: 'alerta-1',
          ordenId: 'ord-1',
          pagoId: 'pago-1',
          tarjetaHash: 'hash-abc',
          tarjetaUltimos4: '0366',
          intentosDetectados: 4,
          ventanaSegundos: 10,
          motivo: 'Bloqueado',
          createdAt: '2026-11-09T00:00:00Z',
        },
      ]);
      expect(alertas).toHaveLength(1);
      expect(alertas![0]).toMatchObject({ tarjetaUltimos4: '0366', intentosDetectados: 4 });
    });

    it('usa {API_BASE} (environment.apiGateway) como única base', () => {
      expect(service.apiUrl).toBe(`${environment.apiGateway}/api/v1/pago`);
    });

    it('mapea 422 a un error de regla de negocio sin el texto crudo', () => {
      let err: PagoError | undefined;
      service.obtenerPagoPorId('x').subscribe({ error: (e) => (err = e) });
      httpMock
        .expectOne(`${service.apiUrl}/x`)
        .flush(
          { mensaje: 'Monto 15990 distinto de 16000 en OrdenRepository#validar' },
          { status: 422, statusText: 'Unprocessable' },
        );
      expect(err?.codigo).toBe('REGLA_NEGOCIO');
      expect(err?.mensaje).toBe('El pago no cumple las reglas del negocio.');
    });

    it('500 con el PAN reflejado en el body: nunca llega al error', () => {
      let err: PagoError | undefined;
      service.obtenerPagoPorId('x').subscribe({ error: (e) => (err = e) });
      httpMock
        .expectOne(`${service.apiUrl}/x`)
        .flush(
          { mensaje: 'Gateway timeout procesando tarjeta 4532015112830366' },
          { status: 500, statusText: 'Error' },
        );
      expect(err?.status).toBe(500);
      expect(JSON.stringify(err)).not.toContain('4532015112830366');
    });
  });
});
