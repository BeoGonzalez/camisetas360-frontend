import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PagoService } from '../../../../core/services/pago.service';
import { PagoError } from '../../../../core/models/pago.model';

@Component({
  selector: 'app-retorno-pago',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="mx-auto max-w-md px-4 py-16 text-center">
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        @if (procesando()) {
          <div class="flex flex-col items-center">
            <svg class="h-12 w-12 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <h2 class="mt-4 text-xl font-extrabold text-slate-800">Confirmando con Webpay...</h2>
            <p class="mt-2 text-xs text-slate-500">
              Estamos validando la respuesta de la pasarela con el microservicio de pagos. Por favor no cierres esta ventana.
            </p>
          </div>
        } @else if (error()) {
          <div class="flex flex-col items-center">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 class="mt-4 text-lg font-bold text-slate-800">Error en la Confirmación</h2>
            <p class="mt-2 text-xs text-slate-600">{{ error()?.mensaje }}</p>
            <div class="mt-6 flex w-full flex-col gap-2">
              <a routerLink="/catalog" class="rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700">
                Ir al Catálogo
              </a>
              <a routerLink="/carrito" class="rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
                Ver Carrito
              </a>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class RetornoPagoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pagoService = inject(PagoService);

  readonly procesando = signal<boolean>(true);
  readonly error = signal<PagoError | null>(null);

  ngOnInit(): void {
    const tokenWs =
      this.route.snapshot.queryParamMap.get('token_ws') ||
      this.route.snapshot.queryParamMap.get('token');

    if (!tokenWs) {
      this.procesando.set(false);
      this.error.set({
        status: 400,
        mensaje: 'No se recibió ningún token de retorno de la pasarela de pago.',
      });
      return;
    }

    this.pagoService.confirmarPago(tokenWs).subscribe({
      next: (res) => {
        this.procesando.set(false);
        this.router.navigate(['/pago/resultado'], {
          queryParams: { pagoId: res.id, ordenId: res.ordenId },
        });
      },
      error: (err: PagoError) => {
        this.procesando.set(false);
        this.error.set(err);
      },
    });
  }
}
