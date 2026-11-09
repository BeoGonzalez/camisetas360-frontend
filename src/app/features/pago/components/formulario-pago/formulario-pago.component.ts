import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PagoService } from '../../../../core/services/pago.service';
import {
  IniciarPagoRequest,
  PagoError,
} from '../../../../core/models/pago.model';
import {
  cvvValidator,
  detectarMarcaTarjeta,
  expiracionFormGroupValidator,
  formatearPan,
  luhnValidator,
} from '../../../../core/validators/tarjeta.validators';

@Component({
  selector: 'app-formulario-pago',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-xl px-4 py-8">
      <!-- Encabezado y Resumen de Orden -->
      <div class="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Pasarela Segura Webpay Plus
            </span>
            <h1 class="mt-2 text-2xl font-extrabold text-slate-800">Finalizar Pago</h1>
          </div>
          <div class="text-right">
            <span class="text-xs uppercase tracking-wider text-slate-400">Total a pagar</span>
            <p class="text-2xl font-black text-blue-600">
              {{ monto() | currency:'CLP':'symbol-narrow':'1.0-0' }}
            </p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div>
            <span class="font-medium text-slate-400">Orden ID:</span>
            <code class="ml-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">{{ ordenId() }}</code>
          </div>
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Cifrado TLS 256-bit</span>
          </div>
        </div>
      </div>

      <!-- Alertas de Error y Antifraude Accesibles -->
      @if (error()) {
        <div
          role="alert"
          aria-live="polite"
          [class]="error()?.esBloqueoFraude
            ? 'border-red-300 bg-red-50 text-red-900'
            : error()?.esNoDisponible
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-red-200 bg-red-50 text-red-800'"
          class="mb-6 rounded-2xl border p-5 shadow-sm">
          <div class="flex items-start gap-3">
            <div class="mt-0.5 flex-shrink-0">
              @if (error()?.esBloqueoFraude) {
                <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              } @else {
                <svg class="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            </div>
            <div class="flex-1">
              <h3 class="font-bold">
                @if (error()?.esBloqueoFraude) {
                  Bloqueo Preventivo Antifraude (Código 429)
                } @else if (error()?.esNoDisponible) {
                  Servicio No Disponible (503)
                } @else {
                  Error al Procesar el Pago
                }
              </h3>
              <p class="mt-1 text-sm leading-relaxed">{{ error()?.mensaje }}</p>

              @if (error()?.esBloqueoFraude) {
                <div class="mt-3 rounded-lg bg-red-100/70 p-3 text-xs text-red-950">
                  <p class="font-semibold">Métricas de seguridad:</p>
                  <p>Intentos detectados: {{ error()?.intentosDetectados || 4 }} en ventana de {{ error()?.ventanaSegundos || 10 }}s.</p>
                  <p class="mt-1 italic">Por motivos de seguridad, los pagos con esta tarjeta quedan suspendidos temporalmente.</p>
                </div>
              }

              @if (error()?.esNoDisponible) {
                <div class="mt-4">
                  <button
                    type="button"
                    (click)="limpiarError()"
                    class="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700">
                    Reintentar ahora
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Formulario Reactivo de Pago -->
      <form
        [formGroup]="pagoForm"
        (ngSubmit)="iniciarPago()"
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        
        <!-- Tarjeta Visual Interactiva -->
        <div class="mb-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 p-5 text-white shadow-md">
          <div class="flex items-center justify-between">
            <div class="h-7 w-10 rounded bg-amber-400/80"></div>
            <span class="rounded bg-white/10 px-2.5 py-0.5 text-xs font-bold tracking-widest uppercase">
              {{ marcaDetectada() }}
            </span>
          </div>

          <div class="mt-6 font-mono text-lg tracking-widest">
            {{ panVisual() }}
          </div>

          <div class="mt-4 flex items-center justify-between text-xs text-slate-300">
            <div>
              <span class="block text-[10px] text-slate-400 uppercase">Titular</span>
              <span class="font-semibold uppercase tracking-wider">
                {{ pagoForm.get('nombreTitular')?.value || 'NOMBRE Y APELLIDO' }}
              </span>
            </div>
            <div>
              <span class="block text-[10px] text-slate-400 uppercase">Vence</span>
              <span class="font-semibold tracking-wider">
                {{ expVisual() }}
              </span>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <!-- Número de Tarjeta -->
          <div>
            <label for="numeroTarjeta" class="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Número de Tarjeta (16 dígitos)
            </label>
            <div class="relative mt-1">
              <input
                id="numeroTarjeta"
                type="text"
                formControlName="numeroTarjeta"
                (input)="onPanInput($event)"
                placeholder="4532 0151 1283 0366"
                maxlength="19"
                autocomplete="cc-number"
                [class.border-red-500]="isFieldInvalid('numeroTarjeta')"
                class="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm tracking-wider text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <div class="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <span class="text-xs font-bold text-slate-400">{{ marcaDetectada() }}</span>
              </div>
            </div>
            @if (isFieldInvalid('numeroTarjeta')) {
              <p class="mt-1 text-xs text-red-600">
                @if (pagoForm.get('numeroTarjeta')?.hasError('required')) {
                  El número de tarjeta es obligatorio.
                } @else if (pagoForm.get('numeroTarjeta')?.hasError('luhnInvalido')) {
                  Número de tarjeta inválido (falla verificación Luhn).
                } @else {
                  Debe contener 16 dígitos numéricos.
                }
              </p>
            }
          </div>

          <!-- Nombre del Titular -->
          <div>
            <label for="nombreTitular" class="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Nombre del Titular
            </label>
            <input
              id="nombreTitular"
              type="text"
              formControlName="nombreTitular"
              placeholder="Ej. Juan Pérez"
              autocomplete="cc-name"
              class="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <!-- Fecha de Expiración y CVV -->
          <div class="grid grid-cols-3 gap-3">
            <!-- Mes -->
            <div>
              <label for="mesVencimiento" class="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Mes
              </label>
              <select
                id="mesVencimiento"
                formControlName="mesVencimiento"
                autocomplete="cc-exp-month"
                [class.border-red-500]="isFieldInvalid('mesVencimiento')"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600">
                <option value="" disabled selected>Mes</option>
                @for (m of meses; track m) {
                  <option [value]="m">{{ m < 10 ? '0' + m : m }}</option>
                }
              </select>
            </div>

            <!-- Año -->
            <div>
              <label for="anioVencimiento" class="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Año
              </label>
              <select
                id="anioVencimiento"
                formControlName="anioVencimiento"
                autocomplete="cc-exp-year"
                [class.border-red-500]="isFieldInvalid('anioVencimiento')"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600">
                <option value="" disabled selected>Año</option>
                @for (a of anios; track a) {
                  <option [value]="a">{{ a }}</option>
                }
              </select>
            </div>

            <!-- CVV -->
            <div>
              <label for="cvv" class="block text-xs font-bold uppercase tracking-wider text-slate-700">
                CVV
              </label>
              <input
                id="cvv"
                type="password"
                formControlName="cvv"
                placeholder="123"
                maxlength="4"
                autocomplete="cc-csc"
                [class.border-red-500]="isFieldInvalid('cvv')"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-mono text-sm tracking-widest text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <!-- Validaciones de Grupo (Expiración) -->
          @if (pagoForm.hasError('tarjetaExpirada') && (pagoForm.get('mesVencimiento')?.touched || pagoForm.get('anioVencimiento')?.touched)) {
            <p class="text-xs text-red-600">
              La fecha de expiración ingresada ya está vencida.
            </p>
          }

          @if (isFieldInvalid('cvv')) {
            <p class="text-xs text-red-600">
              El CVV debe contener 3 o 4 dígitos numéricos.
            </p>
          }
        </div>

        <!-- Botón de Envío -->
        <div class="mt-8">
          <button
            type="submit"
            id="btnPagar"
            [disabled]="pagoForm.invalid || procesando()"
            [class]="pagoForm.invalid || procesando()
              ? 'cursor-not-allowed bg-slate-300 text-slate-500'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]'"
            class="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold transition-all shadow-sm">
            @if (procesando()) {
              <svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <span>Verificando transacción...</span>
            } @else {
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Pagar {{ monto() | currency:'CLP':'symbol-narrow':'1.0-0' }}</span>
            }
          </button>
        </div>

        <!-- Enlaces Secundarios -->
        <div class="mt-4 flex items-center justify-between text-xs text-slate-500">
          <a routerLink="/carrito" class="font-medium text-slate-600 hover:text-blue-600 transition">
            &larr; Volver al Carrito
          </a>
          <a [routerLink]="['/pago/historial', ordenId()]" class="font-medium text-blue-600 hover:underline">
            Ver historial de esta orden
          </a>
        </div>
      </form>
    </div>
  `,
})
export class FormularioPagoComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pagoService = inject(PagoService);

  readonly ordenId = signal<string>('');
  readonly monto = signal<number>(15990);
  readonly procesando = signal<boolean>(false);
  readonly error = signal<PagoError | null>(null);

  readonly meses = Array.from({ length: 12 }, (_, i) => i + 1);
  readonly anios = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i);

  pagoForm!: FormGroup;

  /** Marca detectada en tiempo real según el BIN */
  readonly marcaDetectada = signal<string>('DESCONOCIDA');

  readonly panVisual = computed<string>(() => {
    const raw = this.pagoForm?.get('numeroTarjeta')?.value;
    if (!raw) return '•••• •••• •••• ••••';
    const formatted = formatearPan(raw);
    return formatted || '•••• •••• •••• ••••';
  });

  readonly expVisual = computed<string>(() => {
    const mes = this.pagoForm?.get('mesVencimiento')?.value;
    const anio = this.pagoForm?.get('anioVencimiento')?.value;
    if (!mes && !anio) return 'MM/AA';
    const mStr = mes ? (mes < 10 ? '0' + mes : mes) : 'MM';
    const aStr = anio ? String(anio).slice(-2) : 'AA';
    return `${mStr}/${aStr}`;
  });

  ngOnInit(): void {
    const paramOrdenId = this.route.snapshot.paramMap.get('ordenId');
    const queryMonto = this.route.snapshot.queryParamMap.get('monto');

    if (paramOrdenId) {
      this.ordenId.set(paramOrdenId);
    } else {
      // Generar UUID si no viene por URL para permitir pruebas directas
      this.ordenId.set(crypto.randomUUID());
    }

    if (queryMonto && !isNaN(Number(queryMonto))) {
      this.monto.set(Number(queryMonto));
    }

    this.initForm();
  }

  private initForm(): void {
    this.pagoForm = this.fb.group(
      {
        numeroTarjeta: [
          '',
          [Validators.required, luhnValidator()],
        ],
        nombreTitular: ['', [Validators.required, Validators.minLength(3)]],
        mesVencimiento: ['', [Validators.required]],
        anioVencimiento: ['', [Validators.required]],
        cvv: ['', [Validators.required, cvvValidator()]],
      },
      {
        validators: [expiracionFormGroupValidator('mesVencimiento', 'anioVencimiento')],
      }
    );
  }

  onPanInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/[\s-]/g, '');
    const formatted = formatearPan(cleaned);
    this.pagoForm.get('numeroTarjeta')?.setValue(formatted, { emitEvent: false });
    this.marcaDetectada.set(detectarMarcaTarjeta(cleaned));
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.pagoForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  limpiarError(): void {
    this.error.set(null);
  }

  iniciarPago(): void {
    if (this.pagoForm.invalid || this.procesando()) {
      return;
    }

    this.procesando.set(true);
    this.error.set(null);

    const formVal = this.pagoForm.value;
    const req: IniciarPagoRequest = {
      ordenId: this.ordenId(),
      monto: this.monto(),
      numeroTarjeta: (formVal.numeroTarjeta || '').replace(/[\s-]/g, ''),
      cvv: String(formVal.cvv).trim(),
      mesVencimiento: Number(formVal.mesVencimiento),
      anioVencimiento: Number(formVal.anioVencimiento),
      nombreTitular: formVal.nombreTitular?.trim(),
    };

    // SEGURIDAD PCI: Limpiar el formulario y memoria sensible de inmediato
    this.pagoService.iniciarPago(req).subscribe({
      next: (response) => {
        this.pagoForm.reset();
        this.procesando.set(false);

        // Si la URL de redirección es interna o el token está presente,
        // navegamos a la pantalla de retorno del frontend
        if (response.token) {
          this.router.navigate(['/pago/retorno'], {
            queryParams: { token_ws: response.token },
          });
        } else if (response.urlRedireccion) {
          window.location.href = response.urlRedireccion;
        }
      },
      error: (err: PagoError) => {
        // SEGURIDAD: Limpiar datos de tarjeta incluso ante error
        this.pagoForm.get('cvv')?.reset();
        this.procesando.set(false);
        this.error.set(err);
      },
    });
  }
}
