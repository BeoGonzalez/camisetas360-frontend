import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AlertaFraude,
  ConfirmarPagoRequest,
  IniciarPagoRequest,
  IniciarPagoResponse,
  IniciarWebpayRequest,
  IniciarWebpayResponse,
  PagoError,
  PagoResponse,
} from '../models/pago.model';

/** Secuencias de 12-19 dígitos (con espacios o guiones): posible PAN reflejado por el backend. */
const PATRON_PAN = /\d(?:[ -]?\d){11,18}/g;

/**
 * Segundos de bloqueo de un 429 antifraude. Fuente, en orden: `segundosParaReintentar` del body,
 * header `Retry-After` (segundos), `desbloqueoEn` del body; si no hay ninguno, el valor por
 * defecto del entorno (30 min). Se usan segundos relativos para no depender del reloj del backend.
 */
export function segundosParaReintentar(error: HttpErrorResponse): number {
  const body = error.error;
  const desdeBody = Number(body?.segundosParaReintentar);
  if (Number.isFinite(desdeBody) && desdeBody > 0) return Math.ceil(desdeBody);
  const retryAfter = Number(error.headers?.get('Retry-After'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.ceil(retryAfter);
  const hasta = Date.parse(body?.desbloqueoEn ?? '');
  if (Number.isFinite(hasta) && hasta > Date.now()) return Math.ceil((hasta - Date.now()) / 1000);
  return environment.pagos.bloqueoPorDefectoMinutos * 60;
}

/** Enmascara cualquier número con forma de tarjeta antes de guardarlo en estado o mostrarlo. */
export function enmascararPan(texto: string): string {
  return texto.replace(PATRON_PAN, '[número de tarjeta oculto]');
}

/**
 * Servicio encargado de la comunicación con el microservicio ms-pago
 * a través de AWS API Gateway.
 */
@Injectable({
  providedIn: 'root',
})
export class PagoService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  /** {API_BASE}/api/v1/pago. El servicio de pagos NO valida JWT (brecha #3). */
  readonly apiUrl = `${environment.apiGateway}${environment.endpoints.pago}`;

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
   * Crea la transacción en Webpay Plus (Transbank).
   * POST /api/v1/pago/webpay/iniciar
   */
  iniciarWebpay(request: IniciarWebpayRequest): Observable<IniciarWebpayResponse> {
    return this.http
      .post<IniciarWebpayResponse>(`${this.apiUrl}/webpay/iniciar`, request)
      .pipe(catchError((err: HttpErrorResponse) => this.handleError(err)));
  }

  /**
   * Envía el navegador a Webpay: formulario POST a `url` con el campo `token_ws`, como indica
   * Transbank. Al terminar, Webpay devuelve al cliente al backend, que redirige a /pago/resultado.
   */
  redirigirAWebpay(url: string, token: string): void {
    const form = this.document.createElement('form');
    form.method = 'POST';
    form.action = url;
    const campo = this.document.createElement('input');
    campo.type = 'hidden';
    campo.name = 'token_ws';
    campo.value = token;
    form.appendChild(campo);
    this.document.body.appendChild(form);
    form.submit();
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
        // El texto crudo del backend no se muestra; los errores por campo sí (validación del form).
        pagoError.mensaje = 'Los datos de la tarjeta o del pago son inválidos.';

        // Mapear errores de validación de campos si vienen en formato "campo: mensaje, campo: mensaje"
        if (typeof errBody?.mensaje === 'string' && errBody.mensaje.includes(':')) {
          const detalles: Record<string, string> = {};
          const partes = errBody.mensaje.split(', ');
          for (const parte of partes) {
            const idx = parte.indexOf(':');
            if (idx > 0) {
              const campo = parte.substring(0, idx).trim();
              const msg = parte.substring(idx + 1).trim();
              detalles[campo] = enmascararPan(msg);
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
          'Transacción bloqueada por seguridad preventiva: se detectaron demasiados intentos de pago en pocos segundos.';
        pagoError.intentosDetectados = errBody?.intentosDetectados;
        pagoError.ventanaSegundos = errBody?.ventanaSegundos;
        pagoError.segundosParaReintentar = segundosParaReintentar(error);
        pagoError.pagoId = errBody?.pagoId;
        pagoError.ordenId = errBody?.ordenId;
        break;
      }

      case 404: {
        pagoError.codigo = 'NO_ENCONTRADO';
        // No se usa errBody.mensaje: el backend incluye en él el token de la transacción.
        pagoError.mensaje = 'El pago o token de transacción solicitado no existe.';
        break;
      }

      case 422: {
        pagoError.codigo = errBody?.codigo || 'REGLA_NEGOCIO';
        pagoError.mensaje = 'El pago no cumple las reglas del negocio.';
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
          status >= 500
            ? 'Error interno en la pasarela de pagos. Por favor intenta más tarde.'
            : 'Error en la solicitud de pago.';
        break;
      }
    }

    return throwError(() => pagoError);
  }
}
