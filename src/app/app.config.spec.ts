import { describe, it, expect } from 'vitest';
import { MSALInterceptorConfigFactory } from './app.config';
import { environment } from '../environments/environment';
import { scopesForUrl } from './core/auth/api-scopes';

describe('MSALInterceptorConfigFactory (scopes por endpoint)', () => {
  const map = MSALInterceptorConfigFactory().protectedResourceMap;
  const scope = (s: string) => [`${environment.azure.apiScope}/${s}`];
  const key = (prefix: string) => `${environment.apiGateway}${prefix}/*`;

  it.each([
    ['/api/v1/auth', 'Profile.Read'],
    ['/api/v1/catalog', 'Catalog.Read'],
    ['/api/v1/carrito', 'Checkout.Create'],
    ['/api/v1/orders', 'Orders.Read'],
    ['/api/v1/notifications', 'Notifications.Send'],
    ['/api/v1/recomendaciones', 'Catalog.Read'],
    ['/api/v1/analytics', 'Catalog.Read'],
    ['/api/v1/pago', 'Checkout.Create'],
  ])('%s pide %s (prefijo exacto y subrutas)', (prefix, s) => {
    expect(map.get(key(prefix))).toEqual(scope(s));
    expect(map.get(`${environment.apiGateway}${prefix}`)).toEqual(scope(s));
  });

  it('scopesForUrl resuelve el scope de cada URL de la API', () => {
    expect(scopesForUrl(`${environment.apiGateway}/api/v1/carrito`)).toEqual(
      scope('Checkout.Create'),
    );
    expect(scopesForUrl(`${environment.apiGateway}/api/v1/orders/7?x=1`)).toEqual(
      scope('Orders.Read'),
    );
    expect(scopesForUrl('https://otro.example/api/v1/orders')).toBeNull();
  });

  it('todas las entradas cuelgan de la única base {API_BASE}', () => {
    for (const k of map.keys()) expect(k.startsWith(environment.apiGateway)).toBe(true);
  });

  it('el login solicita los 5 scopes del contrato', () => {
    const names = environment.azure.scopes.map((s) => s.split('/').pop());
    expect(names).toEqual([
      'Profile.Read',
      'Catalog.Read',
      'Checkout.Create',
      'Orders.Read',
      'Notifications.Send',
    ]);
  });
});
