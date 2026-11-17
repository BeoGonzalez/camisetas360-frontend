import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';

/**
 * Estado de error uniforme: mensaje accesible (role=alert), reintento manual para
 * red/5xx, aviso de permisos para 403 y acceso a login para 401.
 */
@Component({
  selector: 'app-api-error',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (error(); as e) {
      <div
        role="alert"
        class="rounded-2xl border p-5 text-sm"
        [class]="
          e.kind === 'forbidden'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-red-200 bg-red-50 text-red-800'
        "
      >
        <p class="font-semibold">
          @switch (e.kind) {
            @case ('forbidden') {
              Sin permiso
            }
            @case ('unauthenticated') {
              Sesión expirada
            }
            @case ('not_found') {
              No encontrado
            }
            @case ('network') {
              Sin conexión
            }
            @default {
              {{ title() }}
            }
          }
        </p>
        <p class="mt-1">{{ e.message }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          @if (e.retryable) {
            <button
              type="button"
              (click)="retry.emit()"
              class="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              Reintentar
            </button>
          }
          @if (e.kind === 'unauthenticated') {
            <a
              routerLink="/auth/login"
              class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white"
              >Iniciar sesión</a
            >
          }
        </div>
      </div>
    }
  `,
})
export class ApiErrorComponent {
  readonly error = input<ApiError | null>(null);
  readonly title = input('Ocurrió un error');
  readonly retry = output<void>();
}
