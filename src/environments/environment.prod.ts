/**
 * Configuración del entorno de producción.
 *
 * Reemplazar las URLs y credenciales con los valores reales
 * antes de desplegar a producción.
 */
export const environment = {
  production: true,

  /** URL base del API Gateway de producción (AWS) */
  apiGateway: 'https://4ohe7l86rh.execute-api.us-east-1.amazonaws.com',

  /** Endpoints por microservicio (relativos al apiGateway) */
  endpoints: {
    catalog: '/api/v1/catalog',
    cart: '/api/v1/carrito',
    auth: '/api/v1/auth',
  },

  /** Configuración de Azure Entra ID (OAuth2) para producción */
  azure: {
    clientId: '719c999d-0f57-4ad5-9bd9-a72be5ca07e0',
    
    authority: 'https://login.microsoftonline.com/e5372bf0-c5e3-4286-887c-79069f209c1f',
    
    // URL de redirección en la instancia web pública (con HTTPS Auto-firmado)
    redirectUri: 'https://100.49.172.129/',
    
    scopes: ['api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Autenticacion.Microsoft'],
  },
};
