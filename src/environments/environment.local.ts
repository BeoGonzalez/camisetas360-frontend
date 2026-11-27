import { ORIGIN, azure, endpoints, ordersPolling, pagos, ws } from './shared';

/**
 * Entorno local contra `docker compose up` del backend (pnpm start:local).
 * {API_BASE} es el propio dev server: proxy.conf.json enruta cada prefijo /api/v1/* y el
 * WebSocket /ws/metricas a su microservicio, así el navegador habla siempre con el mismo origen.
 */
export const environment = {
  production: false,

  frontendGateway: ORIGIN,
  apiGateway: ORIGIN,

  endpoints,

  /** STOMP vía el proxy del dev server (ws: true en proxy.conf.json). */
  wsBase: ORIGIN.replace(/^http/, 'ws'),
  /** En local no se usa la telemetría de AWS. */
  telemetriaWsUrl: '',
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
