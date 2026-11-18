import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClpPipe } from '../../shared/pipes/clp.pipe';
import { CatalogService } from '../../core/services/catalog.service';
import { ProductAdminService } from '../../core/services/product-admin.service';
import { KIT_TYPES, KIT_TYPE_LABEL, KitType, Product } from '../../core/models/product.model';
import { ApiError } from '../../core/http/api-error';
import { ApiErrorComponent } from '../../shared/components/api-error/api-error.component';
import { ProductImageComponent } from '../../shared/components/product-image/product-image.component';
import { ProductoFormComponent, ProductoPreset } from './producto-form.component';
import { TeamLogoComponent } from '../../shared/components/team-logo/team-logo.component';

type Estado = '' | 'sin-stock' | 'stock-bajo' | 'sin-foto';

interface GrupoEquipo {
  team: string | null;
  league: string | null;
  productos: Product[];
  /** Tipos de camiseta que el equipo todavía no tiene. */
  faltantes: KitType[];
}

const STOCK_BAJO = 5;
const SIN_EQUIPO = '￿'; // ordena el grupo "sin equipo" al final

/**
 * Gestión de camisetas (CATALOG_MANAGER / ADMIN): ver, crear, editar y eliminar productos,
 * con su foto y stock. Agrupa por equipo y muestra qué tipo (local/visitante/alternativa) falta.
 */
@Component({
  selector: 'app-productos-admin',
  standalone: true,
  imports: [
    ClpPipe,
    ApiErrorComponent,
    ProductImageComponent,
    ProductoFormComponent,
    TeamLogoComponent,
  ],
  template: `
    <div class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="album-display text-[clamp(40px,6vw,76px)]">Gestión de camisetas</h1>
          <p class="mt-1 text-sm text-slate-500">
            Fotos, datos y stock de cada camiseta local, visitante y alternativa.
          </p>
        </div>
        <button
          type="button"
          (click)="nuevo()"
          class="album-caps bg-ink px-6 py-3.5 text-[11px] text-paper transition-colors hover:bg-pitch"
        >
          + Nueva camiseta
        </button>
      </header>

      @if (aviso(); as a) {
        <p
          role="status"
          aria-live="polite"
          class="rounded-xl px-4 py-3 text-sm"
          [class]="a.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'"
        >
          {{ a.texto }}
        </p>
      }

      @if (loading()) {
        <div class="grid gap-4 sm:grid-cols-4" aria-busy="true" aria-label="Cargando productos">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white"></div>
          }
        </div>
      } @else if (error()) {
        <app-api-error [error]="error()" title="Error al cargar los productos" (retry)="cargar()" />
      } @else {
        <!-- Resumen -->
        <section class="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumen del catálogo">
          @for (k of kpis(); track k.label) {
            <div class="border-t border-ink pt-3">
              <p class="album-caps text-[10px] text-slate-600">{{ k.label }}</p>
              <p class="tnum mt-2 text-4xl font-extrabold [font-stretch:110%]" [class]="k.color">
                {{ k.valor }}
              </p>
            </div>
          }
        </section>

        <!-- Filtros -->
        <form class="grid gap-3 sm:grid-cols-4" role="search" (submit)="$event.preventDefault()">
          <div class="sm:col-span-2">
            <label for="admin-buscar" class="album-caps block text-[10px] text-slate-700"
              >Buscar</label
            >
            <input
              id="admin-buscar"
              type="search"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
              placeholder="Equipo, nombre o SKU"
              class="mt-2 w-full border-0 border-b border-ink bg-transparent px-0 py-2.5 text-sm focus:border-pitch focus:outline-none focus:ring-0"
            />
          </div>
          <div>
            <label for="admin-liga" class="album-caps block text-[10px] text-slate-700">Liga</label>
            <select
              id="admin-liga"
              [value]="liga()"
              (change)="liga.set($any($event.target).value)"
              class="mt-2 w-full border-0 border-b border-ink bg-transparent px-0 py-2.5 text-sm focus:border-pitch focus:outline-none focus:ring-0"
            >
              <option value="">Todas</option>
              @for (l of ligas(); track l) {
                <option [value]="l">{{ l }}</option>
              }
            </select>
          </div>
          <div>
            <label for="admin-estado" class="album-caps block text-[10px] text-slate-700"
              >Estado</label
            >
            <select
              id="admin-estado"
              [value]="estado()"
              (change)="estado.set($any($event.target).value)"
              class="mt-2 w-full border-0 border-b border-ink bg-transparent px-0 py-2.5 text-sm focus:border-pitch focus:outline-none focus:ring-0"
            >
              <option value="">Todos</option>
              <option value="sin-stock">Sin stock</option>
              <option value="stock-bajo">Stock bajo (≤ 5)</option>
              <option value="sin-foto">Sin foto</option>
            </select>
          </div>
        </form>

        @for (g of grupos(); track g.team ?? '') {
          <section
            class="border-t border-ink pt-6"
            [attr.aria-label]="g.team ?? 'Sin equipo asignado'"
          >
            <header class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 class="album-display flex items-center gap-3 text-[clamp(32px,4vw,52px)]">
                @if (g.team) {
                  <app-team-logo class="h-[0.9em] w-[0.9em]" [team]="g.team" />
                }
                <span>{{ g.team ?? 'Sin equipo asignado' }}</span>
              </h2>
              <p class="album-caps text-[10px] text-slate-700">
                @if (g.league) {
                  {{ g.league }} ·
                }
                {{ g.productos.length }} {{ g.productos.length === 1 ? 'camiseta' : 'camisetas' }}
              </p>
            </header>

            <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              @for (p of g.productos; track p.sku) {
                <li class="flex flex-col">
                  <div class="album-slot relative aspect-[4/3]">
                    <app-product-image
                      class="h-full p-6"
                      [sku]="p.sku"
                      [version]="p.imageVersion"
                      [alt]="p.name"
                    />
                    @if (p.kitType) {
                      <span
                        class="album-caps absolute left-3 top-3 z-10 px-2 py-1 text-[10px]"
                        [class]="kitColor[p.kitType]"
                        >{{ kitLabel[p.kitType] }}</span
                      >
                    }
                  </div>
                  <div class="flex flex-1 flex-col pt-4">
                    <h3 class="font-bold text-slate-800">{{ p.name }}</h3>
                    <p class="mt-0.5 font-mono text-xs text-slate-500">{{ p.sku }}</p>
                    <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt class="text-xs text-slate-500">Precio</dt>
                        <dd class="font-semibold text-slate-800">
                          {{ p.price | clp }}
                        </dd>
                      </div>
                      <div>
                        <dt class="text-xs text-slate-500">Stock</dt>
                        <dd
                          class="font-semibold"
                          [class.text-red-700]="p.stock <= 0"
                          [class.text-amber-700]="p.stock > 0 && p.stock <= stockBajo"
                          [class.text-emerald-700]="p.stock > stockBajo"
                        >
                          {{ p.stock <= 0 ? 'Sin stock' : p.stock + ' u.' }}
                        </dd>
                      </div>
                    </dl>
                    <div class="mt-auto flex gap-2 pt-4">
                      <button
                        type="button"
                        (click)="editar(p)"
                        [attr.aria-label]="'Editar ' + p.name"
                        class="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        (click)="confirmarEliminar.set(p)"
                        [attr.aria-label]="'Eliminar ' + p.name"
                        class="flex-1 rounded-lg border border-red-200 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </li>
              }
              @for (k of g.faltantes; track k) {
                <li>
                  <button
                    type="button"
                    (click)="nuevo({ team: g.team!, kitType: k, league: g.league })"
                    class="flex h-full min-h-44 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-500 hover:border-blue-500 hover:text-blue-600"
                  >
                    <span class="text-2xl leading-none" aria-hidden="true">+</span>
                    <span class="font-bold">Agregar camiseta {{ kitLabel[k].toLowerCase() }}</span>
                  </button>
                </li>
              }
            </ul>
          </section>
        } @empty {
          <div class="py-16 text-center">
            <h2 class="text-lg font-semibold text-slate-600">
              {{
                products().length === 0
                  ? 'Todavía no hay camisetas'
                  : 'Nada coincide con los filtros'
              }}
            </h2>
            <p class="mt-1 text-sm text-slate-400">
              {{
                products().length === 0
                  ? 'Crea la primera con “Nueva camiseta”.'
                  : 'Prueba con otro término, liga o estado.'
              }}
            </p>
          </div>
        }
      }
    </div>

    @if (formulario(); as f) {
      <app-producto-form
        [product]="f.product"
        [preset]="f.preset"
        [ligas]="ligas()"
        (saved)="guardado($event, f.product === null)"
        (closed)="formulario.set(null)"
      />
    }

    @if (confirmarEliminar(); as p) {
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        (click)="cancelarEliminar()"
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="eliminar-titulo"
          aria-describedby="eliminar-desc"
          class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <h2 id="eliminar-titulo" class="text-lg font-extrabold text-slate-800">
            ¿Eliminar esta camiseta?
          </h2>
          <p id="eliminar-desc" class="mt-2 text-sm text-slate-600">
            Se eliminará <strong>{{ p.name }}</strong> ({{ p.sku }}) junto con su foto. Esta acción
            no se puede deshacer.
          </p>
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              (click)="cancelarEliminar()"
              class="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="eliminar(p)"
              [disabled]="eliminando()"
              class="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
            >
              {{ eliminando() ? 'Eliminando…' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ProductosAdminComponent implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly admin = inject(ProductAdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly kitLabel = KIT_TYPE_LABEL;
  readonly kitColor: Record<KitType, string> = {
    LOCAL: 'bg-ink text-paper',
    VISITANTE: 'bg-paper text-ink ring-1 ring-ink',
    ALTERNATIVA: 'bg-pitch text-paper',
  };
  readonly stockBajo = STOCK_BAJO;

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);
  readonly query = signal('');
  readonly liga = signal('');
  readonly estado = signal<Estado>('');
  readonly aviso = signal<{ ok: boolean; texto: string } | null>(null);
  readonly formulario = signal<{ product: Product | null; preset: ProductoPreset | null } | null>(
    null,
  );
  readonly confirmarEliminar = signal<Product | null>(null);
  readonly eliminando = signal(false);

  readonly ligas = computed(() =>
    [
      ...new Set(
        this.products()
          .map((p) => p.league)
          .filter((l): l is string => !!l),
      ),
    ].sort(),
  );

  readonly kpis = computed(() => {
    const ps = this.products();
    return [
      { label: 'Camisetas', valor: ps.length, color: 'text-ink' },
      {
        label: 'Equipos',
        valor: new Set(ps.map((p) => p.team).filter(Boolean)).size,
        color: 'text-ink',
      },
      {
        label: 'Sin stock',
        valor: ps.filter((p) => p.stock <= 0).length,
        color: ps.some((p) => p.stock <= 0) ? 'text-red-700' : 'text-ink',
      },
      {
        label: 'Sin foto',
        valor: ps.filter((p) => p.imageVersion == null).length,
        color: 'text-pitch',
      },
    ];
  });

  readonly grupos = computed<GrupoEquipo[]>(() => {
    const q = this.query().trim().toLowerCase();
    const liga = this.liga();
    const estado = this.estado();
    const filtrados = this.products().filter(
      (p) =>
        (!liga || p.league === liga) &&
        (!q || [p.team, p.name, p.sku].some((v) => v?.toLowerCase().includes(q))) &&
        cumpleEstado(p, estado),
    );
    // Solo se ofrecen "faltantes" sin filtros de estado: con "sin stock" no tendría sentido.
    const mostrarFaltantes = !estado;

    const porEquipo = new Map<string, Product[]>();
    for (const p of filtrados) {
      const key = p.team?.trim() || SIN_EQUIPO;
      porEquipo.set(key, [...(porEquipo.get(key) ?? []), p]);
    }
    return [...porEquipo.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([key, productos]) => {
        const team = key === SIN_EQUIPO ? null : key;
        const tipos = new Set(productos.map((p) => p.kitType));
        return {
          team,
          league: productos.find((p) => p.league)?.league ?? null,
          productos: [...productos].sort(porTipo),
          faltantes: team && mostrarFaltantes ? KIT_TYPES.filter((k) => !tipos.has(k)) : [],
        };
      });
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.catalog
      .getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.products.set(data);
          this.loading.set(false);
        },
        error: (e: ApiError) => {
          this.error.set(e);
          this.loading.set(false);
        },
      });
  }

  nuevo(preset: ProductoPreset | null = null): void {
    this.aviso.set(null);
    this.formulario.set({ product: null, preset });
  }

  editar(product: Product): void {
    this.aviso.set(null);
    this.formulario.set({ product, preset: null });
  }

  /** El formulario avisa cada cambio confirmado por el backend (datos y luego foto). */
  guardado(product: Product, esAlta: boolean): void {
    const existe = this.products().some((p) => p.sku === product.sku);
    this.products.update((ps) =>
      existe ? ps.map((p) => (p.sku === product.sku ? product : p)) : [...ps, product],
    );
    this.aviso.set({
      ok: true,
      texto: esAlta ? `Se creó ${product.name}.` : `Se guardó ${product.name}.`,
    });
  }

  cancelarEliminar(): void {
    if (!this.eliminando()) this.confirmarEliminar.set(null);
  }

  eliminar(product: Product): void {
    this.eliminando.set(true);
    this.admin
      .remove(product.sku)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.products.update((ps) => ps.filter((p) => p.sku !== product.sku));
          this.eliminando.set(false);
          this.confirmarEliminar.set(null);
          this.aviso.set({ ok: true, texto: `Se eliminó ${product.name}.` });
        },
        error: (e: ApiError) => {
          this.eliminando.set(false);
          this.confirmarEliminar.set(null);
          if (e.kind === 'not_found') {
            this.products.update((ps) => ps.filter((p) => p.sku !== product.sku));
          }
          this.aviso.set({ ok: false, texto: e.message });
        },
      });
  }
}

function cumpleEstado(p: Product, estado: Estado): boolean {
  switch (estado) {
    case 'sin-stock':
      return p.stock <= 0;
    case 'stock-bajo':
      return p.stock > 0 && p.stock <= STOCK_BAJO;
    case 'sin-foto':
      return p.imageVersion == null;
    default:
      return true;
  }
}

function porTipo(a: Product, b: Product): number {
  const orden = (p: Product) => (p.kitType ? KIT_TYPES.indexOf(p.kitType) : KIT_TYPES.length);
  return orden(a) - orden(b) || a.name.localeCompare(b.name, 'es');
}
