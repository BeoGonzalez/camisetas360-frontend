import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { ClpPipe } from '../../shared/pipes/clp.pipe';
import { RecommendationService } from '../../core/services/recommendation.service';
import { CartService } from '../../core/services/cart.service';
import {
  FuenteRecomendacion,
  RecomendacionesModeloResponse,
  RecomendacionesResponse,
} from '../../core/models/recommendation.model';
import { Product } from '../../core/models/product.model';
import { ApiError } from '../../core/http/api-error';
import { ApiErrorComponent } from '../../shared/components/api-error/api-error.component';

/** Ítem normalizado para la vista (ambos endpoints de recomendaciones). */
export interface ItemVista {
  sku: string;
  nombre: string;
  categoria: string;
  precio: number | null;
  /** 0..1, o null si la fuente no entrega una afinidad normalizada. */
  score: number | null;
  motivo: string;
}

const MOTIVO_POR_FUENTE: Record<FuenteRecomendacion, string> = {
  MODELO: 'Elegido para ti por nuestro modelo',
  PESOS: 'Según tus intereses recientes',
  POPULARES: 'Popular en la tienda',
};

/** Solo se muestra % de coincidencia si el backend lo entrega normalizado. */
function scoreNormalizado(score: unknown): number | null {
  return typeof score === 'number' && score >= 0 && score <= 1 ? score : null;
}

function precio(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

/**
 * "Te puede interesar" (CUSTOMER + Catalog.Read).
 * - fuente="modelo": GET /api/v1/recomendaciones (home).
 * - fuente="analytics" (default): GET /api/v1/analytics/recomendaciones; con `showProfile`
 *   muestra además el perfil de intereses (afinidad por categoría).
 * Cada camiseta se puede comprar directo (POST /carrito/items, 1 unidad); el stock lo
 * valida el backend (422 si no hay).
 */
@Component({
  selector: 'app-recommendations',
  standalone: true,
  host: { class: 'block' },
  imports: [ClpPipe, DatePipe, PercentPipe, RouterLink, ApiErrorComponent],
  template: `
    <section class="mt-16 border-t border-ink pt-8" [attr.aria-labelledby]="headingId">
      <header class="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div class="min-w-0">
          <h2 [id]="headingId" class="album-display text-[clamp(28px,4vw,48px)]">
            {{ title() }}
          </h2>
          @if (generadoEn(); as g) {
            <p class="album-caps mt-2 text-[10px] text-slate-600">
              Actualizado {{ g | date: 'dd/MM/yyyy HH:mm' }}
            </p>
          }
        </div>
        <button
          type="button"
          (click)="load()"
          [disabled]="loading()"
          class="album-caps border border-ink px-4 py-2.5 text-[10px] text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ loading() ? 'Actualizando…' : 'Actualizar' }}
        </button>
      </header>

      @if (loading()) {
        <div
          class="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Cargando recomendaciones"
        >
          @for (s of [1, 2, 3]; track s) {
            <div class="h-44 animate-pulse bg-paper-2"></div>
          }
        </div>
      } @else if (error()) {
        <div class="max-w-md">
          <app-api-error
            [error]="error()"
            title="No se pudieron cargar las recomendaciones"
            (retry)="load()"
          />
        </div>
      } @else if (items().length === 0) {
        <p class="album-slot max-w-xl p-6 text-sm text-slate-700">
          Aún no tenemos recomendaciones para ti. Explora el catálogo y las iremos ajustando a tus
          gustos.
        </p>
      } @else {
        @if (mensaje(); as m) {
          <p
            role="status"
            aria-live="polite"
            class="mb-6 border px-4 py-3 text-sm"
            [class]="m.ok ? 'border-pitch text-pitch' : 'border-red-700 text-red-800'"
          >
            {{ m.text }}
            @if (m.ok) {
              <a routerLink="/carrito" class="ml-1 font-semibold underline underline-offset-4"
                >Ver carrito</a
              >
            }
          </p>
        }
        <ul class="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          @for (item of items(); track item.sku) {
            <li class="flex min-w-0 flex-col">
              <div class="flex items-baseline justify-between gap-4 border-b border-ink pb-2">
                <span class="album-caps truncate text-[11px]">{{ item.categoria }}</span>
                @if (item.precio !== null) {
                  <span class="tnum shrink-0 text-lg font-bold">{{ item.precio | clp }}</span>
                }
              </div>
              <a
                [routerLink]="['/catalog', item.sku]"
                class="mt-3 text-[15px] leading-snug text-ink [overflow-wrap:anywhere] underline-offset-4 hover:underline"
              >
                <h3 class="inline">{{ item.nombre }}</h3>
              </a>
              <p class="mt-1 text-sm text-slate-600">
                {{ item.motivo }}
                @if (item.score !== null) {
                  · <span class="tnum text-pitch">{{ item.score | percent }} match</span>
                }
              </p>

              <div class="mt-auto grid grid-cols-2 gap-2 pt-5">
                <a
                  [routerLink]="['/catalog', item.sku]"
                  class="album-caps border border-ink py-3 text-center text-[10px] text-ink transition-colors hover:bg-paper-2"
                  >Ver</a
                >
                <button
                  type="button"
                  (click)="comprar(item)"
                  [disabled]="item.precio === null || comprando() === item.sku"
                  [attr.aria-label]="'Comprar ' + item.nombre"
                  class="album-caps bg-ink py-3 text-[10px] text-paper transition-colors hover:bg-pitch disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                >
                  {{ comprando() === item.sku ? 'Añadiendo…' : 'Comprar' }}
                </button>
              </div>
            </li>
          }
        </ul>
      }

      @if (showProfile() && !loading() && !error()) {
        <div class="mt-12 max-w-xl">
          <h3 class="album-caps text-[11px]">Tu perfil de intereses</h3>
          @if (perfil().length === 0) {
            <p class="mt-3 text-sm text-slate-600">
              Todavía no hay suficiente actividad para calcular tus intereses.
            </p>
          } @else {
            <ul class="mt-4 space-y-3">
              @for (p of perfil(); track p.categoria) {
                <li>
                  <div class="flex justify-between text-sm">
                    <span class="font-medium text-ink">{{ p.categoria }}</span
                    ><span class="tnum text-slate-600">{{ p.afinidad | percent }}</span>
                  </div>
                  <div
                    class="mt-1.5 h-1.5 bg-paper-2"
                    role="progressbar"
                    [attr.aria-label]="'Afinidad ' + p.categoria"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-valuenow]="(p.afinidad * 100).toFixed(0)"
                  >
                    <div class="h-full bg-pitch" [style.width.%]="p.afinidad * 100"></div>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      }
    </section>
  `,
})
export class RecommendationsComponent implements OnInit {
  private readonly service = inject(RecommendationService);
  private readonly cart = inject(CartService);
  private static seq = 0;
  private peticion?: Subscription;

  readonly title = input('Recomendaciones para ti');
  readonly excludeSku = input<string | null>(null);
  readonly showProfile = input(false);
  readonly fuente = input<'analytics' | 'modelo'>('analytics');

  readonly headingId = `reco-${++RecommendationsComponent.seq}`;
  readonly data = signal<RecomendacionesResponse | null>(null);
  readonly modelo = signal<RecomendacionesModeloResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);
  /** SKU que se está agregando al carrito ('' = ninguno). */
  readonly comprando = signal('');
  readonly mensaje = signal<{ ok: boolean; text: string } | null>(null);

  readonly generadoEn = computed(() => this.data()?.generadoEn ?? null);
  readonly items = computed<ItemVista[]>(() => {
    const m = this.modelo();
    const lista: ItemVista[] = m
      ? [...(m.items ?? [])]
          .sort((a, b) => (a.posicion ?? 0) - (b.posicion ?? 0))
          .map((i) => ({
            sku: i.sku,
            nombre: i.nombre || i.sku,
            categoria: i.categoria ?? '',
            precio: precio(i.precio),
            score: scoreNormalizado(i.score),
            motivo: MOTIVO_POR_FUENTE[m.fuente] ?? '',
          }))
      : (this.data()?.items ?? []).map((i) => ({
          sku: i.sku,
          nombre: i.nombre || i.sku,
          categoria: i.categoria ?? '',
          precio: precio(i.precio),
          score: scoreNormalizado(i.score),
          motivo: i.motivo ?? '',
        }));
    const excluir = this.excludeSku();
    const vistos = new Set<string>();
    // Sin SKU no se puede ver ni comprar; duplicados romperían el `track`.
    return lista.filter((i) => {
      if (!i.sku || i.sku === excluir || vistos.has(i.sku)) return false;
      vistos.add(i.sku);
      return true;
    });
  });
  readonly perfil = computed(() =>
    Object.entries(this.data()?.perfil ?? {})
      .filter(([, afinidad]) => typeof afinidad === 'number')
      .map(([categoria, afinidad]) => ({
        categoria,
        afinidad: Math.min(1, Math.max(0, afinidad)),
      }))
      .sort((a, b) => b.afinidad - a.afinidad),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.peticion?.unsubscribe());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    // "Actualizar" repetido o un reintento: se descarta la respuesta anterior.
    this.peticion?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.mensaje.set(null);
    this.peticion =
      this.fuente() === 'modelo'
        ? this.suscribir(this.service.getRecomendacionesModelo(), (d) => this.modelo.set(d))
        : this.suscribir(this.service.getRecomendaciones(), (d) => this.data.set(d));
  }

  /** Agrega 1 unidad al carrito. El ítem de recomendación trae lo que pide POST /carrito/items. */
  comprar(item: ItemVista): void {
    if (item.precio === null || this.comprando()) return;
    const producto: Product = {
      sku: item.sku,
      name: item.nombre,
      category: item.categoria,
      price: item.precio,
      stock: 1,
      description: null,
    };
    this.comprando.set(item.sku);
    this.mensaje.set(null);
    this.cart.addItem(producto, 1).subscribe({
      next: () => {
        this.comprando.set('');
        this.mensaje.set({ ok: true, text: `${item.nombre} se añadió al carrito.` });
      },
      error: (e: ApiError) => {
        this.comprando.set('');
        this.mensaje.set({ ok: false, text: e.message });
      },
    });
  }

  private suscribir<T>(fuente: Observable<T>, guardar: (d: T) => void): Subscription {
    return fuente.subscribe({
      next: (d) => {
        guardar(d);
        this.loading.set(false);
      },
      error: (e: ApiError) => {
        this.error.set(e);
        this.loading.set(false);
      },
    });
  }
}
