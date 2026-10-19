export const environment = {
  production: true,

  frontendGateway: 'https://o75p4wmtm0.execute-api.us-east-1.amazonaws.com',
  apiGateway: 'https://xz8yr05wy8.execute-api.us-east-1.amazonaws.com',
  backendGateway: 'https://xz8yr05wy8.execute-api.us-east-1.amazonaws.com',

  endpoints: {
    catalog: '/api/v1/catalog',
    cart: '/api/v1/carrito',
    auth: '/api/v1/auth',
    orders: '/api/v1/orders',
    notifications: '/api/v1/notifications',
    recommendation: '/api/v1/recommendation',
    cognitoLogin: '/api/v1/auth/cognito/login',
    cognitoRegister: '/api/v1/auth/cognito/register',
  },

  azure: {
    clientId: '719c999d-0f57-4ad5-9bd9-a72be5ca07e0',
    authority: 'https://login.microsoftonline.com/e5372bf0-c5e3-4286-887c-79069f209c1f',
    redirectUri: 'https://o75p4wmtm0.execute-api.us-east-1.amazonaws.com/auth/microsoft/callback',
    scopes: [
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Profile.Read',
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Catalog.Read',
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Checkout.Create',
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Orders.Read',
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Notifications.Send',
    ],
  },

  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_C5yZ5ikJP',
    clientId: '38bhbobrlmd1nui5l814bk6i6j',
    domain: 'https://camisetas360-auth-benja.auth.us-east-1.amazoncognito.com',
    redirectUri: 'https://o75p4wmtm0.execute-api.us-east-1.amazonaws.com/auth/cognito/callback',
    logoutUri: 'https://o75p4wmtm0.execute-api.us-east-1.amazonaws.com/',
    scopes: ['openid', 'email', 'profile'],
  },
};

