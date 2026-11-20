import { ClpPipe } from '../../../../shared/pipes/clp.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PagoService } from '../../../../core/services/pago.service';
import { CheckoutTrackerService } from '../../../../core/services/checkout-tracker.service';
import { PagoError } from '../../../../core/models/pago.model';

/**
 * Pago con Webpay Plus: Camisetas360 solo crea la transacción (ordenId + monto) y envía al
 * cliente a Webpay, donde ingresa la tarjeta. Al terminar, el backend redirige a /pago/resultado.
 */
@Component({
  selector: 'app-formulario-pago',
  standalone: true,
  imports: [ClpPipe, RouterLink],
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
        <!-- Encabezado y resumen de la compra -->
        <div
          class="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
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
                Webpay Plus · Transbank
              </span>
              <h1 class="mt-2 text-2xl font-extrabold text-slate-800">Finalizar Pago</h1>
            </div>
            <div class="text-right">
              <span class="text-xs uppercase tracking-wider text-slate-400">Total a pagar</span>
              <p class="text-2xl font-black text-blue-600">{{ monto() | clp }}</p>
            </div>
          </div>

          <div class="mt-4 text-xs text-slate-500">
            <span class="font-medium text-slate-400">Orden ID:</span>
            <code class="ml-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">{{
              ordenId()
            }}</code>
          </div>
        </div>

        @if (error(); as err) {
          <div
            role="alert"
            aria-live="polite"
            class="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm"
          >
            <h2 class="font-bold">No pudimos iniciar el pago</h2>
            <p class="mt-1 text-sm leading-relaxed">{{ mensajeError(err) }}</p>
          </div>
        }

        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p class="text-sm leading-relaxed text-slate-600" data-testid="aviso-webpay">
            Al continuar te llevaremos a <strong>Webpay</strong> de Transbank, donde ingresarás los
            datos de tu tarjeta de forma segura. Camisetas360 nunca ve ni guarda tu tarjeta. Al
            terminar volverás aquí con el resultado de tu compra.
          </p>

          <button
            type="button"
            id="btnPagar"
            (click)="pagar()"
            [disabled]="procesando()"
            [attr.aria-busy]="procesando()"
            [class]="
              procesando()
                ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]'
            "
            class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold shadow-sm transition-all"
          >
            @if (procesando()) {
              <svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
              <span>Redirigiendo a Webpay…</span>
            } @else {
              <span>Pagar {{ monto() | clp }} con Webpay</span>
            }
          </button>

          <!-- Enlaces secundarios -->
          <div class="mt-4 flex items-center justify-between text-xs text-slate-500">
            <a
              routerLink="/carrito"
              class="font-medium text-slate-600 transition hover:text-blue-600"
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
        </div>
      }
    </div>
  `,
})
export class FormularioPagoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly pagoService = inject(PagoService);
  private readonly tracker = inject(CheckoutTrackerService);

  readonly ordenId = signal<string>('');
  readonly monto = signal<number>(0);
  /** Solo se paga una compra registrada por un checkout (ver CheckoutTrackerService). */
  readonly ordenValida = signal<boolean>(false);
  readonly procesando = signal<boolean>(false);
  readonly error = signal<PagoError | null>(null);

  ngOnInit(): void {
    const paramOrdenId = this.route.snapshot.paramMap.get('ordenId') ?? '';
    const compra = this.tracker
      .compras()
      .find((c) => CheckoutTrackerService.ordenIdParaPago(c) === paramOrdenId);
    if (compra && compra.montoPago >= 1) {
      this.ordenId.set(paramOrdenId);
      this.monto.set(compra.montoPago);
      this.ordenValida.set(true);
    }
  }

  /** Crea la transacción en Webpay y envía el navegador allá (formulario POST con token_ws). */
  pagar(): void {
    if (!this.ordenValida() || this.procesando()) return;
    this.procesando.set(true);
    this.error.set(null);

    this.pagoService.iniciarWebpay({ ordenId: this.ordenId(), monto: this.monto() }).subscribe({
      // `procesando` queda en true: el navegador abandona la página hacia Webpay.
      next: (res) => this.pagoService.redirigirAWebpay(res.url, res.token),
      error: (err: PagoError) => {
        this.error.set(err);
        this.procesando.set(false);
      },
    });
  }

  /** El 400 de /webpay/iniciar significa orden ya pagada o datos inválidos (no hay tarjeta aquí). */
  mensajeError(err: PagoError): string {
    return err.status === 400
      ? 'Esta compra ya tiene un pago aprobado o sus datos no son válidos. Revisa el historial de la orden.'
      : err.mensaje;
  }
}
