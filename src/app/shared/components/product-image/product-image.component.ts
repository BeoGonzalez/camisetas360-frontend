import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CatalogService } from '../../../core/services/catalog.service';
import { KitType } from '../../../core/models/product.model';
import { KIT_PHOTO } from './kit-photos';

/**
 * Foto de un producto, en este orden:
 * 1. La foto del backend (`version` no null). El endpoint exige Bearer, así que se descarga con
 *    HttpClient y se muestra como object URL (se libera al cambiar de foto o al destruirse).
 * 2. Si no hay o falla, la foto estática de la camiseta según equipo y tipo (`kit-photos.ts`),
 *    solo si se pasan `team` y `kitType`.
 * 3. Si tampoco hay, la silueta impresa con el texto alternativo.
 */
@Component({
  selector: 'app-product-image',
  standalone: true,
  host: { class: 'block' },
  template: `
    @if (url(); as src) {
      <img
        [src]="src"
        [alt]="alt()"
        class="h-full w-full object-contain mix-blend-multiply dark:mix-blend-normal"
      />
    } @else if (fotoEstatica(); as src) {
      <img
        [src]="src"
        [alt]="alt()"
        class="h-full w-full object-contain mix-blend-multiply dark:mix-blend-normal"
        decoding="async"
        (error)="falloEstatica.set(src)"
      />
    } @else {
      <!-- Casillero sin lámina: la silueta impresa de la camiseta, como en un álbum. -->
      <div
        class="flex h-full w-full flex-col items-center justify-center gap-3 text-slot"
        role="img"
        [attr.aria-label]="loading() ? 'Cargando foto' : 'Imagen no disponible'"
      >
        <svg
          class="h-1/2 max-h-40 w-auto"
          viewBox="0 0 120 120"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
          aria-hidden="true"
          [class.animate-pulse]="loading()"
        >
          <path
            d="M44 14c3 7 9 11 16 11s13-4 16-11l26 12 12 26-17 9-6-12v63H29V49l-6 12-17-9 12-26z"
          />
          <path d="M44 14c4 3 10 5 16 5s12-2 16-5" />
        </svg>
        <span class="sr-only">{{ loading() ? 'Cargando…' : 'Imagen no disponible' }}</span>
      </div>
    }
  `,
})
export class ProductImageComponent {
  private readonly catalog = inject(CatalogService);

  readonly sku = input.required<string>();
  readonly version = input<number | null | undefined>(null);
  readonly alt = input('');
  /** Equipo y tipo: habilitan la foto estática cuando el backend no tiene foto. */
  readonly team = input<string | null | undefined>(null);
  readonly kitType = input<KitType | null | undefined>(null);

  private readonly buscarFoto = inject(KIT_PHOTO);

  readonly url = signal<string | null>(null);
  readonly loading = signal(false);
  /** Foto estática que falló al cargar; no se reintenta. */
  readonly falloEstatica = signal<string | null>(null);

  readonly fotoEstatica = computed(() => {
    if (this.loading()) return null;
    const src = this.buscarFoto(this.team(), this.kitType());
    return src && src !== this.falloEstatica() ? src : null;
  });

  constructor() {
    effect((onCleanup) => {
      const sku = this.sku();
      const version = this.version();
      this.url.set(null);
      if (version == null) {
        this.loading.set(false);
        return;
      }
      this.loading.set(true);
      let objectUrl: string | null = null;
      const sub = this.catalog.getProductImage(sku, version).subscribe({
        next: (blob) => {
          objectUrl = URL.createObjectURL(blob);
          this.url.set(objectUrl);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      onCleanup(() => {
        sub.unsubscribe();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      });
    });
  }
}
