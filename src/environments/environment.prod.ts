/**
 * Configuración del entorno de producción.
 *
 * Reemplazar las URLs y credenciales con los valores reales
 * antes de desplegar a producción.
 */
export const environment = {
  production: true,

  /** URL base del API Gateway de producción (AWS) */
  apiGateway: 'https://nkkc0jiwzk.execute-api.us-east-1.amazonaws.com',

  /** Endpoints por microservicio (relativos al apiGateway) */
  endpoints: {
    catalog: '/api/v1/catalog',
    cart: '/api/v1/carrito',
    auth: '/api/v1/auth',
  },

  /** Configuración de Azure Entra ID (OAuth2) para producción */
  azure: {
    clientId: 'd01187f9-5a24-42b4-bcdb-4a35742a1399',
    
    authority: 'https://login.microsoftonline.com/e5372bf0-c5e3-4286-887c-79069f209c1f',
    
    // URL de redirección en la instancia web pública
    redirectUri: 'http://44.200.56.103:4200/',
    
    scopes: ['api://d01187f9-5a24-42b4-bcdb-4a35742a1399/Backend.Access'],
  },
};
