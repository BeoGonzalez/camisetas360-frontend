import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS,
} from '@angular/common/http';
import { environment } from '../environments/environment';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';

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
 * Factory que crea la instancia de PublicClientApplication para MSAL.
 * Configura el client ID, authority y redirect URI desde environment.
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
 * Factory que configura el guard de MSAL con interacción por redirección.
 */
export function MSALGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: { scopes: environment.azure.scopes },
  };
}

/**
 * Factory que configura el interceptor de MSAL con el mapa de recursos protegidos.
 * Cualquier petición al API Gateway recibirá automáticamente el token.
 */
export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string>>();
  protectedResourceMap.set(
    environment.apiGateway + '/*',
    environment.azure.scopes
  );
  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap,
  };
}

/**
 * Factory para inicializar MSAL v3.
 * Requiere llamar a initialize() y handleRedirectPromise() antes de usar la aplicación.
 */
export function MSALInitializerFactory(msalService: MsalService) {
  return async () => {
    await msalService.instance.initialize();
    const res = await msalService.instance.handleRedirectPromise();
    if (res?.account) {
      msalService.instance.setActiveAccount(res.account);
    }
  };
}

/**
 * Configuración principal de la aplicación Angular.
 *
 * Combina el interceptor JWT funcional (para inyectar Bearer Token)
 * con los providers de MSAL para la autenticación con Azure Entra ID.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // Registrar interceptor JWT funcional + interceptores legacy (MSAL) vía DI
    provideHttpClient(
      withInterceptors([jwtInterceptor]),
      withInterceptorsFromDi()
    ),
    // MSAL Providers
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalInterceptor,
      multi: true,
    },
    { provide: MSAL_INSTANCE, useFactory: MSALInstanceFactory },
    { provide: MSAL_GUARD_CONFIG, useFactory: MSALGuardConfigFactory },
    {
      provide: MSAL_INTERCEPTOR_CONFIG,
      useFactory: MSALInterceptorConfigFactory,
    },
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