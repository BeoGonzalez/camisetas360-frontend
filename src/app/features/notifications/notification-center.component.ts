import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { SendEmailRequest } from '../../core/models/notification.model';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: { '(document:keydown.escape)': 'close.emit()' },
  template: `
    <div
      class="fixed inset-0 z-[70] flex justify-end bg-ink/50 transition-opacity"
      (click)="onBackdropClick($event)"
    >
      <div
        class="flex h-full w-full max-w-md flex-col border-l border-ink bg-paper animate-slide-left sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nc-titulo"
      >
        <!-- Header -->
        <div class="flex items-start justify-between gap-4 border-b border-ink px-6 py-5">
          <div class="min-w-0">
            <p class="album-caps text-[10px] text-slate-600">Microservicio Notifications</p>
            <h2 id="nc-titulo" class="album-display mt-1 text-[26px]">Centro de Notificaciones</h2>
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="shrink-0 p-2 text-ink transition-colors hover:bg-paper-2"
            aria-label="Cerrar panel"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Navigation Tabs if Admin -->
        @if (authService.isAdmin()) {
          <div
            class="flex gap-5 overflow-x-auto whitespace-nowrap border-b border-rule px-6"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'info'"
              (click)="activeTab.set('info')"
              class="album-caps -mb-px border-b-2 py-3 text-[10px] transition-colors"
              [class]="
                activeTab() === 'info'
                  ? 'border-pitch text-pitch'
                  : 'border-transparent text-slate-600 hover:text-ink'
              "
            >
              Canal de Usuario
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'admin-send'"
              (click)="activeTab.set('admin-send')"
              class="album-caps -mb-px flex items-center gap-2 border-b-2 py-3 text-[10px] transition-colors"
              [class]="
                activeTab() === 'admin-send'
                  ? 'border-pitch text-pitch'
                  : 'border-transparent text-slate-600 hover:text-ink'
              "
            >
              <span>Despachar Correo</span>
              <span class="hidden border border-current px-1 py-px text-[9px] sm:inline"
                >ADMIN</span
              >
            </button>
          </div>
        }

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- User Channel Info Tab -->
          @if (activeTab() === 'info') {
            <div class="space-y-8">
              <!-- Estado del canal -->
              <div class="border-l-2 border-pitch pl-4">
                <h3 class="flex items-center gap-2 text-sm font-semibold text-pitch">
                  <span class="h-2 w-2 bg-pitch" aria-hidden="true"></span>
                  Canal de Notificaciones Operativo
                </h3>
                <p class="mt-2 text-sm leading-relaxed text-slate-700">
                  El sistema despacha notificaciones automáticas mediante eventos
                  <code class="font-mono text-[13px] text-ink">order.created</code> en RabbitMQ
                  hacia el microservicio <span class="font-semibold">notifications</span>.
                </p>
              </div>

              <!-- Destinatario -->
              <div class="border-t border-ink pt-4">
                <p class="album-caps text-[10px] text-slate-600">Destinatario configurado</p>
                <p class="mt-2 font-semibold [overflow-wrap:anywhere]">
                  {{ authService.userEmail() || 'Sesión no iniciada' }}
                </p>
                <p class="mt-1 text-sm text-slate-600">
                  Las confirmaciones de compra se remitirán a esta casilla vía SMTP.
                </p>
              </div>

              <!-- Flujo -->
              <div class="border-t border-ink pt-4">
                <h4 class="album-caps text-[10px] text-slate-600">Flujo de eventos</h4>
                <ol class="mt-3 text-sm text-slate-700">
                  <li class="flex gap-4 border-b border-rule py-3">
                    <span class="tnum font-bold text-pitch">01</span>
                    <p>
                      <strong class="text-ink">Checkout en carrito:</strong> emite el evento de
                      orden creada.
                    </p>
                  </li>
                  <li class="flex gap-4 border-b border-rule py-3">
                    <span class="tnum font-bold text-pitch">02</span>
                    <p class="min-w-0 [overflow-wrap:anywhere]">
                      <strong class="text-ink">RabbitMQ:</strong> cola
                      <code class="font-mono text-[13px] text-ink"
                        >notifications.order-created.q</code
                      >.
                    </p>
                  </li>
                  <li class="flex gap-4 border-b border-rule py-3">
                    <span class="tnum font-bold text-pitch">03</span>
                    <p class="min-w-0">
                      <strong class="text-ink">Despacho SMTP:</strong> envío del correo y registro
                      en <code class="font-mono text-[13px] text-ink">email_deliveries</code>.
                    </p>
                  </li>
                </ol>
              </div>
            </div>
          }

          <!-- Admin Send Email Tab -->
          @if (activeTab() === 'admin-send' && authService.isAdmin()) {
            <form (ngSubmit)="sendAdminEmail()" class="space-y-5">
              <p class="border-l-2 border-ink pl-4 text-sm text-slate-700">
                Operación restringida: requiere rol <strong>ADMIN</strong> y scope
                <strong>Notifications.Send</strong>.
              </p>

              @if (notificationService.lastSuccess()) {
                <p role="status" class="border border-pitch px-4 py-3 text-sm text-pitch">
                  Correo despachado a
                  <strong>{{ notificationService.lastSuccess()?.['to'] ?? emailTo }}</strong
                  >.
                </p>
              }

              @if (notificationService.lastError()) {
                <p role="alert" class="border border-red-700 px-4 py-3 text-sm text-red-800">
                  {{ notificationService.lastError() }}
                </p>
              }

              <div>
                <label for="nc-emailTo" class="album-caps block text-[10px] text-slate-700"
                  >Destinatario (Email)</label
                >
                <input
                  type="email"
                  [(ngModel)]="emailTo"
                  name="emailTo"
                  id="nc-emailTo"
                  required
                  placeholder="cliente@ejemplo.com"
                  class="mt-2 w-full border border-ink bg-transparent px-3 py-2.5 text-base focus:border-pitch focus:outline-none focus:ring-0"
                />
              </div>

              <div>
                <label for="nc-emailSubject" class="album-caps block text-[10px] text-slate-700"
                  >Asunto</label
                >
                <input
                  type="text"
                  [(ngModel)]="emailSubject"
                  name="emailSubject"
                  id="nc-emailSubject"
                  required
                  placeholder="Confirmación de pedido especial"
                  class="mt-2 w-full border border-ink bg-transparent px-3 py-2.5 text-base focus:border-pitch focus:outline-none focus:ring-0"
                />
              </div>

              <div>
                <label for="nc-emailBody" class="album-caps block text-[10px] text-slate-700"
                  >Cuerpo del mensaje</label
                >
                <textarea
                  [(ngModel)]="emailBody"
                  name="emailBody"
                  id="nc-emailBody"
                  required
                  rows="4"
                  placeholder="Escribe el contenido de la notificación..."
                  class="mt-2 w-full border border-ink bg-transparent px-3 py-2.5 text-base focus:border-pitch focus:outline-none focus:ring-0"
                ></textarea>
              </div>

              <button
                type="submit"
                [disabled]="
                  notificationService.sending() || !emailTo || !emailSubject || !emailBody
                "
                class="album-caps flex w-full items-center justify-center gap-2 bg-ink py-4 text-[11px] text-paper transition-colors hover:bg-pitch disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                @if (notificationService.sending()) {
                  <span class="animate-spin" aria-hidden="true">↻</span>
                  <span>Enviando…</span>
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
