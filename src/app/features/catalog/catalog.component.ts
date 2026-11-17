import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { KIT_TYPES, KIT_TYPE_LABEL, Product } from '../../core/models/product.model';
import { ApiError } from '../../core/http/api-error';
import { ApiErrorComponent } from '../../shared/components/api-error/api-error.component';
import { ProductImageComponent } from '../../shared/components/product-image/product-image.component';
import { ClpPipe } from '../../shared/pipes/clp.pipe';
import { RecommendationsComponent } from '../recommendations/recommendations.component';

/** Una página del álbum: un equipo (o las camisetas sin club) con sus casilleros. */
interface PaginaAlbum {
  key: string;
  titulo: string;
  liga: string | null;
  productos: Product[];
}

const SIN_EQUIPO = 'otras-camisetas';
const STOCK_BAJO = 5;

export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function ordenTipo(p: Product): number {
  return p.kitType ? KIT_TYPES.indexOf(p.kitType) : KIT_TYPES.length;
}

/**
 * Catálogo como álbum de la temporada (GET /api/v1/catalog/products): índice de equipos y la
 * página del equipo elegido con sus casilleros numerados. La lista NO llama al detalle por
 * producto (eso registra visitas en el backend).
 */
@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [
    RouterLink,
    ApiErrorComponent,
    RecommendationsComponent,
    ProductImageComponent,
    ClpPipe,
  ],
  template: `
    @if (cartMessage(); as m) {
      <p
        role="status"
        aria-live="polite"
        class="mb-6 border px-4 py-3 text-sm"
        [class]="m.ok ? 'border-pitch text-pitch' : 'border-red-700 text-red-800'"
      >
        {{ m.text }}
      </p>
    }

    <div class="grid border-y border-ink lg:grid-cols-[minmax(260px,320px)_1fr]">
      <!-- Índice del álbum -->
      <aside
        class="flex min-w-0 flex-col border-ink bg-paper-2 px-5 py-5 sm:px-8 lg:block lg:border-r lg:py-10"
      >
        <h1 class="album-display text-[20px] sm:text-[36px] lg:text-[30px] xl:text-[32px]">
          Álbum de camisetas
        </h1>
        <p class="tnum mt-2 text-sm text-slate-700 lg:mt-4">
          {{ products().length }} camisetas · {{ equipos() }}
          {{ equipos() === 1 ? 'equipo' : 'equipos' }}
        </p>

        <form
          class="order-3 mt-4 grid grid-cols-[1fr_auto] items-end gap-4 lg:mt-8 lg:block"
          role="search"
          (submit)="$event.preventDefault()"
        >
          <div>
            <label for="buscar" class="album-caps text-[10px] text-slate-700">Buscar</label>
            <input
              id="buscar"
              type="search"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
              placeholder="Equipo, camiseta o código"
              class="mt-2 w-full border-0 border-b border-ink bg-transparent px-0 py-2 text-base focus:border-pitch focus:outline-none focus:ring-0"
            />
          </div>
          @if (categories().length > 1) {
            <div>
              <label for="categoria" class="album-caps block text-[10px] text-slate-700 lg:mt-6"
                >Categoría</label
              >
              <select
                id="categoria"
                [value]="category()"
                (change)="category.set($any($event.target).value)"
                class="mt-2 w-full border-0 border-b border-ink bg-transparent px-0 py-2 text-sm focus:outline-none focus:ring-0"
              >
                <option value="">Todas</option>
                @for (c of categories(); track c) {
                  <option [value]="c">{{ c }}</option>
                }
              </select>
            </div>
          }
        </form>

        @if (!loading() && !error() && paginas().length) {
          <nav aria-label="Índice de equipos" class="order-2 mt-4 lg:mt-8">
            <ol
              #indice
              class="-mx-5 flex overflow-x-auto px-5 lg:mx-0 lg:block lg:overflow-visible lg:px-0"
            >
              @for (pg of paginas(); track pg.key) {
                <li class="shrink-0 lg:border-t lg:border-rule">
                  <button
                    type="button"
                    (click)="abrir(pg.key)"
                    [attr.data-equipo]="pg.key"
                    [attr.aria-current]="pg.key === actual()?.key ? 'page' : null"
                    class="flex w-full flex-col items-start gap-0.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-left lg:flex-row lg:items-baseline lg:justify-between lg:gap-4 lg:whitespace-normal text-[13px] font-semibold uppercase tracking-[0.12em] transition-colors lg:border-b-0 lg:px-0 lg:py-2.5"
                    [class]="
                      pg.key === actual()?.key
                        ? 'border-pitch text-pitch'
                        : 'border-transparent text-ink hover:text-pitch'
                    "
                  >
                    <span>{{ pg.titulo }}</span>
                    <span
                      class="tnum shrink-0 whitespace-nowrap text-[11px] tracking-[0.08em] text-slate-600 lg:text-[12px]"
                      >{{ rango(pg) }}</span
                    >
                  </button>
                </li>
              }
            </ol>
          </nav>
        }
      </aside>

      <!-- Página del equipo -->
      <section class="min-w-0 px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        @if (loading()) {
          <div aria-busy="true" aria-label="Cargando el álbum">
            <div class="h-16 w-2/3 animate-pulse bg-paper-2"></div>
            <div class="mt-10 grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
              @for (s of skeletons; track s) {
                <div class="album-slot aspect-[4/5] animate-pulse"></div>
              }
            </div>
          </div>
        } @else if (error()) {
          <div class="max-w-md">
            <app-api-error
              [error]="error()"
              title="Error al cargar el catálogo"
              (retry)="loadProducts()"
            />
          </div>
        } @else if (actual(); as pg) {
          @for (p of [pg]; track p.key) {
            <div class="animate-page-turn">
              <header class="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
                <h2
                  class="album-display hyphens-auto text-[clamp(34px,8vw,112px)] [overflow-wrap:anywhere]"
                  lang="es"
                >
                  {{ pg.titulo }}
                </h2>
                <p class="album-caps pb-2 text-[11px] text-slate-700">
                  {{ pg.liga ?? 'Sin liga' }} · {{ pg.productos.length }}
                  {{ pg.productos.length === 1 ? 'camiseta' : 'camisetas' }}
                </p>
              </header>

              <div class="mt-6 grid gap-x-8 gap-y-12 sm:mt-8 sm:grid-cols-2 xl:grid-cols-3">
                @for (product of pg.productos; track product.sku) {
                  <article class="flex flex-col">
                    <div
                      class="album-slot relative aspect-[2/1] overflow-hidden sm:aspect-[4/3] xl:aspect-square"
                    >
                      <span
                        class="tnum animate-tick absolute left-3 top-2.5 z-10 text-[13px] font-bold tracking-[0.16em] text-pitch"
                        >{{ numero(product) }}</span
                      >
                      @if (product.stock > 0 && product.stock <= stockBajo) {
                        <span class="album-caps absolute right-3 top-2.5 z-10 text-[10px] text-ink"
                          >Últimas {{ product.stock }}</span
                        >
                      }
                      <app-product-image
                        class="h-full p-6"
                        [sku]="product.sku"
                        [version]="product.imageVersion"
                        [alt]="product.name"
                      />
                    </div>

                    <div
                      class="mt-4 flex items-baseline justify-between gap-4 border-b border-ink pb-2"
                    >
                      <h3 class="album-caps text-[13px]">{{ tipo(product) }}</h3>
                      <span class="tnum animate-tick text-lg font-bold">{{
                        product.price | clp
                      }}</span>
                    </div>
                    <a
                      [routerLink]="['/catalog', product.sku]"
                      class="mt-3 text-[15px] leading-snug text-ink underline-offset-4 hover:underline"
                      >{{ product.name }}</a
                    >
                    <p class="tnum animate-tick mt-1 text-sm text-slate-600">
                      {{ product.stock > 0 ? product.stock + ' disponibles' : 'Agotada' }} ·
                      {{ product.sku }}
                    </p>

                    <div class="mt-auto pt-5">
                      @if (auth.isCustomer()) {
                        <button
                          type="button"
                          (click)="addToCart(product)"
                          [disabled]="product.stock <= 0 || adding() === product.sku"
                          [attr.aria-label]="'Añadir ' + product.name + ' al carrito'"
                          class="album-caps w-full bg-ink py-3.5 text-[11px] text-paper transition-colors hover:bg-pitch disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-500 disabled:outline disabled:outline-1 disabled:outline-rule"
                        >
                          {{
                            product.stock <= 0
                              ? 'Agotado'
                              : adding() === product.sku
                                ? 'Añadiendo…'
                                : 'Añadir'
                          }}
                        </button>
                      } @else if (!auth.isLoggedIn()) {
                        <button
                          type="button"
                          (click)="comprarSinSesion(product)"
                          [disabled]="product.stock <= 0"
                          [attr.aria-label]="'Comprar ' + product.name"
                          class="album-caps w-full bg-ink py-3.5 text-[11px] text-paper transition-colors hover:bg-pitch disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-500 disabled:outline disabled:outline-1 disabled:outline-rule"
                        >
                          {{ product.stock <= 0 ? 'Agotado' : 'Comprar' }}
                        </button>
                      }
                    </div>
                  </article>
                }
              </div>
            </div>
          }
        } @else {
          <div class="py-16">
            <h2 class="album-display text-[40px]">
              {{
                products().length === 0
                  ? 'No hay productos disponibles'
                  : 'Ningún producto coincide con tu búsqueda'
              }}
            </h2>
            <p class="mt-4 max-w-md text-slate-700">
              {{
                products().length === 0
                  ? 'El álbum todavía no tiene camisetas.'
                  : 'Prueba con otro equipo, tipo de camiseta o código.'
              }}
            </p>
          </div>
        }
      </section>
    </div>

    @if (auth.isCustomer()) {
      <app-recommendations title="Recomendado para ti" fuente="modelo" />
    }
  `,
})
export class CatalogComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly cartService = inject(CartService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly products = signal<Product[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<ApiError | null>(null);
  readonly query = signal('');
  readonly category = signal('');
  readonly adding = signal<string>('');
  readonly cartMessage = signal<{ ok: boolean; text: string } | null>(null);
  /** Equipo pedido por la URL (?equipo=arsenal) o por el índice. */
  readonly equipo = signal<string | null>(null);
  readonly skeletons = [0, 1, 2];
  readonly stockBajo = STOCK_BAJO;

  readonly categories = computed(() =>
    [
      ...new Set(
        this.products()
          .map((p) => p.category)
          .filter(Boolean),
      ),
    ].sort(),
  );

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.category();
    return this.products().filter(
      (p) =>
        (!cat || p.category === cat) &&
        (!q ||
          [p.name, p.sku, p.description, p.team, p.kitType ? KIT_TYPE_LABEL[p.kitType] : null].some(
            (v) => v?.toLowerCase().includes(q),
          )),
    );
  });

  /** Orden del álbum completo: estable, no cambia al filtrar. */
  private readonly ordenAlbum = computed(() => agrupar(this.products()));

  private readonly numeros = computed(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const pg of this.ordenAlbum()) for (const p of pg.productos) m.set(p.sku, ++n);
    return m;
  });

  readonly paginas = computed(() => agrupar(this.filtered()));

  /** Equipos reales del álbum (sin contar «Otras camisetas»). */
  readonly equipos = computed(() => this.ordenAlbum().filter((p) => p.key !== SIN_EQUIPO).length);

  private readonly indice = viewChild<ElementRef<HTMLOListElement>>('indice');

  constructor() {
    // En móvil el índice es una tira horizontal: la pestaña activa se centra al pasar la página
    // (scrollLeft del contenedor, para no mover la página en vertical).
    afterRenderEffect(() => {
      const key = this.actual()?.key;
      const ol = this.indice()?.nativeElement;
      if (!key || !ol || ol.scrollWidth <= ol.clientWidth) return;
      const btn = ol.querySelector<HTMLElement>(`[data-equipo="${key}"]`);
      if (btn) ol.scrollLeft = btn.offsetLeft - (ol.clientWidth - btn.offsetWidth) / 2;
    });
  }

  readonly actual = computed<PaginaAlbum | null>(() => {
    const pgs = this.paginas();
    return pgs.find((p) => p.key === this.equipo()) ?? pgs[0] ?? null;
  });

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.equipo.set(q.get('equipo')));
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.error.set(null);
    this.catalogService
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

  /** Pasa la página: el equipo queda en la URL para compartirla o volver con atrás. */
  abrir(key: string): void {
    this.equipo.set(key);
    this.router.navigate([], { relativeTo: this.route, queryParams: { equipo: key } });
  }

  numero(p: Product): string {
    return String(this.numeros().get(p.sku) ?? 0).padStart(3, '0');
  }

  rango(pg: PaginaAlbum): string {
    const ns = pg.productos.map((p) => this.numero(p));
    return ns.length > 1 ? `${ns[0]}–${ns[ns.length - 1]}` : ns[0];
  }

  tipo(p: Product): string {
    return p.kitType ? KIT_TYPE_LABEL[p.kitType] : p.category;
  }

  /** Sin sesión: al login (o a crear cuenta) y, al volver, al detalle de la camiseta. */
  comprarSinSesion(product: Product): void {
    this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl: `/catalog/${product.sku}`, motivo: 'comprar' },
    });
  }

  addToCart(product: Product): void {
    if (product.stock <= 0) return;
    this.adding.set(product.sku);
    this.cartService.addItem(product, 1).subscribe({
      next: () => {
        this.adding.set('');
        this.cartMessage.set({ ok: true, text: `${product.name} se añadió al carrito.` });
      },
      error: (e: ApiError) => {
        this.adding.set('');
        this.cartMessage.set({ ok: false, text: e.message });
      },
    });
  }
}

function agrupar(productos: Product[]): PaginaAlbum[] {
  const porEquipo = new Map<string, PaginaAlbum>();
  for (const p of productos) {
    const titulo = p.team?.trim() || 'Otras camisetas';
    const key = p.team?.trim() ? slug(titulo) : SIN_EQUIPO;
    const pg = porEquipo.get(key) ?? { key, titulo, liga: null, productos: [] };
    pg.liga ??= p.league ?? null;
    pg.productos.push(p);
    porEquipo.set(key, pg);
  }
  return [...porEquipo.values()]
    .sort((a, b) =>
      a.key === SIN_EQUIPO ? 1 : b.key === SIN_EQUIPO ? -1 : a.titulo.localeCompare(b.titulo, 'es'),
    )
    .map((pg) => ({
      ...pg,
      productos: [...pg.productos].sort(
        (a, b) => ordenTipo(a) - ordenTipo(b) || a.name.localeCompare(b.name, 'es'),
      ),
    }));
}
