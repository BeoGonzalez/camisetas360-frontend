import { ClpPipe } from '../../shared/pipes/clp.pipe';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RecommendationService } from '../../core/services/recommendation.service';
import {
  FuenteRecomendacion,
  RecomendacionesModeloResponse,
  RecomendacionesResponse,
} from '../../core/models/recommendation.model';
import { ApiError } from '../../core/http/api-error';
import { ApiErrorComponent } from '../../shared/components/api-error/api-error.component';

/** Ítem normalizado para la vista (ambos endpoints de recomendaciones). */
interface ItemVista {
  sku: string;
  nombre: string;
  categoria: string;
  precio: number;
  /** 0..1, o null si la fuente no entrega una afinidad normalizada. */
  score: number | null;
  motivo: string;
}

const MOTIVO_POR_FUENTE: Record<FuenteRecomendacion, string> = {
  MODELO: 'Elegido para ti por nuestro modelo',
  PESOS: 'Según tus intereses recientes',
  POPULARES: 'Popular en la tienda',
};

/**
 * "Te puede interesar" (CUSTOMER + Catalog.Read).
 * - fuente="modelo": GET /api/v1/recomendaciones (home).
 * - fuente="analytics" (default): GET /api/v1/analytics/recomendaciones; con `showProfile`
 *   muestra además el perfil de intereses (afinidad por categoría).
 */
@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [ClpPipe, DatePipe, PercentPipe, RouterLink, ApiErrorComponent],
  template: `
    <section
      class="my-10 rounded-2xl border border-slate-200 bg-gradient-to-b from-blue-50/50 to-white p-5 shadow-sm sm:p-8"
      [attr.aria-labelledby]="headingId"
    >
      <div class="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 [id]="headingId" class="text-2xl font-extrabold text-slate-800">{{ title() }}</h2>
          @if (generadoEn(); as g) {
            <p class="mt-1 text-xs text-slate-500">
              Actualizado {{ g | date: 'dd/MM/yyyy HH:mm' }}
            </p>
          }
        </div>
        <button
          type="button"
          (click)="load()"
          [disabled]="loading()"
          class="self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>

      @if (loading()) {
        <div
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Cargando recomendaciones"
        >
          @for (s of [1, 2, 3]; track s) {
            <div class="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"></div>
          }
        </div>
      } @else if (error()) {
        <app-api-error
          [error]="error()"
          title="No se pudieron cargar las recomendaciones"
          (retry)="load()"
        />
      } @else if (items().length === 0) {
        <p
          class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500"
        >
          Aún no tenemos recomendaciones para ti. Explora el catálogo y las iremos ajustando a tus
          gustos.
        </p>
      } @else {
        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (item of items(); track item.sku) {
            <li class="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span
                class="self-start rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600"
                >{{ item.categoria }}</span
              >
              <h3 class="mt-2 font-bold text-slate-800">{{ item.nombre }}</h3>
              <p class="mt-1 text-sm text-slate-500">{{ item.motivo }}</p>
              <div class="mt-auto flex items-center justify-between pt-3">
                <span class="font-extrabold text-blue-600">{{ item.precio | clp }}</span>
                @if (item.score !== null) {
                  <span
                    class="text-xs text-slate-500"
                    [attr.aria-label]="'Coincidencia ' + (item.score | percent)"
                    >{{ item.score | percent }} match</span
                  >
                }
              </div>
              <a
                [routerLink]="['/catalog', item.sku]"
                class="mt-3 rounded-xl border border-slate-300 py-2 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
                >Ver producto</a
              >
            </li>
          }
        </ul>
      }

      @if (showProfile() && !loading() && !error()) {
        <div class="mt-8">
          <h3 class="text-lg font-bold text-slate-800">Tu perfil de intereses</h3>
          @if (perfil().length === 0) {
            <p class="mt-2 text-sm text-slate-500">
              Todavía no hay suficiente actividad para calcular tus intereses.
            </p>
          } @else {
            <ul class="mt-3 space-y-2">
              @for (p of perfil(); track p.categoria) {
                <li>
                  <div class="flex justify-between text-sm">
                    <span class="font-medium text-slate-700">{{ p.categoria }}</span
                    ><span class="text-slate-500">{{ p.afinidad | percent }}</span>
                  </div>
                  <div
                    class="mt-1 h-2 rounded-full bg-slate-100"
                    role="progressbar"
                    [attr.aria-label]="'Afinidad ' + p.categoria"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-valuenow]="(p.afinidad * 100).toFixed(0)"
                  >
                    <div
                      class="h-2 rounded-full bg-blue-600"
                      [style.width.%]="p.afinidad * 100"
                    ></div>
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
  private static seq = 0;

  readonly title = input('Recomendaciones para ti');
  readonly excludeSku = input<string | null>(null);
  readonly showProfile = input(false);
  readonly fuente = input<'analytics' | 'modelo'>('analytics');

  readonly headingId = `reco-${++RecommendationsComponent.seq}`;
  readonly data = signal<RecomendacionesResponse | null>(null);
  readonly modelo = signal<RecomendacionesModeloResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);

  readonly generadoEn = computed(() => this.data()?.generadoEn ?? null);
  readonly items = computed<ItemVista[]>(() => {
    const m = this.modelo();
    const lista: ItemVista[] = m
      ? [...m.items]
          .sort((a, b) => a.posicion - b.posicion)
          .map((i) => ({
            sku: i.sku,
            nombre: i.nombre,
            categoria: i.categoria,
            precio: i.precio,
            score: i.score >= 0 && i.score <= 1 ? i.score : null,
            motivo: MOTIVO_POR_FUENTE[m.fuente] ?? '',
          }))
      : (this.data()?.items ?? []);
    return lista.filter((i) => i.sku !== this.excludeSku());
  });
  readonly perfil = computed(() =>
    Object.entries(this.data()?.perfil ?? {})
      .map(([categoria, afinidad]) => ({ categoria, afinidad }))
      .sort((a, b) => b.afinidad - a.afinidad),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const done = () => this.loading.set(false);
    if (this.fuente() === 'modelo') {
      this.service.getRecomendacionesModelo().subscribe({
        next: (d) => {
          this.modelo.set(d);
          done();
        },
        error: (e: ApiError) => {
          this.error.set(e);
          done();
        },
      });
      return;
    }
    this.service.getRecomendaciones().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (e: ApiError) => {
        this.error.set(e);
        this.loading.set(false);
      },
    });
  }
}
