import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import {
  provideHttpClient,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS,
} from '@angular/common/http';

import { environment } from '../environments/environment';

import {
  MsalInterceptor,
  MsalGuard,
  MsalService,
  MsalBroadcastService,
  MSAL_INSTANCE,
  MSAL_GUARD_CONFIG,
  MSAL_INTERCEPTOR_CONFIG,
  MsalGuardConfiguration,
  MsalInterceptorConfiguration,
} from '@azure/msal-angular';

import {
  PublicClientApplication,
  BrowserCacheLocation,
  InteractionType,
} from '@azure/msal-browser';

/**
 * Crea la instancia principal de MSAL.
 */
export function MSALInstanceFactory(): PublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: environment.azure.clientId,
      authority: environment.azure.authority,
      redirectUri: environment.azure.redirectUri,
    },

    cache: {
      cacheLocation: BrowserCacheLocation.LocalStorage,
    },
  });
}

/**
 * Configuración de rutas protegidas mediante MsalGuard.
 */
export function MSALGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,

    authRequest: {
      scopes: environment.azure.scopes,
    },
  };
}

/**
 * Configura qué scope corresponde a cada API.
 *
 * MSAL obtiene el access token apropiado y añade:
 *
 * Authorization: Bearer <token>
 */
export function MSALInterceptorConfigFactory():
  MsalInterceptorConfiguration {

  const protectedResourceMap =
    new Map<string, Array<string> | null>();

  const apiScope =
    'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0';

  /*
   * Perfil autenticado
   *
   * GET /api/v1/auth/profile
   */
  protectedResourceMap.set(
    `${environment.apiGateway}${environment.endpoints.auth}/*`,
    [
      `${apiScope}/Profile.Read`,
    ]
  );

  /*
   * Catálogo
   *
   * GET /api/v1/catalog/products
   */
  protectedResourceMap.set(
    `${environment.apiGateway}${environment.endpoints.catalog}/*`,
    [
      `${apiScope}/Catalog.Read`,
    ]
  );

  /*
   * Checkout
   *
   * POST /api/v1/carrito/checkout
   */
  protectedResourceMap.set(
    `${environment.apiGateway}${environment.endpoints.cart}/*`,
    [
      `${apiScope}/Checkout.Create`,
    ]
  );

  /*
   * Órdenes
   *
   * GET /api/v1/orders
   * GET /api/v1/orders/{id}
   */
  protectedResourceMap.set(
    `${environment.apiGateway}${environment.endpoints.orders}/*`,
    [
      `${apiScope}/Orders.Read`,
    ]
  );

  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap,
  };
}

/**
 * Inicializa MSAL antes de que arranque la aplicación.
 */
export function MSALInitializerFactory(
  msalService: MsalService
) {
  return async () => {

    await msalService.instance.initialize();

    const response =
      await msalService.instance.handleRedirectPromise();

    if (response?.account) {
      msalService.instance.setActiveAccount(
        response.account
      );
      return;
    }

    /*
     * Si recargamos la página y ya existe una cuenta
     * almacenada, la dejamos como activa.
     */
    const activeAccount =
      msalService.instance.getActiveAccount();

    if (!activeAccount) {

      const accounts =
        msalService.instance.getAllAccounts();

      if (accounts.length > 0) {
        msalService.instance.setActiveAccount(
          accounts[0]
        );
      }
    }
  };
}

/**
 * Configuración principal de Angular.
 */
export const appConfig: ApplicationConfig = {

  providers: [

    provideRouter(routes),

    /*
     * Importante:
     *
     * Ya NO usamos jwtInterceptor.
     *
     * MSALInterceptor es el único encargado
     * de añadir el Bearer Token.
     */
    provideHttpClient(
      withInterceptorsFromDi()
    ),

    /*
     * MSAL HTTP interceptor.
     */
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalInterceptor,
      multi: true,
    },

    /*
     * MSAL instance.
     */
    {
      provide: MSAL_INSTANCE,
      useFactory: MSALInstanceFactory,
    },

    /*
     * MSAL Guard.
     */
    {
      provide: MSAL_GUARD_CONFIG,
      useFactory: MSALGuardConfigFactory,
    },

    /*
     * MSAL HTTP resource mapping.
     */
    {
      provide: MSAL_INTERCEPTOR_CONFIG,
      useFactory: MSALInterceptorConfigFactory,
    },

    /*
     * Inicialización de MSAL.
     */
    {
      provide: APP_INITIALIZER,
      useFactory: MSALInitializerFactory,
      deps: [MsalService],
      multi: true,
    },

    MsalService,
    MsalGuard,
    MsalBroadcastService,
  ],
};