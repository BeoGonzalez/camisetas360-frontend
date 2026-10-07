export const environment = {
  production: false,

  // ==========================================
  // AWS API GATEWAY BACKEND
  // ==========================================

  backendGateway:
    'https://URL-DEL-API-GATEWAY-BACKEND',

  endpoints: {
    catalog: '/api/v1/catalog',
    cart: '/api/v1/carrito',
    auth: '/api/v1/auth',
    orders: '/api/v1/orders',
  },

  // ==========================================
  // MICROSOFT ENTRA ID
  // ==========================================

  azure: {
    clientId:
      '719c999d-0f57-4ad5-9bd9-a72be5ca07e0',

    authority:
      'https://login.microsoftonline.com/e5372bf0-c5e3-4286-887c-79069f209c1f',

    redirectUri:
      'http://localhost:4200/auth/microsoft/callback',

    scopes: [
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Profile.Read',
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Catalog.Read',
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Checkout.Create',
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Orders.Read',
    ],
  },

  // ==========================================
  // AMAZON COGNITO
  // ==========================================

  cognito: {
    region: 'us-east-1',

    userPoolId:
      'PENDIENTE',

    clientId:
      'PENDIENTE',

    domain:
      'https://PENDIENTE.auth.us-east-1.amazoncognito.com',

    redirectUri:
      'http://localhost:4200/auth/cognito/callback',

    logoutUri:
      'http://localhost:4200/',

    scopes: [
      'openid',
      'email',
      'profile',
    ],
  },
};