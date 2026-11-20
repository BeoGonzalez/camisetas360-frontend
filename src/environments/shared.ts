import { ENV } from './env.generated';

/**
 * Partes comunes a todos los entornos. Los valores de Entra y las URLs vienen de
 * env.generated.ts (scripts/write-env.mjs <- .env / variables de entorno): nada se hardcodea.
 */

/** Origen desde el que se sirve el SPA (dev server, nginx o el navegador en producción). */
export const ORIGIN =
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200';

/** Scopes delegados de la API (sensibles a mayúsculas). */
export const API_SCOPE_NAMES = [
  'Profile.Read',
  'Catalog.Read',
  'Checkout.Create',
  'Orders.Read',
  'Notifications.Send',
] as const;
export type ApiScopeName = (typeof API_SCOPE_NAMES)[number];

export const endpoints = {
  catalog: '/api/v1/catalog',
  cart: '/api/v1/carrito',
  auth: '/api/v1/auth',
  orders: '/api/v1/orders',
  notifications: '/api/v1/notifications',
  recomendaciones: '/api/v1/recomendaciones',
  analytics: '/api/v1/analytics',
  cognitoLogin: '/api/v1/auth/cognito/login',
  cognitoRegister: '/api/v1/auth/cognito/register',
  pago: '/api/v1/pago',
};

export const azure = {
  /** Application ID URI de la API (audience). Los scopes se piden como <apiScope>/<Scope>. */
  apiScope: ENV.apiScopeBase,
  clientId: ENV.entraClientId,
  authority: `https://login.microsoftonline.com/${ENV.entraTenantId}`,
  /** Debe estar registrada como "Aplicación de página única" en Entra para cada origen. */
  redirectUri: `${ORIGIN}/auth/microsoft/callback`,
  scopes: API_SCOPE_NAMES.map((s) => `${ENV.apiScopeBase}/${s}`),
};

export const ws = {
  metricasPath: '/ws/metricas',
  metricasTopic: '/topic/metricas',
  fallbackPollingMs: 5000,
  /** API Gateway WebSocket corta la conexión a las 2 h: se renueva antes con un token nuevo. */
  telemetriaRenovarMs: 110 * 60 * 1000,
};

/** Seguimiento tras el checkout (202): GET /orders cada 2 s, hasta ~30 s. */
export const ordersPolling = {
  intervalMs: 2000,
  timeoutMs: 30000,
};

/**
 * SUPUESTO (brecha conocida #2): pagos exige ordenId UUID y orders usa orderId numérico.
 * El backend no relaciona ambos; el único UUID que identifica la compra es el requestId
 * del checkout (202). Este es el ÚNICO lugar donde se decide qué se envía como ordenId.
 */
export const pagos = {
  ordenIdFuente: 'checkoutRequestId' as const,
  /**
   * Antifraude (ms-pagos): más de 3 intentos con la misma tarjeta en 10 s => 429 y bloqueo de
   * 30 min. El tiempo real lo informa el backend (segundosParaReintentar / Retry-After); este
   * valor solo se usa si el 429 no lo trae.
   */
  bloqueoPorDefectoMinutos: 30,
  // El pago usa Webpay Plus real: la tarjeta se ingresa en Webpay (Transbank), nunca en el
  // frontend, así que no hay validación de tarjetas ni tarjetas de prueba que aceptar aquí.
};

export { ENV };
