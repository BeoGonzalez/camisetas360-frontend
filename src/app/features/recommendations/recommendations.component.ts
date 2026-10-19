import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RecommendationService } from '../../core/services/recommendation.service';
import { CartService } from '../cart/services/cart.service';
import { RecommendedItem } from '../../core/models/recommendation.model';
import { Product } from '../../core/models/product.model';

@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <section class="my-10 rounded-2xl border border-slate-200 bg-gradient-to-b from-blue-50/50 to-white p-6 shadow-sm md:p-8">
      <!-- Section Header -->
      <div class="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
              Mistral AI
            </span>
            <span class="text-xs font-semibold text-slate-500">Pipeline Asíncrono RabbitMQ</span>
          </div>
          <h2 class="mt-2 text-2xl font-extrabold text-slate-800 md:text-3xl">Recomendaciones para ti</h2>
          <p class="mt-1 text-sm text-slate-600">
            {{ recommendationService.currentRecommendation()?.explanation || 'Sugerencias personalizadas de camisetas seleccionadas por nuestro motor de inteligencia artificial.' }}
          </p>
        </div>

        <button
          (click)="loadRecommendations()"
          [disabled]="recommendationService.status() === 'PROCESSING'"
          class="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <svg class="h-3.5 w-3.5" [class.animate-spin]="recommendationService.status() === 'PROCESSING'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>

      <!-- Loading State -->
      @if (recommendationService.status() === 'PROCESSING') {
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          @for (skeleton of [1, 2, 3]; track skeleton) {
            <div class="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="mb-3 h-36 rounded-xl bg-slate-200"></div>
              <div class="mb-2 h-4 w-3/4 rounded bg-slate-200"></div>
              <div class="mb-3 h-3 w-1/2 rounded bg-slate-200"></div>
              <div class="h-9 w-full rounded-lg bg-slate-200"></div>
            </div>
          }
        </div>
      }

      <!-- Error State -->
      @if (recommendationService.status() === 'UNAVAILABLE') {
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p class="text-sm font-semibold text-amber-800">
            {{ recommendationService.errorMessage() || 'El servicio de recomendaciones no está disponible actualmente.' }}
          </p>
          <button
            (click)="loadRecommendations()"
            class="mt-3 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700"
          >
            Reintentar
          </button>
        </div>
      }

      <!-- Recommendations List -->
      @if (recommendationService.status() === 'COMPLETED') {
        @if (recommendationService.currentRecommendation()?.recommendations?.length) {
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            @for (item of recommendationService.currentRecommendation()?.recommendations; track item.name) {
              <div class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                      {{ item.matchedProduct?.category || 'Sugerencia IA' }}
                    </span>
                    @if (item.matchedProduct && item.matchedProduct.stock > 0) {
                      <span class="text-xs font-semibold text-emerald-600">En stock</span>
                    }
                  </div>

                  <h3 class="mt-3 text-base font-bold text-slate-800">{{ item.name }}</h3>
                  <p class="mt-1 text-xs text-slate-500 leading-relaxed">{{ item.reason }}</p>
                </div>

                <div class="mt-5 border-t border-slate-100 pt-4">
                  @if (item.matchedProduct) {
                    <div class="mb-3 flex items-baseline justify-between">
                      <span class="text-lg font-extrabold text-blue-600">
                        {{ item.matchedProduct.price | number:'1.2-2' }}
                        <span class="text-xs font-normal text-slate-400">COP</span>
                      </span>
                      <span class="text-xs text-slate-400">SKU: {{ item.matchedProduct.sku }}</span>
                    </div>

                    <button
                      (click)="addToCart(item.matchedProduct)"
                      class="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition hover:bg-blue-600 active:scale-95"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Añadir al Carrito
                    </button>
                  } @else {
                    <p class="text-[11px] italic text-slate-400">
                      Recomendación conceptual generada por Mistral AI tras análisis de compras.
                    </p>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="rounded-xl border border-slate-200 bg-white py-12 text-center">
            <p class="text-sm text-slate-500">No hay recomendaciones disponibles para mostrar en este momento.</p>
          </div>
        }
      }
    </section>
  `,
})
export class RecommendationsComponent implements OnInit {
  readonly recommendationService = inject(RecommendationService);
  private readonly cartService = inject(CartService);

  @Input() orderId?: number;

  ngOnInit(): void {
    this.loadRecommendations();
  }

  loadRecommendations(): void {
    this.recommendationService.getRecommendationsForOrder(this.orderId).subscribe();
  }

  addToCart(product: Product): void {
    if (product.stock <= 0) return;
    this.cartService.addToCart(product, '');
  }
}

