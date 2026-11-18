import { environment } from '../../../environments/environment';
import { ApiScopeName } from '../../../environments/shared';

type EndpointKey = keyof typeof environment.endpoints;

/**
 * Scope delegado que exige cada prefijo de la API (el backend pide rol Y scope).
 * pago no valida JWT; se envía Checkout.Create por si el API Gateway lo exige.
 */
export const SCOPE_POR_ENDPOINT: ReadonlyArray<readonly [EndpointKey, ApiScopeName]> = [
  ['auth', 'Profile.Read'],
  ['catalog', 'Catalog.Read'],
  ['cart', 'Checkout.Create'],
  ['orders', 'Orders.Read'],
  ['notifications', 'Notifications.Send'],
  ['recomendaciones', 'Catalog.Read'],
  ['analytics', 'Catalog.Read'],
  ['pago', 'Checkout.Create'],
];

export function apiScope(name: ApiScopeName): string {
  return `${environment.azure.apiScope}/${name}`;
}

/**
 * Ruta de la URL si pertenece a {API_BASE} (mismo origen EXACTO, ruta /api/v1/...), o null.
 * Compara el origen parseado: un prefijo de texto dejaría pasar `https://gw.com.evil.example`.
 */
export function rutaDeApi(url: string): string | null {
  let u: URL;
  let base: URL;
  try {
    base = new URL(environment.apiGateway);
    u = new URL(url, base);
  } catch {
    return null;
  }
  if (u.origin !== base.origin) return null;
  return u.pathname.startsWith('/api/v1/') ? u.pathname : null;
}

/**
 * Prefijos cuyo backend valida access tokens de Cognito (auth y catalog). carrito, orders,
 * notifications, recomendaciones y analytics solo aceptan tokens de Entra ID: su 401 ante una
 * sesión Cognito significa "este servicio no admite Cognito", no "la sesión venció".
 */
export const ENDPOINTS_CON_COGNITO: ReadonlyArray<EndpointKey> = ['auth', 'catalog'];

/** ¿El servicio de esta URL de {API_BASE} acepta tokens de Cognito? */
export function aceptaCognito(url: string): boolean {
  const path = rutaDeApi(url);
  if (!path) return false;
  return ENDPOINTS_CON_COGNITO.some((key) => {
    const prefix = environment.endpoints[key];
    return path === prefix || path.startsWith(`${prefix}/`);
  });
}

/** ¿Va dirigida la petición a la API propia? (solo entonces se adjuntan credenciales) */
export function esUrlDeApi(url: string): boolean {
  return rutaDeApi(url) !== null;
}

/** Scopes que corresponden a una URL de {API_BASE}, o null si no es de la API. */
export function scopesForUrl(url: string): string[] | null {
  const path = rutaDeApi(url);
  if (!path) return null;
  for (const [key, scope] of SCOPE_POR_ENDPOINT) {
    const prefix = environment.endpoints[key];
    if (path === prefix || path.startsWith(`${prefix}/`)) return [apiScope(scope)];
  }
  return null;
}
