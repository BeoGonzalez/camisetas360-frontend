/**
 * Configuración del entorno de producción.
 *
 * Reemplazar las URLs y credenciales con los valores reales
 * antes de desplegar a producción.
 */
export const environment = {
  production: true,

  /** URL base del API Gateway de producción (AWS) */
  apiGateway: 'https://api.camisetas360.com',

  /** Endpoints por microservicio (relativos al apiGateway) */
  endpoints: {
    catalog: '/api/v1/catalogo',
    cart: '/api/v1/carrito',
    auth: '/api/v1/auth',
  },

  /** Configuración de Azure Entra ID (OAuth2) para producción */
  azure: {
    clientId: 'PROD_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/PROD_TENANT_ID',
    redirectUri: 'https://camisetas360.com/',
    scopes: ['api://PROD_CLIENT_ID/Cart.Write', 'User.Read'],
  },
};
