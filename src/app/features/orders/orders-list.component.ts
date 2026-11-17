import { ClpPipe } from '../../shared/pipes/clp.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrdersService } from '../../core/services/orders.service';
import { CheckoutTrackerService } from '../../core/services/checkout-tracker.service';
import { OrderResponse } from '../../core/models/order-response.model';
import { ApiError } from '../../core/http/api-error';
import { ApiErrorComponent } from '../../shared/components/api-error/api-error.component';
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from './order-status';

/** Mis pedidos: GET /api/v1/orders. */
@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [ClpPipe, DatePipe, RouterLink, ApiErrorComponent],
  template: `
    <div class="mx-auto max-w-4xl">
      <div class="mb-6 flex items-center justify-between gap-3">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-800">Mis pedidos</h1>
        <button
          type="button"
          (click)="load()"
          [disabled]="loading()"
          class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>

      @for (c of pendientes(); track c.requestId) {
        <a
          [routerLink]="['/pedidos/compra', c.requestId]"
          role="status"
          class="mb-3 block rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 hover:bg-blue-100"
        >
          Compra del {{ c.createdAt | date: 'dd/MM HH:mm' }} en proceso ({{
            c.estado === 'BUSCANDO'
              ? 'esperando confirmación del pedido…'
              : 'aún no aparece en tus pedidos'
          }}). Ver estado &rarr;
        </a>
      }

      @if (loading()) {
        <div
          class="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
          aria-busy="true"
          aria-label="Cargando pedidos"
        ></div>
      } @else if (error()) {
        <app-api-error
          [error]="error()"
          title="No se pudieron cargar tus pedidos"
          (retry)="load()"
        />
      } @else if (orders().length === 0) {
        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center">
          <h2 class="text-lg font-semibold text-slate-700">Aún no tienes pedidos</h2>
          <a
            routerLink="/catalog"
            class="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white"
            >Ir al catálogo</a
          >
        </div>
      } @else {
        <ul class="space-y-3">
          @for (o of orders(); track o.orderId) {
            <li>
              <a
                [routerLink]="['/pedidos', o.orderId]"
                class="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p class="font-bold text-slate-800">Pedido #{{ o.orderId }}</p>
                  <p class="text-xs text-slate-500">
                    {{ o.createdAt | date: 'dd/MM/yyyy HH:mm' }} · {{ o.items.length }} producto(s)
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <span
                    class="rounded-full px-2.5 py-0.5 text-xs font-bold"
                    [class]="statusClass[o.status] ?? ''"
                    >{{ statusLabel[o.status] ?? o.status }}</span
                  >
                  <span class="font-extrabold text-slate-800">{{ o.totalAmount | clp }}</span>
                </div>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class OrdersListComponent implements OnInit {
  private readonly ordersService = inject(OrdersService);
  private readonly tracker = inject(CheckoutTrackerService);

  readonly statusLabel = ORDER_STATUS_LABEL;
  readonly statusClass = ORDER_STATUS_CLASS;
  readonly orders = signal<OrderResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);
  readonly pendientes = computed(() =>
    this.tracker.compras().filter((c) => c.estado === 'BUSCANDO' || c.estado === 'NO_ENCONTRADO'),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.ordersService.getOrders().subscribe({
      next: (list) => {
        this.orders.set(
          [...list].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
        );
        this.loading.set(false);
      },
      error: (e: ApiError) => {
        this.error.set(e);
        this.loading.set(false);
      },
    });
  }
}
