export interface OrderItemResponse {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export type OrderStatus =
  | 'CREATED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED';

export interface OrderResponse {
  orderId: number;
  userEmail: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  items: OrderItemResponse[];
}