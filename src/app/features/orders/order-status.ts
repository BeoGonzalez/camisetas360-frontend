import { OrderStatus } from '../../core/models/order-response.model';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  CREATED: 'Creado',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
  REJECTED: 'Rechazado',
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CREATED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-slate-200 text-slate-700',
  REJECTED: 'bg-red-100 text-red-800',
};
