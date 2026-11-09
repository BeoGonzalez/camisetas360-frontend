import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AlertaFraude } from '../../../../core/models/pago.model';
import { PagoService } from '../../../../core/services/pago.service';

@Component({
  selector: 'app-panel-alertas',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="mx-auto max-w-6xl px-4 py-8">
      <div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div class="flex items-center gap-2">
            <span class="rounded-md bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
              Panel Administrativo
            </span>
            <span class="text-xs text-slate-400">ms-pago Security Monitor</span>
          </div>
          <h1 class="mt-2 text-3xl font-black text-slate-800">Alertas de Fraude Detectadas</h1>
          <p class="text-sm text-slate-500">
            Monitoreo en tiempo real de intentos bloqueados por la ventana deslizante antifraude.
          </p>
        </div>
        <div>
          <button
            (click)="cargarAlertas()"
            [disabled]="cargando()"
            class="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800">
            @if (cargando()) {
              <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            } @else {
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
            Actualizar Alertas
          </button>
        </div>
      </div>

      @if (cargando()) {
        <div class="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <svg class="h-8 w-8 animate-spin text-red-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </div>
      } @else if (alertas().length === 0) {
        <div class="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 class="mt-4 text-base font-bold text-slate-800">Sin Alertas Activas</h3>
          <p class="mt-1 text-xs text-slate-500">No se registran eventos sospechosos ni bloqueos en la base de datos.</p>
        </div>
      } @else {
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th class="px-5 py-3.5">Fecha y Hora</th>
                  <th class="px-5 py-3.5">Tarjeta (Últimos 4)</th>
                  <th class="px-5 py-3.5">Hash SHA-256</th>
                  <th class="px-5 py-3.5">Intentos / Ventana</th>
                  <th class="px-5 py-3.5">Motivo del Bloqueo</th>
                  <th class="px-5 py-3.5">Orden ID</th>
                  <th class="px-5 py-3.5">Pago ID</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-mono text-xs">
                @for (alerta of alertas(); track alerta.id) {
                  <tr class="transition hover:bg-red-50/40">
                    <td class="px-5 py-4 font-sans text-slate-600 whitespace-nowrap">
                      {{ alerta.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}
                    </td>
                    <td class="px-5 py-4 font-bold text-red-600 whitespace-nowrap">
                      •••• {{ alerta.tarjetaUltimos4 }}
                    </td>
                    <td class="px-5 py-4 text-slate-500 truncate max-w-[140px]" [title]="alerta.tarjetaHash">
                      {{ alerta.tarjetaHash.substring(0, 12) }}...
                    </td>
                    <td class="px-5 py-4 whitespace-nowrap">
                      <span class="inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                        {{ alerta.intentosDetectados }} intentos / {{ alerta.ventanaSegundos }}s
                      </span>
                    </td>
                    <td class="px-5 py-4 font-sans text-slate-700">
                      {{ alerta.motivo }}
                    </td>
                    <td class="px-5 py-4 text-slate-500 truncate max-w-[120px]" [title]="alerta.ordenId">
                      <a [routerLink]="['/pago/historial', alerta.ordenId]" class="font-sans text-blue-600 hover:underline">
                        {{ alerta.ordenId.substring(0, 8) }}...
                      </a>
                    </td>
                    <td class="px-5 py-4 text-slate-500 truncate max-w-[120px]" [title]="alerta.pagoId">
                      {{ alerta.pagoId.substring(0, 8) }}...
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
})
export class PanelAlertasComponent implements OnInit {
  private readonly pagoService = inject(PagoService);

  readonly alertas = signal<AlertaFraude[]>([]);
  readonly cargando = signal<boolean>(true);

  ngOnInit(): void {
    this.cargarAlertas();
  }

  cargarAlertas(): void {
    this.cargando.set(true);
    this.pagoService.obtenerAlertas().subscribe({
      next: (list) => {
        this.alertas.set(list || []);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      },
    });
  }
}
