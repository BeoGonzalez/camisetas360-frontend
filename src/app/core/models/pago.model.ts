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

/** POST /api/v1/pago/webpay/iniciar: la tarjeta se ingresa en Webpay, no en Camisetas360. */
export interface IniciarWebpayRequest {
  ordenId: string;
  monto: number;
}

/** 201 de POST /api/v1/pago/webpay/iniciar: enviar el navegador a `url` con `token_ws=token` (POST). */
export interface IniciarWebpayResponse {
  pagoId: string;
  ordenId: string;
  monto: number;
  token: string;
  url: string;
}

/** Resultado que el backend informa al volver de Webpay (query `estado` de /pago/resultado). */
export type EstadoCompra = 'APROBADO' | 'RECHAZADO';

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
  /** No se muestra nunca en la UI (brecha #3): solo tarjetaUltimos4. */
  tarjetaHash?: string;
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
  /** 429: segundos que faltan para poder volver a pagar (body o header Retry-After). */
  segundosParaReintentar?: number;
  detallesPorCampo?: Record<string, string>;
  pagoId?: string;
  ordenId?: string;
}
