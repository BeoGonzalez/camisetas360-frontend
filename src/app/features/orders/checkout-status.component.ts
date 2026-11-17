import { ClpPipe } from '../../shared/pipes/clp.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';
import { CheckoutTrackerService } from '../../core/services/checkout-tracker.service';

/**
 * Estado de una compra tras el checkout (202 PROCESSING).
 * Muestra el polling sobre GET /orders y permite pagar con el ordenId configurado (SUPUESTO).
 */
@Component({
  selector: 'app-checkout-status',
  standalone: true,
  imports: [ClpPipe, RouterLink],
  template: `
    <div class="mx-auto max-w-xl">
      @if (compra(); as c) {
        <div class="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <h1 class="text-2xl font-extrabold text-slate-800">¡Pedido recibido!</h1>
          <p class="mt-2 text-sm text-slate-500">
            Total a pagar:
            <strong class="text-slate-800">{{ c.montoPago | clp }}</strong>
          </p>

          <div
            class="mt-6 rounded-xl p-4 text-sm"
            role="status"
            aria-live="polite"
            [class]="
              c.estado === 'ENCONTRADO'
                ? 'bg-emerald-50 text-emerald-800'
                : c.estado === 'BUSCANDO'
                  ? 'bg-blue-50 text-blue-800'
                  : 'bg-amber-50 text-amber-900'
            "
          >
            @switch (c.estado) {
              @case ('BUSCANDO') {
                Estamos creando tu pedido. Esto puede tardar unos segundos…
              }
              @case ('ENCONTRADO') {
                Tu pedido <strong>#{{ c.orderId }}</strong> fue creado.
              }
              @case ('NO_ENCONTRADO') {
                El pedido aún no aparece. Puede tardar un poco más.
                <button type="button" (click)="retomar()" class="ml-1 font-semibold underline">
                  Volver a consultar
                </button>
              }
              @case ('ERROR') {
                No pudimos consultar tus pedidos.
                <button type="button" (click)="retomar()" class="ml-1 font-semibold underline">
                  Reintentar
                </button>
              }
            }
          </div>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              [routerLink]="['/pago/checkout', ordenIdPago()]"
              class="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >Pagar ahora</a
            >
            @if (c.orderId) {
              <a
                [routerLink]="['/pedidos', c.orderId]"
                class="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >Ver pedido</a
              >
            } @else {
              <a
                routerLink="/pedidos"
                class="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >Mis pedidos</a
              >
            }
          </div>
        </div>
      } @else {
        <div class="rounded-2xl border border-slate-200 bg-white p-8 text-center" role="alert">
          <h1 class="text-xl font-bold text-slate-800">Compra no encontrada</h1>
          <p class="mt-2 text-sm text-slate-500">
            Esta compra no se registró en este navegador. Revisa tus pedidos.
          </p>
          <a
            routerLink="/pedidos"
            class="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white"
            >Mis pedidos</a
          >
        </div>
      }
    </div>
  `,
})
export class CheckoutStatusComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tracker = inject(CheckoutTrackerService);

  readonly requestId = signal(this.route.snapshot.paramMap.get('requestId') ?? '');
  readonly compra = computed(() => this.tracker.porRequestId(this.requestId()));
  readonly ordenIdPago = computed(() => {
    const c = this.compra();
    return c ? CheckoutTrackerService.ordenIdParaPago(c) : '';
  });

  ngOnInit(): void {
    // Tras recargar la página el polling en memoria se perdió: se reanuda.
    const c = this.compra();
    if (c?.estado === 'BUSCANDO') this.tracker.retomar(c.requestId);
  }

  retomar(): void {
    this.tracker.retomar(this.requestId());
  }
}
