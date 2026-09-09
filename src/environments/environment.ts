/**
 * Configuración del entorno de desarrollo.
 *
 * Los endpoints están preparados para apuntar a un AWS API Gateway
 * que enruta a los microservicios correspondientes.
 */
export const environment = {
  production: false,

  /** URL base del API Gateway (AWS) */
  apiGateway: 'https://nkkc0jiwzk.execute-api.us-east-1.amazonaws.com',

  /** Endpoints por microservicio (relativos al apiGateway) */
  endpoints: {
    catalog: '/api/v1/catalog',
    cart: '/api/v1/carrito',
    auth: '/api/v1/auth',
  },

  /** Configuración de Azure Entra ID (OAuth2) */
  azure: {
    clientId: 'd01187f9-5a24-42b4-bcdb-4a35742a1399',
    
    authority: 'https://login.microsoftonline.com/e5372bf0-c5e3-4286-887c-79069f209c1f',
    redirectUri: 'http://100.49.172.129/',
    
    scopes: ['api://d01187f9-5a24-42b4-bcdb-4a35742a1399/Backend.Access'],
  },
};