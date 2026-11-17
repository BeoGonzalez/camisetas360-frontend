import { Component, effect, inject, input, signal } from '@angular/core';
import { CatalogService } from '../../../core/services/catalog.service';

/**
 * Foto de un producto. El endpoint exige Bearer, así que se descarga con HttpClient y se
 * muestra como object URL (se libera al cambiar de foto o destruir el componente).
 * Sin foto (`version` null) o si falla la descarga, muestra el texto alternativo.
 */
@Component({
  selector: 'app-product-image',
  standalone: true,
  host: { class: 'block' },
  template: `
    @if (url(); as src) {
      <img [src]="src" [alt]="alt()" class="h-full w-full object-contain" />
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

  readonly url = signal<string | null>(null);
  readonly loading = signal(false);

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
