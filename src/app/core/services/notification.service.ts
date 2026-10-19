import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SendEmailRequest,
  SendEmailResponse,
  NotificationDeliveryInfo,
} from '../models/notification.model';

/**
 * Servicio para interactuar con el microservicio de Notificaciones.
 *
 * El endpoint POST /api/v1/notifications/email está protegido con:
 * - Rol requerido: ROLE_ADMIN
 * - Scope requerido: SCOPE_Notifications.Send
 *
 * Para clientes regulares, las notificaciones se emiten automáticamente
 * vía RabbitMQ (evento order.created) y se despachan por SMTP.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.notifications}`;

  /** Estado reactivo para envíos */
  readonly sending = signal<boolean>(false);
  readonly lastError = signal<string | null>(null);
  readonly lastSuccess = signal<SendEmailResponse | null>(null);

  /**
   * Envía un correo mediante el endpoint administrativo del backend.
   * Requiere autorización ROLE_ADMIN y SCOPE_Notifications.Send.
   */
  sendEmail(request: SendEmailRequest): Observable<SendEmailResponse> {
    this.sending.set(true);
    this.lastError.set(null);

    return this.http
      .post<SendEmailResponse>(`${this.apiUrl}/email`, request)
      .pipe(
        tap((response) => {
          this.sending.set(false);
          this.lastSuccess.set(response);
        }),
        catchError((err: HttpErrorResponse) => {
          this.sending.set(false);
          const parsedMessage = this.handleHttpError(err);
          this.lastError.set(parsedMessage);
          return throwError(() => new Error(parsedMessage));
        })
      );
  }

  /**
   * Obtiene la información sobre el canal de notificaciones automáticas para el usuario.
   */
  getDeliveryChannelInfo(email: string): NotificationDeliveryInfo {
    return {
      recipient: email || 'No configurado',
      channel: 'EMAIL',
      description:
        'Las notificaciones de confirmación de órdenes se procesan de forma asíncrona mediante eventos RabbitMQ (order.created) y se envían a tu correo registrado.',
      isAutomated: true,
    };
  }

  /**
   * Limpia el estado de mensajes
   */
  clearState(): void {
    this.lastError.set(null);
    this.lastSuccess.set(null);
  }

  private handleHttpError(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'No autenticado. Por favor inicia sesión para gestionar notificaciones.';
    }
    if (error.status === 403) {
      return 'Acceso denegado. Se requiere el rol ADMIN y el scope Notifications.Send para enviar correos.';
    }
    if (error.status === 400) {
      return 'Datos de solicitud inválidos. Verifica que el correo, asunto y cuerpo sean válidos.';
    }
    return (
      error.error?.message ||
      'No se pudo conectar con el servicio de notificaciones. Inténtalo más tarde.'
    );
  }
}

