import { ClpPipe } from '../../../../shared/pipes/clp.pipe';
import { Component, OnDestroy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, switchMap } from 'rxjs';
import { PagoService } from '../../../../core/services/pago.service';
import { CheckoutTrackerService } from '../../../../core/services/checkout-tracker.service';
import { BloqueoPagoService } from '../../../../core/services/bloqueo-pago.service';
import { environment } from '../../../../../environments/environment';
import { IniciarPagoRequest, PagoError } from '../../../../core/models/pago.model';
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
  imports: [ClpPipe, CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-xl px-0 py-4 sm:px-4 sm:py-8">
      @if (!ordenValida()) {
        <div
          role="alert"
          class="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900"
        >
          <h1 class="text-xl font-bold">No hay una compra para pagar</h1>
          <p class="mt-2 text-sm">Finaliza tu compra desde el carrito para poder pagarla.</p>
          <a
            routerLink="/carrito"
            class="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white"
            >Ir al carrito</a
          >
        </div>
      } @else {
        <!-- Encabezado y Resumen de Orden -->
        <div
          class="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div class="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span
                class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
              >
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Pasarela Segura Webpay Plus
              </span>
              <h1 class="mt-2 text-2xl font-extrabold text-slate-800">Finalizar Pago</h1>
            </div>
            <div class="text-right">
              <span class="text-xs uppercase tracking-wider text-slate-400">Total a pagar</span>
              <p class="text-2xl font-black text-blue-600">
                {{ monto() | clp }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-500">
            <div>
              <span class="font-medium text-slate-400">Orden ID:</span>
              <code class="ml-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">{{
                ordenId()
              }}</code>
            </div>
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Cifrado TLS 256-bit</span>
            </div>
          </div>
        </div>

        <!-- Bloqueo antifraude: persiste aunque se recargue la página (BloqueoPagoService) -->
        @if (segundosBloqueo() > 0) {
          <div
            role="alert"
            data-testid="bloqueo-pago"
            class="mb-6 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-900 shadow-sm"
          >
            <h2 class="font-bold">Pago bloqueado por seguridad</h2>
            <p class="mt-1 text-sm leading-relaxed">
              Detectamos más de 3 intentos de pago en menos de 10 segundos. Por tu seguridad debes
              esperar {{ minutosBloqueoTotal() }} minutos antes de volver a comprar.
            </p>
            <p class="mt-3 text-sm">
              Tiempo restante:
              <strong class="font-mono text-base" aria-live="off">{{ tiempoRestante() }}</strong>
              <span class="text-red-800">
                · podrás reintentar a las {{ bloqueadoHasta() | date: 'HH:mm' }}</span
              >
            </p>
          </div>
        }

        <!-- Alertas de Error Accesibles (el bloqueo antifraude se muestra arriba) -->
        @if (error() && !error()?.esBloqueoFraude) {
          <div
            role="alert"
            aria-live="polite"
            [class]="
              error()?.esBloqueoFraude
                ? 'border-red-300 bg-red-50 text-red-900'
                : error()?.esNoDisponible
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-red-200 bg-red-50 text-red-800'
            "
            class="mb-6 rounded-2xl border p-5 shadow-sm"
          >
            <div class="flex items-start gap-3">
              <div class="mt-0.5 flex-shrink-0">
                @if (error()?.esBloqueoFraude) {
                  <svg
                    class="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                } @else {
                  <svg
                    class="h-6 w-6 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              </div>
              <div class="flex-1">
                <h3 class="font-bold">
                  @if (error()?.esBloqueoFraude) {
                    Pago bloqueado por seguridad
                  } @else if (error()?.esNoDisponible) {
                    Servicio No Disponible (503)
                  } @else {
                    Error al Procesar el Pago
                  }
                </h3>
                <p class="mt-1 text-sm leading-relaxed">{{ error()?.mensaje }}</p>

                @if (error()?.esNoDisponible) {
                  <div class="mt-4">
                    <button
                      type="button"
                      (click)="limpiarError()"
                      class="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700"
                    >
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
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <!-- Tarjeta Visual Interactiva -->
          <div
            class="mb-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 p-5 text-white shadow-md"
          >
            <div class="flex items-center justify-between">
              <div class="h-7 w-10 rounded bg-amber-400/80"></div>
              <span
                class="rounded bg-white/10 px-2.5 py-0.5 text-xs font-bold tracking-widest uppercase"
              >
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
              <label
                for="numeroTarjeta"
                class="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Número de Tarjeta (15 a 16 dígitos)
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
                    Debe contener entre 13 y 19 dígitos numéricos.
                  }
                </p>
              }
            </div>

            <!-- Nombre del Titular -->
            <div>
              <label
                for="nombreTitular"
                class="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
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
                <label
                  for="mesVencimiento"
                  class="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Mes
                </label>
                <select
                  id="mesVencimiento"
                  formControlName="mesVencimiento"
                  autocomplete="cc-exp-month"
                  [class.border-red-500]="isFieldInvalid('mesVencimiento')"
                  class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="" disabled selected>Mes</option>
                  @for (m of meses; track m) {
                    <option [value]="m">{{ m < 10 ? '0' + m : m }}</option>
                  }
                </select>
              </div>

              <!-- Año -->
              <div>
                <label
                  for="anioVencimiento"
                  class="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Año
                </label>
                <select
                  id="anioVencimiento"
                  formControlName="anioVencimiento"
                  autocomplete="cc-exp-year"
                  [class.border-red-500]="isFieldInvalid('anioVencimiento')"
                  class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="" disabled selected>Año</option>
                  @for (a of anios; track a) {
                    <option [value]="a">{{ a }}</option>
                  }
                </select>
              </div>

              <!-- CVV -->
              <div>
                <label
                  for="cvv"
                  class="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
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
            @if (
              pagoForm.hasError('tarjetaExpirada') &&
              (pagoForm.get('mesVencimiento')?.touched || pagoForm.get('anioVencimiento')?.touched)
            ) {
              <p class="text-xs text-red-600">La fecha de expiración ingresada ya está vencida.</p>
            }

            @if (isFieldInvalid('cvv')) {
              <p class="text-xs text-red-600">El CVV debe contener 3 o 4 dígitos numéricos.</p>
            }
          </div>

          <!-- Botón de Envío -->
          <div class="mt-8">
            <button
              type="submit"
              id="btnPagar"
              [disabled]="pagoForm.invalid || procesando() || segundosBloqueo() > 0"
              [class]="
                pagoForm.invalid || procesando() || segundosBloqueo() > 0
                  ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]'
              "
              class="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold transition-all shadow-sm"
            >
              @if (procesando()) {
                <svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  ></path>
                </svg>
                <span>Verificando transacción...</span>
              } @else {
                <svg
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span>Pagar {{ monto() | clp }}</span>
              }
            </button>
          </div>

          <!-- Enlaces Secundarios -->
          <div class="mt-4 flex items-center justify-between text-xs text-slate-500">
            <a
              routerLink="/carrito"
              class="font-medium text-slate-600 hover:text-blue-600 transition"
            >
              &larr; Volver al Carrito
            </a>
            <a
              [routerLink]="['/pago/historial', ordenId()]"
              class="font-medium text-blue-600 hover:underline"
            >
              Ver historial de esta orden
            </a>
          </div>
        </form>
      }
    </div>
  `,
})
export class FormularioPagoComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pagoService = inject(PagoService);
  private readonly tracker = inject(CheckoutTrackerService);

  readonly ordenId = signal<string>('');
  readonly monto = signal<number>(0);
  /** Solo se paga una compra registrada por un checkout (ver CheckoutTrackerService). */
  readonly ordenValida = signal<boolean>(false);
  private readonly bloqueos = inject(BloqueoPagoService);
  /** Fin (epoch ms) del bloqueo antifraude de esta compra, o null. */
  readonly bloqueadoHasta = signal<number | null>(null);
  /** Duración total del bloqueo vigente, en minutos (lo informa el backend; 30 por defecto). */
  readonly minutosBloqueoTotal = signal<number>(environment.pagos.bloqueoPorDefectoMinutos);
  private readonly ahora = signal<number>(Date.now());
  /** Segundos que faltan para poder volver a pagar; deshabilita el botón mientras sea > 0. */
  readonly segundosBloqueo = computed(() => {
    const hasta = this.bloqueadoHasta();
    return hasta ? Math.max(0, Math.ceil((hasta - this.ahora()) / 1000)) : 0;
  });
  /** mm:ss restante (o h:mm:ss si supera una hora). */
  readonly tiempoRestante = computed(() => {
    const s = this.segundosBloqueo();
    const dos = (n: number) => String(n).padStart(2, '0');
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}:${dos(m)}:${dos(s % 60)}` : `${dos(m)}:${dos(s % 60)}`;
  });
  private bloqueoTimer: ReturnType<typeof setInterval> | null = null;
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
    this.initForm();
    const paramOrdenId = this.route.snapshot.paramMap.get('ordenId') ?? '';
    const compra = this.tracker
      .compras()
      .find((c) => CheckoutTrackerService.ordenIdParaPago(c) === paramOrdenId);
    if (compra && compra.montoPago >= 1) {
      this.ordenId.set(paramOrdenId);
      this.monto.set(compra.montoPago);
      this.ordenValida.set(true);
      // Un bloqueo previo de esta compra sigue vigente aunque se haya recargado la página.
      const hasta = this.bloqueos.bloqueadoHasta(paramOrdenId);
      if (hasta) this.activarBloqueo(hasta, null);
    }
  }

  ngOnDestroy(): void {
    if (this.bloqueoTimer) clearInterval(this.bloqueoTimer);
  }

  private initForm(): void {
    this.pagoForm = this.fb.group(
      {
        numeroTarjeta: [
          '',
          [
            Validators.required,
            luhnValidator({
              aceptarTarjetasPrueba: environment.pagos.aceptarTarjetasPruebaTransbank,
            }),
          ],
        ],
        nombreTitular: ['', [Validators.required, Validators.minLength(3)]],
        mesVencimiento: ['', [Validators.required]],
        anioVencimiento: ['', [Validators.required]],
        cvv: ['', [Validators.required, cvvValidator()]],
      },
      {
        validators: [expiracionFormGroupValidator('mesVencimiento', 'anioVencimiento')],
      },
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
    if (this.pagoForm.invalid || this.procesando() || this.segundosBloqueo() > 0) {
      return;
    }

    this.procesando.set(true);
    this.error.set(null);

    const formVal = this.pagoForm.getRawValue();
    const req: IniciarPagoRequest = {
      ordenId: this.ordenId(),
      monto: this.monto(),
      numeroTarjeta: String(formVal.numeroTarjeta || '').replace(/[\s-]/g, ''),
      cvv: String(formVal.cvv).trim(),
      mesVencimiento: Number(formVal.mesVencimiento),
      anioVencimiento: Number(formVal.anioVencimiento),
      nombreTitular: formVal.nombreTitular?.trim(),
    };

    // SEGURIDAD (brecha #3): PAN y CVV salen del formulario apenas se arma la solicitud.
    // No se guardan en estado, storage, errores ni logs.
    this.limpiarDatosSensibles();

    this.pagoService
      .iniciarPago(req)
      .pipe(
        switchMap((res) => {
          if (res.token) return this.pagoService.confirmarPago(res.token);
          // La pasarela exige redirección: el retorno llega a /pago/retorno?token_ws=...
          if (res.urlRedireccion) window.location.href = res.urlRedireccion;
          return EMPTY;
        }),
      )
      .subscribe({
        next: (pago) => {
          this.pagoForm.reset();
          this.procesando.set(false);
          this.router.navigate(['/pago/resultado'], {
            queryParams: { pagoId: pago.id, ordenId: pago.ordenId },
          });
        },
        error: (err: PagoError) => {
          this.procesando.set(false);
          this.error.set(err);
          if (err.esBloqueoFraude) {
            const segundos =
              err.segundosParaReintentar ?? environment.pagos.bloqueoPorDefectoMinutos * 60;
            const hasta = this.bloqueos.registrar(this.ordenId(), segundos);
            this.activarBloqueo(hasta, Math.round(segundos / 60));
          }
        },
      });
  }

  private limpiarDatosSensibles(): void {
    this.pagoForm.patchValue({ numeroTarjeta: '', cvv: '' });
    this.pagoForm.get('numeroTarjeta')?.markAsUntouched();
    this.pagoForm.get('cvv')?.markAsUntouched();
    this.marcaDetectada.set('DESCONOCIDA');
  }

  /**
   * Deshabilita el pago hasta `hasta` (epoch ms) y actualiza la cuenta regresiva cada segundo.
   * El tiempo se recalcula contra el reloj (no se descuenta de a 1), así no se desfasa si la
   * pestaña queda en segundo plano.
   */
  private activarBloqueo(hasta: number, minutosTotales: number | null): void {
    this.bloqueadoHasta.set(hasta);
    this.ahora.set(Date.now());
    if (minutosTotales) this.minutosBloqueoTotal.set(Math.max(1, minutosTotales));
    if (this.bloqueoTimer) clearInterval(this.bloqueoTimer);
    this.bloqueoTimer = setInterval(() => {
      this.ahora.set(Date.now());
      if (this.segundosBloqueo() === 0) {
        if (this.bloqueoTimer) clearInterval(this.bloqueoTimer);
        this.bloqueoTimer = null;
        this.bloqueadoHasta.set(null);
        this.bloqueos.liberar(this.ordenId());
        if (this.error()?.esBloqueoFraude) this.error.set(null);
      }
    }, 1000);
  }
}
