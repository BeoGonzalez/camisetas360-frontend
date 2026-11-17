import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, switchMap, tap } from 'rxjs';
import { CatalogService } from '../../core/services/catalog.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { KIT_TYPE_LABEL, Product } from '../../core/models/product.model';
import { ClpPipe } from '../../shared/pipes/clp.pipe';
import { slug } from './catalog.component';
import { ApiError } from '../../core/http/api-error';
import { CANTIDAD_MAXIMA_POR_SKU } from '../../core/models/cart.model';
import { ApiErrorComponent } from '../../shared/components/api-error/api-error.component';
import { RecommendationsComponent } from '../recommendations/recommendations.component';
import { ProductImageComponent } from '../../shared/components/product-image/product-image.component';

/**
 * Detalle de producto: GET /api/v1/catalog/products/{sku}.
 * Esta llamada registra la visita en el backend, por eso se hace solo al abrir esta vista.
 */
@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    ClpPipe,
    RouterLink,
    ApiErrorComponent,
    RecommendationsComponent,
    ProductImageComponent,
  ],
  template: `
    <nav class="mb-8" aria-label="Migas de pan">
      <a
        routerLink="/catalog"
        [queryParams]="volverA()"
        class="album-caps text-[11px] text-slate-700 underline-offset-[6px] hover:text-ink hover:underline"
        >← Volver al álbum</a
      >
    </nav>

    @if (loading()) {
      <div class="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" aria-busy="true">
        <div class="album-slot aspect-[4/5] animate-pulse"></div>
        <div class="space-y-4">
          <div class="h-12 w-3/4 animate-pulse bg-paper-2"></div>
          <div class="h-5 w-1/2 animate-pulse bg-paper-2"></div>
          <div class="h-12 w-1/3 animate-pulse bg-paper-2"></div>
        </div>
      </div>
    } @else if (error()) {
      <div class="max-w-md">
        <app-api-error [error]="error()" title="No se pudo cargar el producto" (retry)="reload()" />
      </div>
    } @else if (product(); as p) {
      <article
        class="grid gap-10 border-t border-ink pt-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16"
      >
        <div class="album-slot relative aspect-[4/5] md:sticky md:top-28 md:self-start">
          <span
            class="tnum absolute left-4 top-3 z-10 text-[14px] font-bold tracking-[0.16em] text-pitch"
            >{{ p.sku }}</span
          >
          <app-product-image
            class="h-full p-10"
            [sku]="p.sku"
            [version]="p.imageVersion"
            [alt]="p.name"
          />
        </div>

        <div class="min-w-0">
          <h1 class="album-display text-[clamp(32px,3.6vw,52px)]">{{ p.name }}</h1>

          <p class="tnum mt-6 text-[40px] font-extrabold leading-none [font-stretch:110%]">
            {{ p.price | clp }}
          </p>

          @if (!auth.isLoggedIn() && p.stock > 0) {
            <!-- Visitante: comprar exige iniciar sesión o crear cuenta; luego vuelve aquí. -->
            <button
              type="button"
              (click)="comprarSinSesion(p)"
              class="album-caps mt-8 w-full bg-ink py-4 text-[12px] text-paper transition-colors hover:bg-pitch sm:w-auto sm:px-14"
            >
              Comprar
            </button>
          }
          @if (auth.isCustomer() && p.stock > 0) {
            <form
              class="mt-8 flex flex-wrap items-end gap-4"
              (submit)="$event.preventDefault(); add(p)"
            >
              <div>
                <label for="cantidad" class="album-caps block text-[10px] text-slate-700"
                  >Cantidad</label
                >
                <input
                  id="cantidad"
                  type="number"
                  min="1"
                  [max]="maxQty(p)"
                  [value]="qty()"
                  (input)="qty.set(+$any($event.target).value)"
                  class="tnum mt-2 w-24 border border-ink bg-transparent px-3 py-3 text-base focus:border-pitch focus:outline-none focus:ring-0"
                />
              </div>
              <button
                type="submit"
                [disabled]="adding() || qty() < 1 || qty() > maxQty(p)"
                class="album-caps flex-1 bg-ink px-8 py-4 text-[12px] text-paper transition-colors hover:bg-pitch disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 sm:flex-none"
              >
                {{ adding() ? 'Añadiendo…' : 'Añadir al carrito' }}
              </button>
            </form>
          }
          @if (message(); as m) {
            <p
              role="status"
              aria-live="polite"
              class="mt-4 text-sm"
              [class]="m.ok ? 'text-pitch' : 'text-red-700'"
            >
              {{ m.text }}
              @if (m.ok) {
                <a routerLink="/carrito" class="ml-1 font-semibold underline underline-offset-4"
                  >Ver carrito</a
                >
              }
            </p>
          }
          @if (p.description) {
            <p class="mt-10 max-w-[60ch] text-[17px] leading-relaxed text-slate-700">
              {{ p.description }}
            </p>
          }
          <dl class="mt-8 border-t border-ink text-sm">
            @for (f of ficha(p); track f.label) {
              <div class="flex justify-between gap-6 border-b border-rule py-3">
                <dt class="album-caps text-[10px] text-slate-600">{{ f.label }}</dt>
                <dd class="tnum text-right font-semibold">{{ f.valor }}</dd>
              </div>
            }
            <div class="flex justify-between gap-6 border-b border-rule py-3">
              <dt class="album-caps text-[10px] text-slate-600">Stock</dt>
              <dd
                class="tnum text-right font-semibold"
                [class.text-pitch]="p.stock > 0"
                [class.text-red-700]="p.stock <= 0"
              >
                {{ p.stock > 0 ? p.stock + ' unidades disponibles' : 'Sin stock' }}
              </dd>
            </div>
          </dl>
        </div>
      </article>

      @if (auth.isCustomer()) {
        <app-recommendations title="Te puede interesar" [excludeSku]="p.sku" />
      }
    }
  `,
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly product = signal<Product | null>(null);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);
  readonly qty = signal(1);
  readonly adding = signal(false);
  readonly message = signal<{ ok: boolean; text: string } | null>(null);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((p) => p.get('sku') ?? ''),
        tap(() => this.startLoading()),
        switchMap((sku) => this.catalog.getProduct(sku)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (p) => this.done(p), error: (e: ApiError) => this.fail(e) });
  }

  reload(): void {
    const sku = this.route.snapshot.paramMap.get('sku') ?? '';
    this.startLoading();
    this.catalog
      .getProduct(sku)
      .subscribe({ next: (p) => this.done(p), error: (e: ApiError) => this.fail(e) });
  }

  /** Volver a la página del álbum de este equipo. */
  volverA(): Record<string, string> {
    const team = this.product()?.team;
    return team ? { equipo: slug(team) } : {};
  }

  ficha(p: Product): { label: string; valor: string }[] {
    return [
      { label: 'Equipo', valor: p.team ?? '—' },
      { label: 'Tipo', valor: p.kitType ? KIT_TYPE_LABEL[p.kitType] : p.category },
      { label: 'Liga', valor: p.league ?? '—' },
      { label: 'Código', valor: p.sku },
    ];
  }

  maxQty(p: Product): number {
    return Math.min(p.stock, CANTIDAD_MAXIMA_POR_SKU);
  }

  /** Sin sesión: al login (o a crear cuenta) y de vuelta a esta camiseta. */
  comprarSinSesion(p: Product): void {
    this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl: `/catalog/${p.sku}`, motivo: 'comprar' },
    });
  }

  add(p: Product): void {
    this.adding.set(true);
    this.message.set(null);
    this.cart.addItem(p, this.qty()).subscribe({
      next: () => {
        this.adding.set(false);
        this.message.set({ ok: true, text: 'Producto añadido al carrito.' });
      },
      error: (e: ApiError) => {
        this.adding.set(false);
        this.message.set({ ok: false, text: e.message });
      },
    });
  }

  private startLoading(): void {
    this.loading.set(true);
    this.error.set(null);
    this.message.set(null);
  }

  private done(p: Product): void {
    this.product.set(p);
    this.qty.set(1);
    this.loading.set(false);
  }

  private fail(e: ApiError): void {
    this.error.set(e);
    this.loading.set(false);
  }
}
