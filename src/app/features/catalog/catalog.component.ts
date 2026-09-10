import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CatalogService } from './services/catalog.service';
import { CartService } from '../cart/services/cart.service';
import { Product } from '../../core/models/product.model';

/**
 * Componente del catálogo de camisetas.
 *
 * Muestra los productos en un grid responsivo de tarjetas con:
 * - Skeleton loaders durante la carga
 * - Datos del contrato público del catálogo
 * - Animaciones de hover (scale + shadow)
 * - Categoría, descripción y stock
 * - Botón "Añadir al carrito" con feedback visual
 */
@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <!-- Hero Section -->
    <section class="mb-10">
      <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-8 py-14 text-white">
        <div class="absolute inset-0 opacity-10">
          <div class="absolute inset-0" style="background-image: radial-gradient(circle at 25% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(59,130,246,0.2) 0%, transparent 50%)"></div>
        </div>
        <div class="relative z-10">
          <h1 class="text-4xl font-extrabold tracking-tight md:text-5xl">Catálogo de Camisetas</h1>
          <p class="mt-3 text-lg text-blue-200/80">Explora las camisetas disponibles en nuestro catálogo</p>
        </div>
      </div>
    </section>

    <!-- Loading Skeleton -->
    @if (loading()) {
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        @for (skeleton of skeletons; track skeleton) {
          <div class="animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="h-56 rounded-t-2xl bg-slate-200"></div>
            <div class="p-5">
              <div class="mb-3 h-4 w-3/4 rounded bg-slate-200"></div>
              <div class="mb-2 h-3 w-1/2 rounded bg-slate-200"></div>
              <div class="mb-4 h-5 w-1/3 rounded bg-slate-200"></div>
              <div class="h-10 w-full rounded-lg bg-slate-200"></div>
            </div>
          </div>
        }
      </div>
    }

    <!-- Error State -->
    @if (error()) {
      <div class="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg class="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-red-800">Error al cargar el catálogo</h3>
        <p class="mt-1 text-sm text-red-600">{{ error() }}</p>
        <button (click)="loadProducts()" class="mt-4 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-700">
          Reintentar
        </button>
      </div>
    }

    <!-- Product Grid -->
    @if (!loading() && !error()) {
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        @for (product of products(); track product.sku) {
          <div class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <!-- Image -->
            <div class="relative h-56 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
              <div class="flex h-full items-center justify-center text-sm text-slate-500" role="img" aria-label="Imagen temporal: fotografía no disponible">Imagen no disponible</div>

              <!-- Categoría -->
              <span class="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
                {{ product.category }}
              </span>

              <!-- Stock Badge -->
              @if (product.stock <= 5 && product.stock > 0) {
                <span class="absolute right-3 top-3 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                  ¡Últimas {{ product.stock }}!
                </span>
              }
            </div>

            <!-- Content -->
            <div class="p-5">
              <h3 class="text-lg font-bold text-slate-800">{{ product.name }}</h3>
              <p class="mt-0.5 text-sm text-slate-500">{{ product.description }}</p>

              <div class="mt-3 flex items-baseline gap-1">
                <span class="text-2xl font-extrabold text-blue-600">{{ product.price | number:'1.2-2' }}</span>
                <span class="text-sm font-medium text-slate-400">COP</span>
              </div>

              <p class="mt-3 text-sm text-slate-500">SKU: {{ product.sku }} · Stock: {{ product.stock }}</p>
              <p class="mt-1 text-xs text-slate-500">Tallas no informadas por el catálogo.</p>

              <!-- Botón Agregar -->
              <button
                (click)="addToCart(product)"
                [disabled]="product.stock <= 0"
                [class]="product.stock <= 0
                  ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                  : 'bg-slate-900 text-white hover:bg-blue-600 active:scale-[0.97]'"
                class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-200">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                {{ product.stock <= 0 ? 'Agotado' : addedProductId() === product.sku ? 'Añadido al carrito' : 'Añadir al Carrito' }}
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Empty State -->
      @if (products().length === 0) {
        <div class="py-20 text-center">
          <svg class="mx-auto h-16 w-16 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 class="mt-4 text-lg font-semibold text-slate-600">No hay productos disponibles</h3>
          <p class="mt-1 text-sm text-slate-400">Vuelve pronto, estamos actualizando nuestro catálogo.</p>
        </div>
      }
    }
  `,
})
export class CatalogComponent implements OnInit {
  /** Lista de productos cargados del catálogo */
  readonly products = signal<Product[]>([]);

  /** Estado de carga */
  readonly loading = signal<boolean>(true);

  /** Mensaje de error si falla la carga */
  readonly error = signal<string>('');


  /** Array para generar skeleton loaders */
  readonly skeletons = Array.from({ length: 8 }, (_, index) => index);

  /** Señal temporal para el feedback de "añadido" */
  readonly addedProductId = signal<string>('');

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly catalogService: CatalogService,
    private readonly cartService: CartService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  /** Carga los productos desde el servicio de catálogo */
  loadProducts(): void {
    this.loading.set(true);
    this.error.set('');

    this.catalogService.getProducts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.products.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[CatalogComponent] Error al cargar catálogo:', err);
        this.error.set('No se pudieron cargar los productos. Revisa la conexión y la configuración CORS del servidor.');
        this.loading.set(false);
      },
    });
  }

  /** El backend no informa tallas: se agrega por SKU. */
  addToCart(product: Product): void {
    if (product.stock <= 0) return;
    this.cartService.addToCart(product, '');

    // Feedback visual temporal
    this.addedProductId.set(product.sku);
    setTimeout(() => this.addedProductId.set(''), 1500);
  }
}
