import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AlertaFraude,
  ConfirmarPagoRequest,
  IniciarPagoRequest,
  IniciarPagoResponse,
  PagoError,
  PagoResponse,
} from '../models/pago.model';

/**
 * Servicio encargado de la comunicación con el microservicio ms-pago
 * a través de AWS API Gateway.
 */
@Injectable({
  providedIn: 'root',
})
export class PagoService {
  private readonly http = inject(HttpClient);

  /** URL base para los endpoints de pago (soporta desarrollo local y AWS API Gateway) */
  readonly apiUrl =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? '/api/v1/pago'
      : `${environment.apiGateway}${environment.endpoints.pago}`;

  /** URL base de la pasarela para healthcheck */
  readonly baseUrl =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? ''
      : environment.apiGateway;

  /**
   * Inicia una transacción de pago y ejecuta la evaluación antifraude preventiva.
   * POST /api/v1/pago/iniciar
   */
  iniciarPago(request: IniciarPagoRequest): Observable<IniciarPagoResponse> {
    return this.http
      .post<IniciarPagoResponse>(`${this.apiUrl}/iniciar`, request)
      .pipe(catchError((err: HttpErrorResponse) => this.handleError(err)));
  }

  /**
   * Confirma/resuelve la transacción utilizando el token recibido.
   * POST /api/v1/pago/confirmar
   */
  confirmarPago(token: string): Observable<PagoResponse> {
    const body: ConfirmarPagoRequest = { token };
    return this.http
      .post<PagoResponse>(`${this.apiUrl}/confirmar`, body)
      .pipe(catchError((err: HttpErrorResponse) => this.handleError(err)));
  }

  /**
   * Endpoint de retorno Webpay simulado (redirección del navegador).
   * GET /api/v1/pago/retorno?token_ws={token}
   */
  retornoWebpay(tokenWs: string): Observable<PagoResponse> {
    return this.http
      .get<PagoResponse>(`${this.apiUrl}/retorno`, {
        params: { token_ws: tokenWs },
      })
      .pipe(catchError((err: HttpErrorResponse) => this.handleError(err)));
  }

  /**
   * Obtiene el estado y detalle de un pago por su UUID.
   * GET /api/v1/pago/{id}
   */
  obtenerPagoPorId(id: string): Observable<PagoResponse> {
    return this.http
      .get<PagoResponse>(`${this.apiUrl}/${id}`)
      .pipe(catchError((err: HttpErrorResponse) => this.handleError(err)));
  }

  /**
   * Obtiene el historial de pagos asociados a una orden.
   * GET /api/v1/pago/orden/{ordenId}
   */
  obtenerPagosPorOrden(ordenId: string): Observable<PagoResponse[]> {
    return this.http
      .get<PagoResponse[]>(`${this.apiUrl}/orden/${ordenId}`)
      .pipe(catchError((err: HttpErrorResponse) => this.handleError(err)));
  }

  /**
   * Obtiene el registro de alertas antifraude (solo rol administrador).
   * GET /api/v1/pago/alertas
   */
  obtenerAlertas(): Observable<AlertaFraude[]> {
    return this.http
      .get<AlertaFraude[]>(`${this.apiUrl}/alertas`)
      .pipe(catchError((err: HttpErrorResponse) => this.handleError(err)));
  }

  /**
   * Healthcheck de disponibilidad de ms-pago.
   * GET /actuator/health
   */
  checkHealth(): Observable<{ status: string }> {
    return this.http
      .get<{ status: string }>(`${this.baseUrl}/actuator/health`)
      .pipe(catchError((err: HttpErrorResponse) => this.handleError(err)));
  }

  /**
   * Mapeo centralizado de errores HTTP de ms-pago.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    const status = error.status;
    const errBody = error.error;

    const pagoError: PagoError = {
      status,
      codigo: errBody?.codigo || errBody?.error || 'ERROR_PAGO',
      mensaje: 'Ocurrió un error inesperado al procesar el pago.',
    };

    switch (status) {
      case 400: {
        pagoError.codigo = errBody?.error || 'DATOS_INVALIDOS';
        pagoError.mensaje = errBody?.mensaje || 'Los datos de la tarjeta o del pago son inválidos.';

        // Mapear errores de validación de campos si vienen en formato "campo: mensaje, campo: mensaje"
        if (typeof errBody?.mensaje === 'string' && errBody.mensaje.includes(':')) {
          const detalles: Record<string, string> = {};
          const partes = errBody.mensaje.split(', ');
          for (const parte of partes) {
            const idx = parte.indexOf(':');
            if (idx > 0) {
              const campo = parte.substring(0, idx).trim();
              const msg = parte.substring(idx + 1).trim();
              detalles[campo] = msg;
            }
          }
          pagoError.detallesPorCampo = detalles;
        }
        break;
      }

      case 429: {
        pagoError.esBloqueoFraude = true;
        pagoError.codigo = 'BLOQUEADO_FRAUDE';
        pagoError.mensaje =
          'Transacción bloqueada por seguridad preventiva. Se detectó actividad inusual o múltiples intentos en un breve lapso de tiempo. Por favor comunícate con soporte si consideras que es un error.';
        pagoError.intentosDetectados = errBody?.intentosDetectados;
        pagoError.ventanaSegundos = errBody?.ventanaSegundos;
        pagoError.pagoId = errBody?.pagoId;
        pagoError.ordenId = errBody?.ordenId;
        break;
      }

      case 404: {
        pagoError.codigo = 'NO_ENCONTRADO';
        pagoError.mensaje =
          errBody?.mensaje || 'El pago o token de transacción solicitado no existe.';
        break;
      }

      case 503:
      case 0: {
        pagoError.esNoDisponible = true;
        pagoError.codigo = 'SERVICIO_NO_DISPONIBLE';
        pagoError.mensaje =
          'El servicio de pagos no está disponible temporalmente o se perdió la conexión de red. Puedes reintentar en unos momentos.';
        break;
      }

      default: {
        pagoError.mensaje =
          errBody?.mensaje ||
          (status >= 500
            ? 'Error interno en la pasarela de pagos. Por favor intenta más tarde.'
            : 'Error en la solicitud de pago.');
        break;
      }
    }

    return throwError(() => pagoError);
  }
}
