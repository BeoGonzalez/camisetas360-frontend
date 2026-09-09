export interface OrderItemDTO {
  productId: string;
  quantity: number;
}

export interface OrderRequestDTO {
  items: OrderItemDTO[];
}

export interface OrderResponseDTO {
  orderId: string;
  status: string;
  totalAmount?: number;
  message?: string;
}
