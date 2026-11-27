import { ENV, ORIGIN, azure, endpoints, ordersPolling, pagos, ws } from './shared';

/**
 * Desarrollo contra AWS (pnpm start). {API_BASE} = NG_APP_API_BASE_URL (API Gateway HTTP);
 * si está vacío se usa el mismo origen. El Gateway HTTP no hace proxy de STOMP: el tiempo real
 * usa la telemetría de API Gateway WebSocket (NG_APP_TELEMETRIA_WS_URL) o polling.
 */
export const environment = {
  production: false,

  frontendGateway: ORIGIN,
  apiGateway: ENV.apiBaseUrl || ORIGIN,

  endpoints,

  /** STOMP solo existe en local (docker compose); vacío = no se intenta. */
  wsBase: '',
  telemetriaWsUrl: ENV.telemetriaWsUrl,
  ws,

  ordersPolling,
  pagos,
  azure,

  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_SmfKHFzMK',
    clientId: '12dth99ppcslnukovavrpvg6pb',
    domain: 'https://camisetas360-471112640065.auth.us-east-1.amazoncognito.com',
    redirectUri: `${ORIGIN}/auth/cognito/callback`,
    logoutUri: `${ORIGIN}/`,
    scopes: ['openid', 'email', 'profile'],
  },
};
