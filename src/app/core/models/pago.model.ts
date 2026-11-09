/**
 * Enumeración con los estados oficiales del ciclo de vida de un pago
 * en el microservicio ms-pago.
 */
export enum EstadoPago {
  INICIADO = 'INICIADO',
  AUTORIZADO = 'AUTORIZADO',
  RECHAZADO = 'RECHAZADO',
  BLOQUEADO_FRAUDE = 'BLOQUEADO_FRAUDE',
}

/**
 * Payload para iniciar la transacción de pago con validación antifraude.
 * Nota: Los nombres coinciden con el DTO real del backend Spring Boot IniciarPagoRequest.
 */
export interface IniciarPagoRequest {
  ordenId: string;
  monto: number;
  numeroTarjeta: string;
  cvv: string;
  mesVencimiento: number;
  anioVencimiento: number;
  nombreTitular?: string;
}

/**
 * Respuesta devuelta por POST /api/v1/pago/iniciar (HTTP 201).
 */
export interface IniciarPagoResponse {
  pagoId: string;
  ordenId: string;
  monto: number;
  estado: string;
  token: string;
  urlRedireccion: string;
  tarjetaUltimos4: string;
  tarjetaMarca: string;
}

/**
 * Payload para confirmar/resolver la transacción con el token de pasarela.
 */
export interface ConfirmarPagoRequest {
  token: string;
}

/**
 * DTO de respuesta para consultas y confirmaciones de pago (PagoResponseDTO).
 */
export interface PagoResponse {
  id: string;
  ordenId: string;
  monto: number;
  moneda: string;
  estado: EstadoPago;
  tokenTransaccion?: string;
  codigoAutorizacion?: string;
  tarjetaUltimos4?: string;
  tarjetaMarca?: string;
  mensajeRespuesta?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * DTO para alertas de fraude registradas por el motor de ventana deslizante.
 */
export interface AlertaFraude {
  id: string;
  ordenId: string;
  pagoId: string;
  tarjetaHash: string;
  tarjetaUltimos4: string;
  intentosDetectados: number;
  ventanaSegundos: number;
  motivo: string;
  createdAt: string;
}

/**
 * Modelo estructurado de error para el flujo de pagos.
 */
export interface PagoError {
  status: number;
  codigo?: string;
  mensaje: string;
  esBloqueoFraude?: boolean;
  esNoDisponible?: boolean;
  intentosDetectados?: number;
  ventanaSegundos?: number;
  detallesPorCampo?: Record<string, string>;
  pagoId?: string;
  ordenId?: string;
}
