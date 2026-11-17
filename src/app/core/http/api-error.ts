import { HttpErrorResponse } from '@angular/common/http';

/**
 * Clasificación uniforme de errores HTTP del backend (contrato Camisetas360; el backend
 * responde ProblemDetail `application/problem+json` con `title`/`detail`):
 * 400 validación · 401 no autenticado · 403 sin rol/scope · 404 inexistente o ajeno ·
 * 422 regla de negocio · 429 bloqueo (antifraude de pagos) · 503 servicio no disponible ·
 * 0/5xx red o servidor.
 *
 * El mensaje visible SIEMPRE es uno propio (o el override del servicio): nunca se muestra el
 * texto crudo del backend ni stack traces. El `detail` queda en `ApiError.detail` para lógica.
 */
export type ApiErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'business'
  | 'rate_limited'
  | 'network'
  | 'unavailable'
  | 'server'
  | 'unknown';

export interface ApiError {
  kind: ApiErrorKind;
  status: number;
  /** Mensaje apto para mostrar al usuario (nunca incluye tokens ni datos de tarjeta). */
  message: string;
  /** Mensaje devuelto por el backend, si lo hay. No mostrar tal cual al usuario. */
  detail?: string;
  /** Si tiene sentido ofrecer "Reintentar" manual. */
  retryable: boolean;
}

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  validation: 'Los datos enviados no son válidos. Revisa el formulario.',
  unauthenticated: 'Tu sesión expiró. Inicia sesión nuevamente.',
  forbidden: 'No tienes permiso para realizar esta acción.',
  not_found: 'El recurso solicitado no existe.',
  business: 'La operación no cumple las reglas del negocio.',
  rate_limited: 'Pago bloqueado por seguridad, intenta más tarde.',
  network: 'No se pudo conectar con el servidor. Revisa tu conexión y reintenta.',
  unavailable: 'Servicio no disponible por el momento. Reintenta en unos segundos.',
  server: 'El servidor tuvo un problema. Inténtalo nuevamente en unos momentos.',
  unknown: 'Ocurrió un error inesperado.',
};

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 0) return 'network';
  if (status === 400) return 'validation';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422) return 'business';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'unavailable';
  if (status >= 500) return 'server';
  return 'unknown';
}

/** Extrae el texto del cuerpo de error (ProblemDetail detail/title; Spring message/mensaje/error). */
function backendMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const b = body as Record<string, unknown>;
  for (const key of ['detail', 'mensaje', 'message', 'title', 'error']) {
    const v = b[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return undefined;
}

export function toApiError(
  error: unknown,
  overrides: Partial<Record<ApiErrorKind, string>> = {},
): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { kind: 'unknown', status: -1, message: DEFAULT_MESSAGES.unknown, retryable: true };
  }
  const kind = kindFromStatus(error.status);
  return {
    kind,
    status: error.status,
    message: overrides[kind] ?? DEFAULT_MESSAGES[kind],
    detail: backendMessage(error.error),
    retryable:
      kind === 'network' || kind === 'unavailable' || kind === 'server' || kind === 'unknown',
  };
}

export function isApiError(value: unknown): value is ApiError {
  return !!value && typeof value === 'object' && 'kind' in value && 'status' in value;
}
