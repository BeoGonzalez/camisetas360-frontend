/** Contrato del microservicio orders (/api/v1/orders). orderId es numérico (Long). */
export interface OrderItemResponse {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export type OrderStatus = 'PENDING' | 'CREATED' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED';

export interface OrderResponse {
  orderId: number;
  userEmail: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  items: OrderItemResponse[];
}
