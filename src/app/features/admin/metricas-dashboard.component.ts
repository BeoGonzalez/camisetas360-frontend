import { ClpPipe } from '../../shared/pipes/clp.pipe';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MetricasService } from '../../core/services/metricas.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiErrorComponent } from '../../shared/components/api-error/api-error.component';

const CHART_W = 600;
const CHART_H = 160;

/**
 * Dashboard en tiempo real (ADMIN / CATALOG_MANAGER): clics/min, usuarios activos,
 * serie de clics (15 min), top productos, eventos por tipo y alertas.
 * Fuente: STOMP /topic/metricas (local) o telemetría de API Gateway WebSocket (AWS, tabla
 * "Productos en vivo"); fallback polling GET /analytics/metricas cada 5 s.
 */
@Component({
  selector: 'app-metricas-dashboard',
  standalone: true,
  imports: [ClpPipe, DatePipe, DecimalPipe, RouterLink, ApiErrorComponent],
  template: `
    <div class="space-y-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight text-slate-800">Métricas en vivo</h1>
          <p class="mt-1 text-sm text-slate-500" role="status" aria-live="polite">
            @switch (metricas.fuente()) {
              @case ('websocket') {
                <span
                  class="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500"
                  aria-hidden="true"
                ></span
                >Conectado en tiempo real
              }
              @case ('polling') {
                <span
                  class="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500"
                  aria-hidden="true"
                ></span
                >Sin tiempo real: actualizando cada 5 s
              }
              @case ('conectando') {
                Conectando…
              }
              @default {
                Desconectado
              }
            }
            @if (s()?.generadoEn; as g) {
              · Datos de {{ g | date: 'HH:mm:ss' }}
            }
          </p>
        </div>
        @if (auth.isAdmin()) {
          <a
            routerLink="/pago/alertas"
            class="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
            >Alertas de fraude (pagos)</a
          >
        }
      </header>

      @if (metricas.error(); as e) {
        <app-api-error
          [error]="e"
          title="Problema al obtener métricas"
          (retry)="metricas.start()"
        />
      }

      @if (!s()) {
        <div class="grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Cargando métricas">
          @for (i of [1, 2, 3]; track i) {
            <div class="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"></div>
          }
        </div>
      } @else {
        <!-- KPIs -->
        <section class="grid gap-4 sm:grid-cols-3" aria-label="Indicadores">
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Clics último minuto
            </p>
            <p class="mt-2 text-4xl font-extrabold text-slate-900">
              {{ s()!.clicsUltimoMinuto | number }}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Usuarios activos (5 min)
            </p>
            <p class="mt-2 text-4xl font-extrabold text-slate-900">
              {{ s()!.usuariosActivos | number }}
            </p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Eventos última hora
            </p>
            <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              @for (e of eventos(); track e.tipo) {
                <dt class="truncate text-slate-500">{{ e.label }}</dt>
                <dd class="text-right font-semibold text-slate-800">{{ e.valor | number }}</dd>
              }
            </dl>
          </div>
        </section>

        <!-- Serie de clics -->
        <section
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          aria-labelledby="serie-h"
        >
          <div class="flex items-center justify-between">
            <h2 id="serie-h" class="text-lg font-bold text-slate-800">
              Clics por minuto (últimos 15 min)
            </h2>
            <button
              type="button"
              (click)="showTable.set(!showTable())"
              class="text-xs font-semibold text-blue-600 hover:underline"
              [attr.aria-pressed]="showTable()"
            >
              {{ showTable() ? 'Ver gráfico' : 'Ver tabla' }}
            </button>
          </div>
          @if (showTable()) {
            <table class="mt-3 w-full text-sm">
              <thead class="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th scope="col" class="py-1">Minuto</th>
                  <th scope="col" class="py-1 text-right">Clics</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (p of s()!.serieClics; track p.minuto) {
                  <tr>
                    <td class="py-1">{{ p.minuto | date: 'HH:mm' }}</td>
                    <td class="py-1 text-right">{{ p.clics }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <div class="relative mt-3">
              <svg
                [attr.viewBox]="'0 0 ' + W + ' ' + H"
                class="h-auto w-full"
                role="img"
                [attr.aria-label]="
                  'Clics por minuto; máximo ' + maxClics() + ', último ' + ultimoClics()
                "
              >
                <line
                  x1="0"
                  [attr.y1]="H"
                  [attr.x2]="W"
                  [attr.y2]="H"
                  class="stroke-slate-200"
                  stroke-width="1"
                />
                @for (b of barras(); track b.minuto) {
                  <g
                    (mouseenter)="hover.set(b)"
                    (mouseleave)="hover.set(null)"
                    (focus)="hover.set(b)"
                    (blur)="hover.set(null)"
                    tabindex="0"
                    [attr.aria-label]="(b.minuto | date: 'HH:mm') + ': ' + b.clics + ' clics'"
                  >
                    <rect
                      [attr.x]="b.x - b.slot / 2"
                      y="0"
                      [attr.width]="b.slot"
                      [attr.height]="H"
                      fill="transparent"
                    />
                    <path
                      [attr.d]="b.path"
                      class="fill-blue-600"
                      [class.opacity-60]="hover() && hover() !== b"
                    />
                  </g>
                }
              </svg>
              <div class="mt-1 flex justify-between text-xs text-slate-500" aria-hidden="true">
                <span>{{ primerMinuto() | date: 'HH:mm' }}</span
                ><span>{{ ultimoMinuto() | date: 'HH:mm' }}</span>
              </div>
              @if (hover(); as h) {
                <div
                  class="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow"
                  [style.left.%]="(h.x / W) * 100"
                  role="tooltip"
                >
                  {{ h.minuto | date: 'HH:mm' }} · <strong>{{ h.clics }}</strong> clics
                </div>
              }
            </div>
          }
        </section>

        <div class="grid gap-6 lg:grid-cols-2">
          <!-- Top productos -->
          <section
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            aria-labelledby="top-h"
          >
            <h2 id="top-h" class="text-lg font-bold text-slate-800">
              Productos más vistos (última hora)
            </h2>
            @if (s()!.productosMasVistos.length === 0) {
              <p class="mt-3 text-sm text-slate-500">Sin visitas registradas.</p>
            } @else {
              <ol class="mt-3 space-y-3">
                @for (p of s()!.productosMasVistos; track p.sku) {
                  <li>
                    <div class="flex justify-between gap-2 text-sm">
                      <span class="truncate font-medium text-slate-700"
                        >{{ p.nombre }}
                        <span class="text-xs text-slate-400">{{ p.sku }}</span></span
                      >
                      <span class="font-semibold text-slate-800">{{ p.vistas | number }}</span>
                    </div>
                    <div class="mt-1 h-2 rounded-full bg-slate-100" aria-hidden="true">
                      <div
                        class="h-2 rounded-full bg-blue-600"
                        [style.width.%]="(p.vistas / maxVistas()) * 100"
                      ></div>
                    </div>
                  </li>
                }
              </ol>
            }
          </section>

          <!-- Alertas -->
          <section
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            aria-labelledby="alertas-h"
          >
            <h2 id="alertas-h" class="text-lg font-bold text-slate-800">Alertas recientes</h2>
            @if (s()!.alertas.length === 0) {
              <p class="mt-3 text-sm text-slate-500">Sin alertas.</p>
            } @else {
              <ul class="mt-3 space-y-2" aria-live="polite">
                @for (a of s()!.alertas; track a.ocurridoEn + a.tipo) {
                  <li
                    class="rounded-xl border p-3 text-sm"
                    [class]="
                      a.tipo === 'FRAUDE'
                        ? 'border-red-200 bg-red-50'
                        : 'border-amber-200 bg-amber-50'
                    "
                  >
                    <p
                      class="font-semibold"
                      [class]="a.tipo === 'FRAUDE' ? 'text-red-800' : 'text-amber-900'"
                    >
                      <span aria-hidden="true">{{ a.tipo === 'FRAUDE' ? '⛔' : '⚠' }}</span>
                      {{ tipoAlerta[a.tipo] ?? a.tipo }}
                    </p>
                    <p class="text-slate-700">{{ a.mensaje }}</p>
                    <p class="mt-1 text-xs text-slate-500">
                      {{ a.ocurridoEn | date: 'dd/MM HH:mm:ss' }}
                    </p>
                  </li>
                }
              </ul>
            }
          </section>
        </div>

        @if (metricas.productosEnVivo().length > 0) {
          <section
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            aria-labelledby="vivo-h"
          >
            <h2 id="vivo-h" class="text-lg font-bold text-slate-800">Productos en vivo</h2>
            <div class="mt-3 overflow-x-auto">
              <table class="w-full min-w-[32rem] text-left text-sm">
                <thead class="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" class="py-2 pr-3">Producto</th>
                    <th scope="col" class="py-2 pr-3">Categoría</th>
                    <th scope="col" class="py-2 pr-3 text-right">Precio</th>
                    <th scope="col" class="py-2 pr-3 text-right">Vistas</th>
                    <th scope="col" class="py-2 pr-3 text-right">Agregados</th>
                    <th scope="col" class="py-2 text-right">Actualizado</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (p of metricas.productosEnVivo(); track p.sku) {
                    <tr>
                      <td class="py-2 pr-3 font-medium text-slate-700">
                        {{ p.nombre }} <span class="text-xs text-slate-400">{{ p.sku }}</span>
                      </td>
                      <td class="py-2 pr-3 text-slate-600">{{ p.categoria }}</td>
                      <td class="py-2 pr-3 text-right">{{ p.precio | clp }}</td>
                      <td class="py-2 pr-3 text-right font-semibold">{{ p.vistas | number }}</td>
                      <td class="py-2 pr-3 text-right">{{ p.agregados | number }}</td>
                      <td class="py-2 text-right text-xs text-slate-500">
                        {{ p.actualizadoEn | date: 'HH:mm:ss' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      }
    </div>
  `,
})
export class MetricasDashboardComponent implements OnInit, OnDestroy {
  readonly metricas = inject(MetricasService);
  readonly auth = inject(AuthService);

  readonly W = CHART_W;
  readonly H = CHART_H;
  readonly s = this.metricas.snapshot;
  readonly showTable = signal(false);
  readonly hover = signal<Barra | null>(null);

  readonly tipoAlerta: Record<string, string> = {
    FRAUDE: 'Fraude',
    NAVEGACION_ANOMALA: 'Navegación anómala',
    PICO_TRAFICO: 'Pico de tráfico',
  };

  readonly eventos = computed(() => {
    const e = this.s()?.eventosPorTipo ?? {};
    return [
      { tipo: 'PRODUCTO_VISTO', label: 'Vistas', valor: e.PRODUCTO_VISTO ?? 0 },
      { tipo: 'ITEM_AGREGADO', label: 'Agregados', valor: e.ITEM_AGREGADO ?? 0 },
      { tipo: 'ITEM_ELIMINADO', label: 'Eliminados', valor: e.ITEM_ELIMINADO ?? 0 },
      { tipo: 'ENVIO_ACTUALIZADO', label: 'Envíos', valor: e.ENVIO_ACTUALIZADO ?? 0 },
    ];
  });

  readonly maxClics = computed(() =>
    Math.max(0, ...(this.s()?.serieClics ?? []).map((p) => p.clics)),
  );
  readonly ultimoClics = computed(() => this.s()?.serieClics.at(-1)?.clics ?? 0);
  readonly primerMinuto = computed(() => this.s()?.serieClics[0]?.minuto ?? null);
  readonly ultimoMinuto = computed(() => this.s()?.serieClics.at(-1)?.minuto ?? null);
  readonly maxVistas = computed(() =>
    Math.max(1, ...(this.s()?.productosMasVistos ?? []).map((p) => p.vistas)),
  );

  /** Barras finas, extremo superior redondeado (4px) y anclado a la base. */
  readonly barras = computed<Barra[]>(() => {
    const serie = this.s()?.serieClics ?? [];
    if (serie.length === 0) return [];
    const slot = CHART_W / serie.length;
    const w = Math.max(4, Math.min(24, slot - 2));
    const max = Math.max(1, this.maxClics());
    return serie.map((p, i) => {
      const x = slot * i + slot / 2;
      const h = (p.clics / max) * (CHART_H - 8);
      return { minuto: p.minuto, clics: p.clics, x, slot, path: barPath(x - w / 2, w, h) };
    });
  });

  ngOnInit(): void {
    this.metricas.start();
  }

  ngOnDestroy(): void {
    this.metricas.stop();
  }
}

interface Barra {
  minuto: string;
  clics: number;
  x: number;
  slot: number;
  path: string;
}

function barPath(x: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  const y = CHART_H - h;
  return `M${x},${CHART_H}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${CHART_H}Z`;
}
