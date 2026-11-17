/** Contrato del microservicio carrito (/api/v1/carrito). Campos tal cual los devuelve el backend. */

export type MetodoEnvio = 'STANDARD' | 'EXPRESS' | 'RETIRO_TIENDA';

/** Costos informativos (el backend es la fuente de verdad: CartDTO.envio.costo). */
export const COSTOS_ENVIO: Record<MetodoEnvio, number> = {
  STANDARD: 3990,
  EXPRESS: 6990,
  RETIRO_TIENDA: 0,
};

export const CANTIDAD_MAXIMA_POR_SKU = 99;

export interface CartItemDTO {
  sku: string;
  nombre: string;
  categoria: string | null;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

export interface EnvioDTO {
  metodo: MetodoEnvio;
  region: string;
  comuna: string;
  costo: number;
}

export interface CartDTO {
  items: CartItemDTO[];
  envio: EnvioDTO | null;
  subtotal: number;
  costoEnvio: number;
  total: number;
}

/** POST /api/v1/carrito/items */
export interface AddCartItemRequest {
  sku: string;
  nombre: string;
  categoria?: string;
  precioUnitario: number;
  cantidad: number;
}

/** PUT /api/v1/carrito/envio */
export interface ShippingRequest {
  metodo: MetodoEnvio;
  region: string;
  comuna: string;
}

/** POST /api/v1/carrito/checkout */
export interface CheckoutRequest {
  items: { sku: string; quantity: number; unitPrice: number }[];
}

/** 202 de POST /api/v1/carrito/checkout. El pedido se crea después, de forma asíncrona. */
export interface CheckoutResponse {
  requestId: string;
  userEmail: string;
  totalAmount: number;
  status: 'PROCESSING';
}

export const CARRITO_VACIO: CartDTO = {
  items: [],
  envio: null,
  subtotal: 0,
  costoEnvio: 0,
  total: 0,
};
