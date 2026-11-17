import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { SKU_PATTERN } from '../../core/services/catalog.service';
import {
  IMAGE_TYPES,
  ProductAdminService,
  validateImage,
} from '../../core/services/product-admin.service';
import {
  KIT_TYPES,
  KIT_TYPE_LABEL,
  KitType,
  Product,
  ProductUpdateRequest,
} from '../../core/models/product.model';
import { ApiError } from '../../core/http/api-error';
import { ProductImageComponent } from '../../shared/components/product-image/product-image.component';

/** Valores iniciales al agregar la camiseta que le falta a un equipo. */
export interface ProductoPreset {
  team?: string;
  kitType?: KitType;
  league?: string | null;
}

/**
 * Diálogo para crear o editar una camiseta (datos + foto). Primero guarda los datos y después
 * la foto: si la foto falla, los datos ya quedaron guardados y el diálogo sigue abierto en
 * modo edición para reintentar solo la foto.
 */
@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [ReactiveFormsModule, ProductImageComponent],
  host: { '(document:keydown.escape)': 'cerrar()' },
  template: `
    <div
      class="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      (click)="cerrar()"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="producto-form-titulo"
        class="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        (click)="$event.stopPropagation()"
      >
        <header
          class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"
        >
          <h2 id="producto-form-titulo" class="text-lg font-extrabold text-slate-800">
            {{ editando() ? 'Editar camiseta' : 'Nueva camiseta' }}
          </h2>
          <button
            type="button"
            (click)="cerrar()"
            class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Cerrar"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form [formGroup]="form" (ngSubmit)="guardar()" class="space-y-5 px-5 py-5" novalidate>
          <!-- Foto -->
          <fieldset class="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <legend class="sr-only">Foto</legend>
            <div class="h-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              @if (preview(); as src) {
                <img
                  [src]="src"
                  alt="Vista previa de la foto"
                  class="h-full w-full object-contain"
                />
              } @else if (editando() && !quitarFoto()) {
                <app-product-image
                  class="h-full"
                  [sku]="editando()!.sku"
                  [version]="editando()!.imageVersion"
                  [alt]="editando()!.name"
                />
              } @else {
                <div class="flex h-full items-center justify-center text-xs text-slate-400">
                  Sin foto
                </div>
              }
            </div>
            <div class="flex flex-col justify-center gap-2">
              <label for="foto" class="text-xs font-semibold text-slate-600">
                Foto de la camiseta {{ kitLabel() }}
              </label>
              <input
                #inputFoto
                id="foto"
                type="file"
                [accept]="imageTypes"
                (change)="elegirFoto($event)"
                class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-blue-600"
              />
              <p class="text-xs text-slate-500">JPG, PNG o WebP · máximo 2 MB.</p>
              @if (fotoError(); as e) {
                <p class="text-xs font-semibold text-red-700" role="alert">{{ e }}</p>
              }
              @if (archivo() || (editando()?.imageVersion != null && !quitarFoto())) {
                <button
                  type="button"
                  (click)="quitar()"
                  class="self-start text-xs font-semibold text-red-700 underline-offset-2 hover:underline"
                >
                  Quitar foto
                </button>
              }
            </div>
          </fieldset>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="team" class="block text-xs font-semibold text-slate-600">Equipo</label>
              <input
                #primerCampo
                id="team"
                formControlName="team"
                (input)="sugerirNombre()"
                autocomplete="off"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                [attr.aria-invalid]="invalido('team')"
              />
              @if (invalido('team')) {
                <p class="mt-1 text-xs text-red-700">Indica el equipo (máx. 100 caracteres).</p>
              }
            </div>
            <div>
              <label for="kitType" class="block text-xs font-semibold text-slate-600"
                >Tipo de camiseta</label
              >
              <select
                id="kitType"
                formControlName="kitType"
                (change)="sugerirNombre()"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                @for (k of kitTypes; track k) {
                  <option [value]="k">{{ kitTypeLabel[k] }}</option>
                }
              </select>
            </div>

            <div>
              <label for="sku" class="block text-xs font-semibold text-slate-600">SKU</label>
              <input
                id="sku"
                formControlName="sku"
                autocomplete="off"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm uppercase focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-500"
                [attr.aria-invalid]="invalido('sku')"
                aria-describedby="sku-ayuda"
              />
              <p id="sku-ayuda" class="mt-1 text-xs text-slate-500">
                @if (editando()) {
                  El SKU no se puede cambiar (lo usan carritos y pedidos).
                } @else if (invalido('sku')) {
                  <span class="text-red-700"
                    >Solo letras, números, punto, guion y guion bajo (máx. 64).</span
                  >
                } @else {
                  Ej.: PL-ARS-LOC-2627
                }
              </p>
            </div>
            <div>
              <label for="league" class="block text-xs font-semibold text-slate-600"
                >Liga <span class="font-normal text-slate-400">(opcional)</span></label
              >
              <input
                id="league"
                formControlName="league"
                list="ligas"
                autocomplete="off"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <datalist id="ligas">
                @for (l of ligas(); track l) {
                  <option [value]="l"></option>
                }
              </datalist>
            </div>

            <div class="sm:col-span-2">
              <label for="name" class="block text-xs font-semibold text-slate-600">Nombre</label>
              <input
                id="name"
                formControlName="name"
                autocomplete="off"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                [attr.aria-invalid]="invalido('name')"
              />
              @if (invalido('name')) {
                <p class="mt-1 text-xs text-red-700">Indica el nombre (máx. 255 caracteres).</p>
              }
            </div>

            <div>
              <label for="price" class="block text-xs font-semibold text-slate-600"
                >Precio (CLP)</label
              >
              <input
                id="price"
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                formControlName="price"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                [attr.aria-invalid]="invalido('price')"
              />
              @if (invalido('price')) {
                <p class="mt-1 text-xs text-red-700">
                  El precio debe ser un monto en pesos, entero y mayor que 0.
                </p>
              }
            </div>
            <div>
              <label for="stock" class="block text-xs font-semibold text-slate-600">Stock</label>
              <input
                id="stock"
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                formControlName="stock"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                [attr.aria-invalid]="invalido('stock')"
              />
              @if (invalido('stock')) {
                <p class="mt-1 text-xs text-red-700">El stock debe ser un entero de 0 o más.</p>
              }
            </div>

            <div>
              <label for="category" class="block text-xs font-semibold text-slate-600"
                >Categoría</label
              >
              <input
                id="category"
                formControlName="category"
                autocomplete="off"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                [attr.aria-invalid]="invalido('category')"
              />
              @if (invalido('category')) {
                <p class="mt-1 text-xs text-red-700">Indica la categoría.</p>
              }
            </div>
            <div class="sm:col-span-2">
              <label for="description" class="block text-xs font-semibold text-slate-600"
                >Descripción <span class="font-normal text-slate-400">(opcional)</span></label
              >
              <textarea
                id="description"
                formControlName="description"
                rows="2"
                maxlength="255"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              ></textarea>
            </div>
          </div>

          @if (error(); as e) {
            <p role="alert" class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {{ e }}
            </p>
          }

          <footer
            class="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end"
          >
            <button
              type="button"
              (click)="cerrar()"
              class="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [disabled]="guardando()"
              class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {{ guardando() ? 'Guardando…' : editando() ? 'Guardar cambios' : 'Crear camiseta' }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  `,
})
export class ProductoFormComponent implements OnInit {
  private readonly admin = inject(ProductAdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** Producto a editar; null = alta. */
  readonly product = input<Product | null>(null);
  readonly preset = input<ProductoPreset | null>(null);
  /** Ligas existentes (sugerencias). */
  readonly ligas = input<string[]>([]);

  /** Cada vez que el backend confirma un cambio (datos o foto). */
  readonly saved = output<Product>();
  readonly closed = output<void>();

  readonly kitTypes = KIT_TYPES;
  readonly kitTypeLabel = KIT_TYPE_LABEL;
  readonly imageTypes = IMAGE_TYPES.join(',');

  /** Producto ya guardado en el backend (puede pasar de alta a edición si falla la foto). */
  readonly editando = signal<Product | null>(null);
  readonly archivo = signal<File | null>(null);
  readonly preview = signal<string | null>(null);
  readonly quitarFoto = signal(false);
  readonly fotoError = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  private readonly primerCampo = viewChild<ElementRef<HTMLInputElement>>('primerCampo');
  private readonly inputFoto = viewChild<ElementRef<HTMLInputElement>>('inputFoto');

  readonly form = this.fb.group({
    sku: ['', [Validators.required, Validators.pattern(SKU_PATTERN)]],
    team: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    kitType: ['LOCAL' as KitType, Validators.required],
    league: ['', Validators.maxLength(100)],
    name: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(/\S/)]],
    category: [
      'Fútbol',
      [Validators.required, Validators.maxLength(255), Validators.pattern(/\S/)],
    ],
    price: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)],
    ],
    stock: [
      null as number | null,
      [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)],
    ],
    description: ['', Validators.maxLength(255)],
  });

  constructor() {
    afterNextRender(() => this.primerCampo()?.nativeElement.focus());
    this.destroyRef.onDestroy(() => this.revocarPreview());
  }

  ngOnInit(): void {
    const p = this.product();
    if (p) {
      this.editando.set(p);
      this.form.patchValue({
        sku: p.sku,
        team: p.team ?? '',
        kitType: p.kitType ?? 'LOCAL',
        league: p.league ?? '',
        name: p.name,
        category: p.category,
        price: p.price,
        stock: p.stock,
        description: p.description ?? '',
      });
      this.form.controls.sku.disable();
    } else {
      const preset = this.preset();
      this.form.patchValue({
        team: preset?.team ?? '',
        kitType: preset?.kitType ?? 'LOCAL',
        league: preset?.league ?? '',
      });
      this.sugerirNombre();
    }
  }

  kitLabel(): string {
    return KIT_TYPE_LABEL[this.form.controls.kitType.value].toLowerCase();
  }

  invalido(control: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  /** Mientras el nombre no se haya escrito a mano, se arma con equipo + tipo. */
  sugerirNombre(): void {
    const name = this.form.controls.name;
    if (name.dirty || this.editando()) return;
    const team = this.form.controls.team.value.trim();
    name.setValue(
      team ? `Camiseta ${team} ${KIT_TYPE_LABEL[this.form.controls.kitType.value]}` : '',
    );
  }

  elegirFoto(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.fotoError.set(null);
    if (!file) return;
    const invalida = validateImage(file);
    if (invalida) {
      this.fotoError.set(invalida.message);
      this.limpiarInputFoto();
      return;
    }
    this.revocarPreview();
    this.archivo.set(file);
    this.preview.set(URL.createObjectURL(file));
    this.quitarFoto.set(false);
  }

  quitar(): void {
    if (this.archivo()) {
      this.revocarPreview();
      this.archivo.set(null);
      this.limpiarInputFoto();
    } else {
      this.quitarFoto.set(true);
    }
  }

  guardar(): void {
    if (this.guardando()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set('Revisa los campos marcados.');
      return;
    }
    this.error.set(null);
    this.guardando.set(true);

    const v = this.form.getRawValue();
    const body: ProductUpdateRequest = {
      name: v.name.trim(),
      team: v.team.trim(),
      kitType: v.kitType,
      category: v.category.trim(),
      league: v.league.trim() || null,
      price: Number(v.price),
      stock: Number(v.stock),
      description: v.description.trim() || null,
    };
    const actual = this.editando();
    const datos$: Observable<Product> = actual
      ? this.admin.update(actual.sku, body)
      : this.admin.create({ sku: v.sku.trim(), ...body });

    datos$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (p) => {
        this.editando.set(p);
        this.form.controls.sku.disable();
        this.saved.emit(p);
        this.guardarFoto(p);
      },
      error: (e: ApiError) => {
        this.guardando.set(false);
        this.error.set(e.message);
      },
    });
  }

  cerrar(): void {
    if (!this.guardando()) this.closed.emit();
  }

  private guardarFoto(p: Product): void {
    const file = this.archivo();
    const foto$: Observable<Product> = file
      ? this.admin.uploadImage(p.sku, file)
      : this.quitarFoto() && p.imageVersion != null
        ? this.admin.deleteImage(p.sku)
        : of(p);
    foto$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (conFoto) => {
        if (conFoto !== p) this.saved.emit(conFoto);
        this.guardando.set(false);
        this.closed.emit();
      },
      error: (e: ApiError) => {
        this.guardando.set(false);
        this.error.set(`Los datos se guardaron, pero la foto no: ${e.message}`);
      },
    });
  }

  private limpiarInputFoto(): void {
    const input = this.inputFoto()?.nativeElement;
    if (input) input.value = '';
  }

  private revocarPreview(): void {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
    this.preview.set(null);
  }
}
