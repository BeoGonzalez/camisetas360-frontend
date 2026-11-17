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
    userPoolId: 'us-east-1_jZ9MPGJGI',
    clientId: '7svd55500qfk2qu3bis91urtqv',
    domain: 'https://us-east-1jz9mpgjgi.auth.us-east-1.amazoncognito.com',
    redirectUri: 'https://bbsgv4efrd.execute-api.us-east-1.amazonaws.com/auth/cognito/callback',
    logoutUri: 'https://bbsgv4efrd.execute-api.us-east-1.amazonaws.com/',
    scopes: ['openid', 'email', 'profile'],
  },
};
