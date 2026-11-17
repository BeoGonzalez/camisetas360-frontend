/** Datos de prueba compartidos por los e2e herméticos (contratos tal cual el backend). */
export const REQ = '44444444-4444-4444-8444-444444444444';
export const COMPRAS_JSON = JSON.stringify([
  {
    requestId: REQ,
    totalAmount: 79980,
    montoPago: 83970,
    createdAt: '2026-11-10T10:00:00Z',
    estado: 'ENCONTRADO',
    orderId: 7,
  },
]);

export const products = [
  {
    sku: 'CAM-001',
    name: 'Camiseta Titular 2026 Edición Oficial de Local',
    category: 'Fútbol',
    price: 39990,
    stock: 100,
    description: 'Camiseta oficial de local para la temporada',
  },
  {
    sku: 'CAM-002',
    name: 'Camiseta Visitante 2026',
    category: 'Fútbol',
    price: 39990,
    stock: 0,
    description: 'Alternativa',
  },
];
export const cart = {
  items: [
    {
      sku: 'CAM-001',
      nombre: 'Camiseta Titular 2026 Edición Oficial de Local',
      categoria: 'Fútbol',
      precioUnitario: 39990,
      cantidad: 2,
      subtotal: 79980,
    },
  ],
  envio: { metodo: 'STANDARD', region: 'Metropolitana', comuna: 'Providencia', costo: 3990 },
  subtotal: 79980,
  costoEnvio: 3990,
  total: 83970,
};
export const order = {
  orderId: 7,
  userEmail: 'demo@camisetas360.test',
  totalAmount: 79980,
  status: 'CREATED',
  createdAt: '2026-11-10T10:00:05Z',
  items: [{ sku: 'CAM-001', quantity: 2, unitPrice: 39990 }],
};
export const metricas = {
  generadoEn: '2026-11-10T10:00:00Z',
  clicsUltimoMinuto: 37,
  usuariosActivos: 5,
  serieClics: Array.from({ length: 15 }, (_, i) => ({
    minuto: new Date(Date.UTC(2026, 10, 10, 9, 45 + i)).toISOString(),
    clics: (i * 7) % 23,
  })),
  productosMasVistos: [{ sku: 'CAM-001', nombre: 'Camiseta Titular 2026', vistas: 12 }],
  eventosPorTipo: { PRODUCTO_VISTO: 40, ITEM_AGREGADO: 9, ITEM_ELIMINADO: 2, ENVIO_ACTUALIZADO: 3 },
  alertas: [
    { tipo: 'FRAUDE', mensaje: 'Tarjeta ****4444 bloqueada', ocurridoEn: '2026-11-10T09:59:00Z' },
  ],
};

export const CARRITO_VACIO = { items: [], envio: null, subtotal: 0, costoEnvio: 0, total: 0 };
export const RECOS_VACIAS = { fuente: 'POPULARES', versionModelo: null, items: [] };
