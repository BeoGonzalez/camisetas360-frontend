import { ClpPipe } from '../../shared/pipes/clp.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrdersService } from '../../core/services/orders.service';
import { CheckoutTrackerService } from '../../core/services/checkout-tracker.service';
import { OrderResponse } from '../../core/models/order-response.model';
import { ApiError } from '../../core/http/api-error';
import { ApiErrorComponent } from '../../shared/components/api-error/api-error.component';
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from './order-status';

/** Detalle de pedido: GET /api/v1/orders/{orderId} (numérico; 404 si no existe o es ajeno). */
@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [ClpPipe, DatePipe, RouterLink, ApiErrorComponent],
  template: `
    <div class="mx-auto max-w-3xl">
      <a routerLink="/pedidos" class="text-sm font-medium text-blue-600 hover:underline"
        >&larr; Mis pedidos</a
      >

      @if (loading()) {
        <div
          class="mt-4 h-40 animate-pulse rounded-2xl border border-slate-200 bg-white"
          aria-busy="true"
        ></div>
      } @else if (error()) {
        <div class="mt-4">
          <app-api-error [error]="error()" title="No se pudo cargar el pedido" (retry)="load()" />
        </div>
      } @else if (order(); as o) {
        <article class="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <header class="flex flex-wrap items-center justify-between gap-2">
            <h1 class="text-2xl font-extrabold text-slate-800">Pedido #{{ o.orderId }}</h1>
            <span
              class="rounded-full px-3 py-1 text-xs font-bold"
              [class]="statusClass[o.status] ?? ''"
              >{{ statusLabel[o.status] ?? o.status }}</span
            >
          </header>
          <p class="mt-1 text-sm text-slate-500">
            {{ o.createdAt | date: 'dd/MM/yyyy HH:mm' }} · {{ o.userEmail }}
          </p>

          <div class="mt-5 overflow-x-auto">
            <table class="w-full text-left text-sm">
              <caption class="sr-only">
                Productos del pedido
              </caption>
              <thead class="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th scope="col" class="py-2">SKU</th>
                  <th scope="col" class="py-2 text-right">Cantidad</th>
                  <th scope="col" class="py-2 text-right">Precio</th>
                  <th scope="col" class="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (i of o.items; track i.sku) {
                  <tr>
                    <td class="py-2">
                      <a
                        [routerLink]="['/catalog', i.sku]"
                        class="font-medium text-blue-600 hover:underline"
                        >{{ i.sku }}</a
                      >
                    </td>
                    <td class="py-2 text-right">{{ i.quantity }}</td>
                    <td class="py-2 text-right">{{ i.unitPrice | clp }}</td>
                    <td class="py-2 text-right font-semibold">
                      {{ i.unitPrice * i.quantity | clp }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="mt-4 text-right text-lg font-extrabold text-slate-800">
            Total: {{ o.totalAmount | clp }}
          </p>

          <section class="mt-6 rounded-xl bg-slate-50 p-4 text-sm" aria-labelledby="pago-h">
            <h2 id="pago-h" class="font-bold text-slate-800">Pago</h2>
            @if (ordenIdPago(); as oid) {
              <div class="mt-2 flex flex-wrap gap-2">
                <a
                  [routerLink]="['/pago/checkout', oid]"
                  class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >Pagar</a
                >
                <a
                  [routerLink]="['/pago/historial', oid]"
                  class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700"
                  >Historial de pagos</a
                >
              </div>
            } @else {
              <p class="mt-1 text-slate-500">
                Este pedido no se puede vincular a un pago desde este navegador: el backend aún no
                relaciona el número de pedido con el identificador de pago.
              </p>
            }
          </section>
        </article>
      }
    </div>
  `,
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ordersService = inject(OrdersService);
  private readonly tracker = inject(CheckoutTrackerService);

  readonly statusLabel = ORDER_STATUS_LABEL;
  readonly statusClass = ORDER_STATUS_CLASS;
  readonly order = signal<OrderResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);

  readonly ordenIdPago = computed(() => {
    const o = this.order();
    const c = o ? this.tracker.porOrderId(o.orderId) : undefined;
    return c ? CheckoutTrackerService.ordenIdParaPago(c) : null;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = Number(this.route.snapshot.paramMap.get('orderId'));
    this.loading.set(true);
    this.error.set(null);
    this.ordersService.getOrderById(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.loading.set(false);
      },
      error: (e: ApiError) => {
        this.error.set(e);
        this.loading.set(false);
      },
    });
  }
}
