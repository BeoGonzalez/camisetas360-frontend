import { ClpPipe } from '../../shared/pipes/clp.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { CheckoutTrackerService } from '../../core/services/checkout-tracker.service';
import {
  CANTIDAD_MAXIMA_POR_SKU,
  COSTOS_ENVIO,
  CartItemDTO,
  MetodoEnvio,
} from '../../core/models/cart.model';
import { ApiError } from '../../core/http/api-error';
import { ApiErrorComponent } from '../../shared/components/api-error/api-error.component';

/**
 * Carrito persistido en el backend: ítems, cantidades, envío, totales y checkout (202).
 * Los precios vienen del cliente: son informativos.
 */
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [ClpPipe, RouterLink, ReactiveFormsModule, ApiErrorComponent],
  template: `
    <div class="mx-auto max-w-5xl">
      <div class="mb-6">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-800 md:text-4xl">
          Tu Carrito
        </h1>
        <p class="mt-1 text-slate-500">{{ cartService.itemCount() }} artículo(s)</p>
      </div>

      @if (actionError()) {
        <div class="mb-4"><app-api-error [error]="actionError()" (retry)="load()" /></div>
      }

      @if (loading()) {
        <div
          class="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white"
          aria-busy="true"
          aria-label="Cargando carrito"
        ></div>
      } @else if (loadError()) {
        <app-api-error
          [error]="loadError()"
          title="No se pudo cargar tu carrito"
          (retry)="load()"
        />
      } @else if (cartService.items().length === 0) {
        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center shadow-sm">
          <h2 class="text-xl font-bold text-slate-700">Tu carrito está vacío</h2>
          <p class="mt-2 text-slate-500">Explora nuestro catálogo y encuentra tu camiseta ideal.</p>
          <a
            routerLink="/catalog"
            class="mt-6 inline-flex rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-blue-600"
            >Ir al Catálogo</a
          >
        </div>
      } @else {
        <div class="grid gap-6 lg:grid-cols-3">
          <div class="space-y-6 lg:col-span-2">
            <!-- Ítems -->
            <ul
              class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              @for (item of cartService.items(); track item.sku) {
                <li
                  class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div class="min-w-0">
                    <h2 class="font-bold text-slate-800">{{ item.nombre }}</h2>
                    <p class="text-xs text-slate-500">
                      SKU {{ item.sku }}
                      @if (item.categoria) {
                        · {{ item.categoria }}
                      }
                    </p>
                    <p class="mt-1 text-sm text-slate-600">{{ item.precioUnitario | clp }} c/u</p>
                  </div>
                  <div class="flex items-center gap-3">
                    <label class="sr-only" [for]="'qty-' + item.sku"
                      >Cantidad de {{ item.nombre }}</label
                    >
                    <div class="flex items-center rounded-lg border border-slate-300">
                      <button
                        type="button"
                        (click)="setQty(item, item.cantidad - 1)"
                        [disabled]="busy()"
                        [attr.aria-label]="'Quitar una unidad de ' + item.nombre"
                        class="px-3 py-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      >
                        −
                      </button>
                      <input
                        [id]="'qty-' + item.sku"
                        type="number"
                        min="1"
                        [max]="max"
                        [value]="item.cantidad"
                        [disabled]="busy()"
                        (change)="setQty(item, +$any($event.target).value)"
                        class="w-14 border-x border-slate-300 py-2 text-center text-sm"
                      />
                      <button
                        type="button"
                        (click)="setQty(item, item.cantidad + 1)"
                        [disabled]="busy() || item.cantidad >= max"
                        [attr.aria-label]="'Agregar una unidad de ' + item.nombre"
                        class="px-3 py-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <span class="w-24 text-right font-bold text-slate-800">{{
                      item.subtotal | clp
                    }}</span>
                    <button
                      type="button"
                      (click)="remove(item)"
                      [disabled]="busy()"
                      [attr.aria-label]="'Eliminar ' + item.nombre"
                      class="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              }
            </ul>

            <!-- Envío -->
            <form
              [formGroup]="envioForm"
              (ngSubmit)="saveShipping()"
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              aria-labelledby="envio-h"
            >
              <h2 id="envio-h" class="text-lg font-bold text-slate-800">Envío</h2>
              <fieldset class="mt-3 grid gap-2 sm:grid-cols-3">
                <legend class="sr-only">Método de envío</legend>
                @for (m of metodos; track m.value) {
                  <label
                    class="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 p-3 text-sm has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50"
                  >
                    <input type="radio" formControlName="metodo" [value]="m.value" />
                    <span
                      >{{ m.label
                      }}<span class="block text-xs text-slate-500">{{
                        m.costo === 0 ? 'Gratis' : (m.costo | clp)
                      }}</span></span
                    >
                  </label>
                }
              </fieldset>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label for="region" class="block text-xs font-semibold text-slate-600"
                    >Región</label
                  >
                  <input
                    id="region"
                    formControlName="region"
                    maxlength="100"
                    autocomplete="address-level1"
                    [attr.aria-invalid]="invalid('region')"
                    aria-describedby="region-err"
                    class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  @if (invalid('region')) {
                    <p id="region-err" class="mt-1 text-xs text-red-600">Ingresa la región.</p>
                  }
                </div>
                <div>
                  <label for="comuna" class="block text-xs font-semibold text-slate-600"
                    >Comuna</label
                  >
                  <input
                    id="comuna"
                    formControlName="comuna"
                    maxlength="100"
                    autocomplete="address-level2"
                    [attr.aria-invalid]="invalid('comuna')"
                    aria-describedby="comuna-err"
                    class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  @if (invalid('comuna')) {
                    <p id="comuna-err" class="mt-1 text-xs text-red-600">Ingresa la comuna.</p>
                  }
                </div>
              </div>
              <div class="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  [disabled]="busy()"
                  class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  Guardar envío
                </button>
                @if (cartService.cart().envio; as e) {
                  <p class="text-sm text-emerald-700" role="status">
                    Envío {{ e.metodo }} a {{ e.comuna }}, {{ e.region }}.
                  </p>
                }
              </div>
            </form>
          </div>

          <!-- Resumen -->
          <aside
            class="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24"
            aria-labelledby="resumen-h"
          >
            <h2 id="resumen-h" class="text-lg font-bold text-slate-800">Resumen</h2>
            <dl class="mt-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-slate-500">Subtotal</dt>
                <dd class="font-semibold">{{ cartService.cart().subtotal | clp }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-slate-500">Envío</dt>
                <dd class="font-semibold">
                  {{ cartService.cart().costoEnvio | clp }}
                </dd>
              </div>
              <div class="flex justify-between border-t border-slate-100 pt-2 text-base">
                <dt class="font-bold">Total</dt>
                <dd class="font-extrabold text-blue-600">
                  {{ cartService.cart().total | clp }}
                </dd>
              </div>
            </dl>
            <p class="mt-2 text-xs text-slate-400">
              Precios informativos; el pedido se confirma tras el checkout.
            </p>
            @if (!cartService.cart().envio) {
              <p class="mt-3 text-xs text-amber-700">
                Elige un método de envío antes de finalizar.
              </p>
            }
            <button
              type="button"
              (click)="checkout()"
              [disabled]="busy() || !cartService.cart().envio"
              class="mt-4 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {{ checkingOut() ? 'Enviando pedido…' : 'Finalizar compra' }}
            </button>
          </aside>
        </div>
      }
    </div>
  `,
})
export class CartComponent implements OnInit {
  readonly cartService = inject(CartService);
  private readonly tracker = inject(CheckoutTrackerService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly max = CANTIDAD_MAXIMA_POR_SKU;
  readonly loading = signal(true);
  readonly loadError = signal<ApiError | null>(null);
  readonly actionError = signal<ApiError | null>(null);
  readonly busy = signal(false);
  readonly checkingOut = signal(false);

  readonly metodos: { value: MetodoEnvio; label: string; costo: number }[] = [
    { value: 'STANDARD', label: 'Estándar', costo: COSTOS_ENVIO.STANDARD },
    { value: 'EXPRESS', label: 'Express', costo: COSTOS_ENVIO.EXPRESS },
    { value: 'RETIRO_TIENDA', label: 'Retiro en tienda', costo: COSTOS_ENVIO.RETIRO_TIENDA },
  ];

  readonly envioForm = this.fb.nonNullable.group({
    metodo: ['STANDARD' as MetodoEnvio, Validators.required],
    region: ['', [Validators.required, Validators.maxLength(100)]],
    comuna: ['', [Validators.required, Validators.maxLength(100)]],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.actionError.set(null);
    this.cartService.load().subscribe({
      next: (c) => {
        if (c.envio) this.envioForm.patchValue(c.envio);
        this.loading.set(false);
      },
      error: (e: ApiError) => {
        this.loadError.set(e);
        this.loading.set(false);
      },
    });
  }

  invalid(name: 'region' | 'comuna'): boolean {
    const c = this.envioForm.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  setQty(item: CartItemDTO, qty: number): void {
    this.run(this.cartService.setQuantity(item, qty));
  }

  remove(item: CartItemDTO): void {
    this.run(this.cartService.removeItem(item.sku));
  }

  saveShipping(): void {
    if (this.envioForm.invalid) {
      this.envioForm.markAllAsTouched();
      return;
    }
    const v = this.envioForm.getRawValue();
    this.run(
      this.cartService.setShipping({
        metodo: v.metodo,
        region: v.region.trim(),
        comuna: v.comuna.trim(),
      }),
    );
  }

  checkout(): void {
    this.busy.set(true);
    this.checkingOut.set(true);
    this.actionError.set(null);
    this.tracker.checkout().subscribe({
      next: (compra) => {
        this.busy.set(false);
        this.checkingOut.set(false);
        void this.router.navigate(['/pedidos/compra', compra.requestId]);
      },
      error: (e: ApiError) => {
        this.busy.set(false);
        this.checkingOut.set(false);
        this.actionError.set(e);
      },
    });
  }

  private run(obs: ReturnType<CartService['load']>): void {
    this.busy.set(true);
    this.actionError.set(null);
    obs.subscribe({
      next: () => this.busy.set(false),
      error: (e: ApiError) => {
        this.busy.set(false);
        this.actionError.set(e);
      },
    });
  }
}
