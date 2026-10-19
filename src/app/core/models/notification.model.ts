/**
 * Contrato del microservicio Notifications (POST /api/v1/notifications/email)
 */
export interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailResponse {
  status: string; // "SENT"
  to: string;
}

/**
 * Información de entrega de notificaciones para el usuario
 */
export interface NotificationDeliveryInfo {
  recipient: string;
  channel: 'EMAIL';
  description: string;
  isAutomated: boolean;
}

