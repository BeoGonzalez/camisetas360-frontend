import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../auth/services/auth.service';
import { SendEmailRequest } from '../../core/models/notification.model';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm transition-opacity"
      (click)="onBackdropClick($event)"
    >
      <div
        class="flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform animate-slide-left sm:max-w-lg"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 p-6">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-bold text-slate-800">Centro de Notificaciones</h2>
              <p class="text-xs text-slate-500">Microservicio Notifications</p>
            </div>
          </div>
          <button
            (click)="close.emit()"
            class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar panel"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Navigation Tabs if Admin -->
        @if (authService.isAdmin()) {
          <div class="flex border-b border-slate-100 bg-slate-50 px-6 text-sm font-medium">
            <button
              (click)="activeTab.set('info')"
              [class]="activeTab() === 'info'
                ? 'border-b-2 border-blue-600 text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800'"
              class="px-4 py-3 transition"
            >
              Canal de Usuario
            </button>
            <button
              (click)="activeTab.set('admin-send')"
              [class]="activeTab() === 'admin-send'
                ? 'border-b-2 border-blue-600 text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800'"
              class="flex items-center gap-1.5 px-4 py-3 transition"
            >
              <span>Despachar Correo</span>
              <span class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">ADMIN</span>
            </button>
          </div>
        }

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- User Channel Info Tab -->
          @if (activeTab() === 'info') {
            <div class="space-y-6">
              <!-- Channel Status Banner -->
              <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div class="flex items-start gap-3">
                  <div class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-emerald-900">Canal de Notificaciones Operativo</h3>
                    <p class="mt-1 text-xs text-emerald-700 leading-relaxed">
                      El sistema despacha notificaciones automáticas mediante eventos
                      <span class="font-mono font-semibold">order.created</span> en RabbitMQ hacia el microservicio
                      <span class="font-semibold">notifications</span>.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Recipient Card -->
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Destinatario configurado</p>
                <p class="mt-1.5 font-medium text-slate-800">
                  {{ authService.userEmail() || 'Sesión no iniciada' }}
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  Las confirmaciones de compra se remitirán a esta casilla vía SMTP.
                </p>
              </div>

              <!-- Architecture Details -->
              <div class="space-y-3">
                <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">Flujo de Eventos</h4>
                <div class="rounded-xl border border-slate-200 p-4 space-y-3 text-xs text-slate-600">
                  <div class="flex items-start gap-3">
                    <span class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-600">1</span>
                    <p><strong class="text-slate-800">Checkout en Carrito:</strong> Emite evento de orden creada.</p>
                  </div>
                  <div class="flex items-start gap-3">
                    <span class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-600">2</span>
                    <p><strong class="text-slate-800">RabbitMQ Exchange:</strong> Cola <code class="font-mono text-blue-600">notifications.order-created.q</code>.</p>
                  </div>
                  <div class="flex items-start gap-3">
                    <span class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-600">3</span>
                    <p><strong class="text-slate-800">Despacho SMTP:</strong> Envío de correo y persistencia en tabla <code class="font-mono text-blue-600">email_deliveries</code>.</p>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Admin Send Email Tab -->
          @if (activeTab() === 'admin-send' && authService.isAdmin()) {
            <form (ngSubmit)="sendAdminEmail()" class="space-y-4">
              <div class="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                Operación restringida: Requiere rol <strong>ADMIN</strong> y scope <strong>Notifications.Send</strong>.
              </div>

              @if (notificationService.lastSuccess()) {
                <div class="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
                  ¡Correo despachado con éxito a <strong>{{ notificationService.lastSuccess()?.to }}</strong>!
                </div>
              }

              @if (notificationService.lastError()) {
                <div class="rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                  {{ notificationService.lastError() }}
                </div>
              }

              <div>
                <label class="block text-xs font-semibold text-slate-700">Destinatario (Email)</label>
                <input
                  type="email"
                  [(ngModel)]="emailTo"
                  name="emailTo"
                  required
                  placeholder="cliente@ejemplo.com"
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700">Asunto</label>
                <input
                  type="text"
                  [(ngModel)]="emailSubject"
                  name="emailSubject"
                  required
                  placeholder="Confirmación de pedido especial"
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700">Cuerpo del mensaje</label>
                <textarea
                  [(ngModel)]="emailBody"
                  name="emailBody"
                  required
                  rows="4"
                  placeholder="Escribe el contenido de la notificación..."
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                ></textarea>
              </div>

              <button
                type="submit"
                [disabled]="notificationService.sending() || !emailTo || !emailSubject || !emailBody"
                class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
              >
                @if (notificationService.sending()) {
                  <span class="animate-spin text-sm">↻</span>
                  <span>Enviando notificación...</span>
                } @else {
                  <span>Enviar Notificación</span>
                }
              </button>
            </form>
          }
        </div>
      </div>
    </div>
  `,
})
export class NotificationCenterComponent {
  readonly notificationService = inject(NotificationService);
  readonly authService = inject(AuthService);

  @Output() close = new EventEmitter<void>();

  readonly activeTab = signal<'info' | 'admin-send'>('info');

  emailTo = '';
  emailSubject = '';
  emailBody = '';

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.close.emit();
    }
  }

  sendAdminEmail(): void {
    if (!this.emailTo || !this.emailSubject || !this.emailBody) {
      return;
    }

    const req: SendEmailRequest = {
      to: this.emailTo,
      subject: this.emailSubject,
      body: this.emailBody,
    };

    this.notificationService.sendEmail(req).subscribe({
      next: () => {
        this.emailSubject = '';
        this.emailBody = '';
      },
    });
  }
}

