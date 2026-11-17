/** POST /api/v1/notifications/email (solo ADMIN + Notifications.Send). */
export interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
}

/** El backend responde un objeto con strings de confirmación. */
export type SendEmailResponse = Record<string, string>;

export interface NotificationDeliveryInfo {
  recipient: string;
  channel: 'EMAIL';
  description: string;
  isAutomated: boolean;
}
