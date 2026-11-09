import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EstadoPago, PagoResponse } from '../../../../core/models/pago.model';
import { PagoService } from '../../../../core/services/pago.service';

@Component({
  selector: 'app-resultado-pago',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="mx-auto max-w-xl px-4 py-12">
      @if (cargando()) {
        <div class="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <svg class="h-10 w-10 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <p class="mt-4 text-sm font-semibold text-slate-600">Consultando comprobante de pago...</p>
        </div>
      } @else if (pago()) {
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          
          <!-- ESTADO: AUTORIZADO -->
          @if (pago()?.estado === EstadoPago.AUTORIZADO) {
            <div class="text-center">
              <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 class="mt-4 text-2xl font-black text-slate-800">¡Pago Autorizado!</h1>
              <p class="mt-1 text-sm text-slate-500">
                Tu transacción fue procesada con éxito a través de Webpay Plus.
              </p>
            </div>

            <!-- Comprobante Digital -->
            <div class="mt-8 rounded-xl border border-slate-100 bg-slate-50 p-5 text-sm">
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Detalle del Comprobante</h2>
              <dl class="mt-3 space-y-2.5">
                <div class="flex justify-between">
                  <dt class="text-slate-500">Código de Autorización:</dt>
                  <dd class="font-mono font-bold text-slate-900">{{ pago()?.codigoAutorizacion || 'N/A' }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-slate-500">Monto Pagado:</dt>
                  <dd class="font-extrabold text-blue-600">{{ pago()?.monto | currency:'CLP':'symbol-narrow':'1.0-0' }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-slate-500">Tarjeta:</dt>
                  <dd class="font-medium text-slate-800">
                    {{ pago()?.tarjetaMarca }} •••• {{ pago()?.tarjetaUltimos4 }}
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-slate-500">Orden ID:</dt>
                  <dd class="font-mono text-xs text-slate-700 truncate max-w-[200px]">{{ pago()?.ordenId }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-slate-500">ID de Pago:</dt>
                  <dd class="font-mono text-xs text-slate-700 truncate max-w-[200px]">{{ pago()?.id }}</dd>
                </div>
                <div class="flex justify-between border-t border-slate-200/60 pt-2 text-xs">
                  <dt class="text-slate-400">Fecha y Hora:</dt>
                  <dd class="text-slate-600">{{ pago()?.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}</dd>
                </div>
              </dl>
            </div>

            <div class="mt-8 flex flex-col gap-3 sm:flex-row">
              <a routerLink="/catalog" class="flex-1 rounded-xl bg-blue-600 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-700">
                Seguir Comprando
              </a>
              <a [routerLink]="['/pago/historial', pago()?.ordenId]" class="flex-1 rounded-xl border border-slate-300 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                Ver Historial de la Orden
              </a>
            </div>
          }

          <!-- ESTADO: RECHAZADO -->
          @if (pago()?.estado === EstadoPago.RECHAZADO) {
            <div class="text-center">
              <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 class="mt-4 text-2xl font-black text-slate-800">Pago Rechazado</h1>
              <p class="mt-1 text-sm text-slate-500">
                {{ pago()?.mensajeRespuesta || 'La entidad emisora o Webpay ha rechazado la operación.' }}
              </p>
            </div>

            <div class="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 leading-relaxed">
              <p class="font-bold">Motivos comunes de rechazo:</p>
              <ul class="mt-1 list-disc list-inside space-y-1">
                <li>Fondos o cupo disponible insuficiente.</li>
                <li>Tarjeta bloqueada para transacciones online o vencida.</li>
                <li>Datos de seguridad (CVV o expiración) erróneos.</li>
              </ul>
            </div>

            <div class="mt-8 flex flex-col gap-3 sm:flex-row">
              <a [routerLink]="['/pago/checkout', pago()?.ordenId]" [queryParams]="{ monto: pago()?.monto }" class="flex-1 rounded-xl bg-blue-600 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-700">
                Reintentar con otra tarjeta
              </a>
              <a routerLink="/carrito" class="flex-1 rounded-xl border border-slate-300 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                Modificar Carrito
              </a>
            </div>
          }

          <!-- ESTADO: BLOQUEADO_FRAUDE -->
          @if (pago()?.estado === EstadoPago.BLOQUEADO_FRAUDE) {
            <div class="text-center">
              <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 class="mt-4 text-2xl font-black text-red-900">Operación Bloqueada por Seguridad</h1>
              <p class="mt-2 text-sm text-slate-600 leading-relaxed">
                El motor antifraude de la plataforma ha detectado múltiples intentos repetidos en un lapso de tiempo no permitido.
              </p>
            </div>

            <div class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900">
              <p class="font-bold">Aviso de Protección:</p>
              <p class="mt-1">
                Para proteger la integridad de la cuenta y prevenir cargos no autorizados, este medio de pago ha sido suspendido temporalmente.
                <span class="font-semibold block mt-1">Por favor NO reintente inmediatamente; espere unos minutos o póngase en contacto con soporte.</span>
              </p>
            </div>

            <div class="mt-8 flex justify-center">
              <a routerLink="/catalog" class="rounded-xl bg-slate-800 px-8 py-3 text-sm font-bold text-white transition hover:bg-slate-900">
                Ir a la Tienda
              </a>
            </div>
          }
        </div>
      } @else {
        <div class="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 class="text-xl font-bold text-slate-800">No se encontró información del pago</h2>
          <p class="mt-2 text-sm text-slate-500">Verifique el identificador de la orden o consulte el historial.</p>
          <a routerLink="/catalog" class="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700">
            Volver al Catálogo
          </a>
        </div>
      }
    </div>
  `,
})
export class ResultadoPagoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly pagoService = inject(PagoService);

  readonly EstadoPago = EstadoPago;
  readonly pago = signal<PagoResponse | null>(null);
  readonly cargando = signal<boolean>(true);

  ngOnInit(): void {
    const pagoId = this.route.snapshot.queryParamMap.get('pagoId');
    const ordenId = this.route.snapshot.queryParamMap.get('ordenId');

    if (pagoId) {
      this.pagoService.obtenerPagoPorId(pagoId).subscribe({
        next: (res) => {
          this.pago.set(res);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
        },
      });
    } else if (ordenId) {
      this.pagoService.obtenerPagosPorOrden(ordenId).subscribe({
        next: (list) => {
          if (list && list.length > 0) {
            this.pago.set(list[0]);
          }
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
        },
      });
    } else {
      this.cargando.set(false);
    }
  }
}
