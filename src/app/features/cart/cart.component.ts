import { Component, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from './services/cart.service';
import { CartItem } from '../../core/models/cart-item.model';

/**
 * Componente del carrito de compras.
 *
 * Gestiona los ítems agregados, permite modificar cantidades,
 * eliminar productos y finalizar el pedido (checkout).
 * Todo el estado es reactivo vía Angular Signals del CartService.
 */
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  template: `
    <div class="mx-auto max-w-4xl">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-800 md:text-4xl">Tu Carrito</h1>
        <p class="mt-1 text-slate-500">{{ cartService.itemCount() }} artículo(s) en tu carrito</p>
      </div>

      @if (cartService.items().length > 0) {
        <div class="grid gap-8 lg:grid-cols-3">
          <!-- Items List -->
          <div class="lg:col-span-2">
            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              @for (item of cartService.items(); track item.productId + item.talla; let i = $index) {
                @if (i > 0) {
                  <div class="border-t border-slate-100"></div>
                }
                <div class="flex gap-4 p-5 transition-colors hover:bg-slate-50/50">
                  <!-- Image -->
                  <div class="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200">
                    @if (item.imagenUrl) {
                      <img [src]="item.imagenUrl" [alt]="item.name" class="h-full w-full object-cover" />
                    } @else {
                      <div class="flex h-full items-center justify-center">
                        <svg class="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </div>
                    }
                  </div>

                  <!-- Details -->
                  <div class="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 class="font-bold text-slate-800">{{ item.name }}</h3>
                      <p class="text-sm text-slate-500">SKU: {{ item.sku }} @if (item.talla) { · Talla: {{ item.talla }} }</p>
                    </div>
                    <div class="mt-2 flex items-center justify-between">
                      <!-- Quantity Controls -->
                      <div class="flex items-center gap-2">
                        <button
                          (click)="updateQuantity(item, item.quantity - 1)"
                          class="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100 active:scale-95">
                          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
                          </svg>
                        </button>
                        <span class="w-8 text-center text-sm font-bold text-slate-800">{{ item.quantity }}</span>
                        <button
                          (click)="updateQuantity(item, item.quantity + 1)"
                          class="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100 active:scale-95">
                          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>

                      <!-- Price + Remove -->
                      <div class="flex items-center gap-4">
                        <span class="text-lg font-extrabold text-slate-800">
                          {{ item.unitPrice * item.quantity | number:'1.2-2' }}
                          <span class="text-xs font-medium text-slate-400">COP</span>
                        </span>
                        <button
                          (click)="removeItem(item)"
                          class="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>

            <!-- Continue Shopping -->
            <a routerLink="/catalog" class="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition hover:text-blue-700">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Seguir comprando
            </a>
          </div>

          <!-- Order Summary -->
          <div class="lg:col-span-1">
            <div class="sticky top-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 class="text-lg font-bold text-slate-800">Resumen del Pedido</h3>

              <div class="mt-5 space-y-3">
                <div class="flex justify-between text-sm text-slate-600">
                  <span>Subtotal ({{ cartService.itemCount() }} ítems)</span>
                  <span class="font-medium">{{ cartService.total() | number:'1.2-2' }} COP</span>
                </div>
                <div class="flex justify-between text-sm text-slate-600">
                  <span>Envío</span>
                  <span class="font-medium text-green-600">Gratis</span>
                </div>
                <div class="border-t border-slate-200 pt-3">
                  <div class="flex justify-between">
                    <span class="text-lg font-bold text-slate-800">Total</span>
                    <span class="text-xl font-extrabold text-blue-600">{{ cartService.total() | number:'1.2-2' }} COP</span>
                  </div>
                </div>
              </div>

              <button
                (click)="checkout()"
                [disabled]="checkingOut()"
                [class]="checkingOut()
                  ? 'cursor-wait bg-blue-400'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'"
                class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all duration-200">
                @if (checkingOut()) {
                  <svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Procesando...
                } @else {
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Finalizar Pedido
                }
              </button>
            </div>
          </div>
        </div>
      } @else {
        <!-- Empty Cart -->
        <div class="rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
          <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
            <svg class="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-slate-700">Tu carrito está vacío</h3>
          <p class="mt-2 text-slate-500">Explora nuestro catálogo y encuentra tu camiseta ideal.</p>
          <a routerLink="/catalog" class="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-600">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Ir al Catálogo
          </a>
        </div>
      }
    </div>
  `,
})
export class CartComponent {
  /** Estado de procesamiento del checkout */
  readonly checkingOut = signal<boolean>(false);

  constructor(readonly cartService: CartService) {}

  /** Actualiza la cantidad de un ítem */
  updateQuantity(item: CartItem, newQuantity: number): void {
    this.cartService.updateQuantity(item.productId, item.talla, newQuantity);
  }

  /** Elimina un ítem del carrito */
  removeItem(item: CartItem): void {
    this.cartService.removeFromCart(item.productId, item.talla);
  }

  /** Ejecuta el flujo de checkout */
  checkout(): void {
    this.checkingOut.set(true);

    this.cartService.checkout().subscribe({
      next: () => {
        this.cartService.clearCart();
        this.checkingOut.set(false);
        // TODO: navegar a una vista de confirmación
      },
      error: (err) => {
        console.error('Error al procesar el pedido:', err);
        this.checkingOut.set(false);
      },
    });
  }
}
