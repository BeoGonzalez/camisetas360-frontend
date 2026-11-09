import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EstadoPago, PagoResponse } from '../../../../core/models/pago.model';
import { PagoService } from '../../../../core/services/pago.service';

@Component({
  selector: 'app-historial-pagos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="mx-auto max-w-4xl px-4 py-8">
      <div class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 class="text-2xl font-black text-slate-800">Historial de Pagos de la Orden</h1>
          <p class="text-xs text-slate-500">Orden ID: <code class="font-mono font-bold text-slate-700">{{ ordenId() }}</code></p>
        </div>
        <div class="flex gap-2">
          <a [routerLink]="['/pago/checkout', ordenId()]" class="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700">
            Nuevo Intento de Pago
          </a>
          <a routerLink="/catalog" class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
            Catálogo
          </a>
        </div>
      </div>

      @if (cargando()) {
        <div class="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <svg class="h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </div>
      } @else if (pagos().length === 0) {
        <div class="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p class="text-sm font-semibold text-slate-600">No se encontraron pagos registrados para esta orden.</p>
        </div>
      } @else {
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th class="px-5 py-3.5">ID Transacción</th>
                  <th class="px-5 py-3.5">Fecha</th>
                  <th class="px-5 py-3.5">Monto</th>
                  <th class="px-5 py-3.5">Tarjeta</th>
                  <th class="px-5 py-3.5">Estado</th>
                  <th class="px-5 py-3.5">Código Auth</th>
                  <th class="px-5 py-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (p of pagos(); track p.id) {
                  <tr class="transition hover:bg-slate-50/60">
                    <td class="px-5 py-4 font-mono text-xs text-slate-700">
                      {{ p.id.substring(0, 8) }}...
                    </td>
                    <td class="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {{ p.createdAt | date:'dd/MM/yyyy HH:mm' }}
                    </td>
                    <td class="px-5 py-4 font-bold text-slate-900 whitespace-nowrap">
                      {{ p.monto | currency:'CLP':'symbol-narrow':'1.0-0' }}
                    </td>
                    <td class="px-5 py-4 text-xs text-slate-600">
                      {{ p.tarjetaMarca || 'VISA' }} •••• {{ p.tarjetaUltimos4 || '----' }}
                    </td>
                    <td class="px-5 py-4">
                      @switch (p.estado) {
                        @case (EstadoPago.AUTORIZADO) {
                          <span class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            Autorizado
                          </span>
                        }
                        @case (EstadoPago.RECHAZADO) {
                          <span class="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                            Rechazado
                          </span>
                        }
                        @case (EstadoPago.BLOQUEADO_FRAUDE) {
                          <span class="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                            Bloqueado Fraude
                          </span>
                        }
                        @default {
                          <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                            {{ p.estado }}
                          </span>
                        }
                      }
                    </td>
                    <td class="px-5 py-4 font-mono text-xs text-slate-600">
                      {{ p.codigoAutorizacion || '-' }}
                    </td>
                    <td class="px-5 py-4 text-right">
                      <button
                        (click)="verDetalle(p.id)"
                        class="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        Detalle
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal de Detalle de Pago (/pago/{id}) -->
        @if (detalleSeleccionado()) {
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 class="text-lg font-bold text-slate-800">Detalle de Pago</h3>
                <button (click)="cerrarDetalle()" class="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <div class="mt-4 space-y-2.5 text-sm">
                <div class="flex justify-between text-xs">
                  <span class="text-slate-500">ID de Pago:</span>
                  <span class="font-mono text-slate-800">{{ detalleSeleccionado()?.id }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-slate-500">Orden ID:</span>
                  <span class="font-mono text-slate-800">{{ detalleSeleccionado()?.ordenId }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Monto:</span>
                  <span class="font-bold text-blue-600">{{ detalleSeleccionado()?.monto | currency:'CLP':'symbol-narrow':'1.0-0' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Estado:</span>
                  <span class="font-bold">{{ detalleSeleccionado()?.estado }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Mensaje Respuesta:</span>
                  <span class="text-slate-800 text-right">{{ detalleSeleccionado()?.mensajeRespuesta || 'Sin observaciones' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Tarjeta:</span>
                  <span class="text-slate-800">{{ detalleSeleccionado()?.tarjetaMarca }} •••• {{ detalleSeleccionado()?.tarjetaUltimos4 }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Código de Autorización:</span>
                  <span class="font-mono text-slate-800">{{ detalleSeleccionado()?.codigoAutorizacion || 'N/A' }}</span>
                </div>
                <div class="flex justify-between text-xs text-slate-400">
                  <span>Creado:</span>
                  <span>{{ detalleSeleccionado()?.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}</span>
                </div>
              </div>

              <div class="mt-6 flex justify-end">
                <button (click)="cerrarDetalle()" class="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class HistorialPagosComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly pagoService = inject(PagoService);

  readonly EstadoPago = EstadoPago;
  readonly ordenId = signal<string>('');
  readonly pagos = signal<PagoResponse[]>([]);
  readonly cargando = signal<boolean>(true);
  readonly detalleSeleccionado = signal<PagoResponse | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('ordenId');
    if (id) {
      this.ordenId.set(id);
      this.cargarHistorial(id);
    }
  }

  cargarHistorial(ordenId: string): void {
    this.cargando.set(true);
    this.pagoService.obtenerPagosPorOrden(ordenId).subscribe({
      next: (list) => {
        this.pagos.set(list || []);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      },
    });
  }

  verDetalle(pagoId: string): void {
    this.pagoService.obtenerPagoPorId(pagoId).subscribe({
      next: (pago) => {
        this.detalleSeleccionado.set(pago);
      },
    });
  }

  cerrarDetalle(): void {
    this.detalleSeleccionado.set(null);
  }
}
