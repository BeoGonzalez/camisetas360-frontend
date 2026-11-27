import { ENV, ORIGIN, azure, endpoints, ordersPolling, pagos, ws } from './shared';

/**
 * Producción: todo pasa por el API Gateway HTTP (NG_APP_API_BASE_URL), que maneja CORS.
 * Tiempo real por API Gateway WebSocket (NG_APP_TELEMETRIA_WS_URL); sin URL, polling cada 5 s.
 */
export const environment = {
  production: true,

  frontendGateway: ORIGIN,
  apiGateway: ENV.apiBaseUrl || ORIGIN,

  endpoints,

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
