export const environment = {
  production: true,

  frontendGateway: 'https://33tvg6ofya.execute-api.us-east-1.amazonaws.com',

  // Renombrado a apiGateway para que tus servicios de Angular no fallen en el build
  apiGateway: 'https://xz8yr05wy8.execute-api.us-east-1.amazonaws.com',

  endpoints: {
    catalog: '/api/v1/catalog',
    cart: '/api/v1/carrito',
    auth: '/api/v1/auth',
    orders: '/api/v1/orders',
    notifications: '/api/v1/notifications',
    recommendation: '/api/v1/recommendation'
  },

  azure: {
    clientId: '719c999d-0f57-4ad5-9bd9-a72be5ca07e0',
    authority: 'https://login.microsoftonline.com/e5372bf0-c5e3-4286-887c-79069f209c1f',
    redirectUri: 'https://33tvg6ofya.execute-api.us-east-1.amazonaws.com',
    scopes: [
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Profile.Read',
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Catalog.Read',
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Checkout.Create',
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Orders.Read',
      'api://719c999d-0f57-4ad5-9bd9-a72be5ca07e0/Notifications.Send',
    ],
  },
};
