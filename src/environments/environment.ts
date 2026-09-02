export const environment = {
  production: false,
  azure: {
    clientId: 'TU_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/TU_TENANT_ID',
    redirectUri: 'http://localhost:4200/',
    scopes: ['api://TU_CLIENT_ID/Cart.Write', 'User.Read']
  },
  apiGateway: 'https://tu-api-gateway.execute-api.us-east-1.amazonaws.com'
};