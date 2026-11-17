import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS,
} from '@angular/common/http';
import { unauthorizedInterceptor } from './core/http/unauthorized.interceptor';

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
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { MsalUnlessAuthorizedInterceptor } from './core/interceptors/msal-unless-authorized.interceptor';
import { SCOPE_POR_ENDPOINT, apiScope } from './core/auth/api-scopes';

export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string> | null>();

  // MsalInterceptor pide el token de cada prefijo con acquireTokenSilent y, ante
  // InteractionRequiredAuthError, cae a acquireTokenRedirect (interactionType: Redirect).
  // Se registra el prefijo exacto (GET /carrito, GET /orders) y el comodín para subrutas.
  for (const [key, scope] of SCOPE_POR_ENDPOINT) {
    const base = `${environment.apiGateway}${environment.endpoints[key]}`;
    protectedResourceMap.set(base, [apiScope(scope)]);
    protectedResourceMap.set(`${base}/*`, [apiScope(scope)]);
  }

  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap,
  };
}

/**
 * Inicializa MSAL antes de que arranque la aplicación.
 */
export function MSALInitializerFactory(msalService: MsalService) {
  return async () => {
    await msalService.instance.initialize();

    const response = await msalService.instance.handleRedirectPromise();

    if (response?.account) {
      msalService.instance.setActiveAccount(response.account);
      return;
    }

    /*
     * Si recargamos la página y ya existe una cuenta
     * almacenada, la dejamos como activa.
     */
    const activeAccount = msalService.instance.getActiveAccount();

    if (!activeAccount) {
      const accounts = msalService.instance.getAllAccounts();

      if (accounts.length > 0) {
        msalService.instance.setActiveAccount(accounts[0]);
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
    provideHttpClient(withInterceptors([unauthorizedInterceptor]), withInterceptorsFromDi()),

    /*
     * Camisetas360 Auth interceptor (Cognito / API Gateway).
     */
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },

    /*
     * MSAL HTTP interceptor (se omite si la petición ya trae el Bearer de Cognito).
     */
    MsalInterceptor,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalUnlessAuthorizedInterceptor,
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
