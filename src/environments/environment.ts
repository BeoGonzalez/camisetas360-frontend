/**
 * Configuración del entorno de desarrollo.
 *
 * Los endpoints están preparados para apuntar a un AWS API Gateway
 * que enruta a los microservicios correspondientes.
 */
export const environment = {
  production: false,

  /** URL base del API Gateway (AWS) */
  apiGateway: 'https://tu-api-gateway.execute-api.us-east-1.amazonaws.com',

  /** Endpoints por microservicio (relativos al apiGateway) */
  endpoints: {
    catalog: '/api/v1/catalogo',
    cart: '/api/v1/carrito',
    auth: '/api/v1/auth',
  },

  /** Configuración de Azure Entra ID (OAuth2) */
  azure: {
    clientId: 'TU_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/TU_TENANT_ID',
    redirectUri: 'http://localhost:4200/',
    scopes: ['api://TU_CLIENT_ID/Cart.Write', 'User.Read'],
  },
};