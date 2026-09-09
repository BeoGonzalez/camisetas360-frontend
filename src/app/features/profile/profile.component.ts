import { Component, OnInit, signal } from '@angular/core';
import { AuthService } from '../auth/services/auth.service';
import { UserProfile } from '../../core/models/user-profile.model';

/**
 * Componente de perfil del usuario autenticado.
 *
 * Vista protegida por authGuard que consume el endpoint
 * /api/v1/auth/profile y renderiza la información del usuario:
 * nombre, correo e identificador.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  template: `
    <div class="mx-auto max-w-2xl">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-800 md:text-4xl">Mi Perfil</h1>
        <p class="mt-1 text-slate-500">Información de tu cuenta corporativa</p>
      </div>

      <!-- Loading Skeleton -->
      @if (loading()) {
        <div class="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div class="bg-gradient-to-r from-slate-200 to-slate-300 px-8 py-12">
            <div class="mx-auto h-20 w-20 rounded-full bg-slate-300/50"></div>
          </div>
          <div class="p-8">
            <div class="mb-6 h-5 w-1/3 rounded bg-slate-200"></div>
            <div class="space-y-4">
              <div class="h-4 w-full rounded bg-slate-200"></div>
              <div class="h-4 w-2/3 rounded bg-slate-200"></div>
              <div class="h-4 w-1/2 rounded bg-slate-200"></div>
            </div>
          </div>
        </div>
      }

      <!-- Error State -->
      @if (error()) {
        <div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg class="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-red-800">Error al cargar perfil</h3>
          <p class="mt-1 text-sm text-red-600">{{ error() }}</p>
          <button (click)="loadProfile()" class="mt-4 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-700">
            Reintentar
          </button>
        </div>
      }

      <!-- Profile Card -->
      @if (!loading() && !error() && profile()) {
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <!-- Header con avatar -->
          <div class="relative bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-8 py-12 text-center text-white">
            <div class="absolute inset-0 opacity-10">
              <div class="absolute inset-0" style="background-image: radial-gradient(circle at 50% 50%, rgba(59,130,246,0.3) 0%, transparent 70%)"></div>
            </div>
            <div class="relative z-10">
              <!-- Avatar con iniciales -->
              <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 text-2xl font-extrabold backdrop-blur-sm">
                {{ authService.userInitials() }}
              </div>
              <h2 class="mt-4 text-2xl font-extrabold">{{ profile()!.nombre }}</h2>
              <p class="mt-1 text-sm text-blue-200/70">{{ profile()!.correo }}</p>
            </div>
          </div>

          <!-- Datos del perfil -->
          <div class="p-8">
            <h3 class="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-400">Información de la cuenta</h3>

            <div class="space-y-5">
              <!-- Nombre -->
              <div class="flex items-start gap-4 rounded-xl bg-slate-50 p-4">
                <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <svg class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p class="text-xs font-medium text-slate-500">Nombre completo</p>
                  <p class="mt-0.5 text-sm font-semibold text-slate-800">{{ profile()!.nombre }}</p>
                </div>
              </div>

              <!-- Correo -->
              <div class="flex items-start gap-4 rounded-xl bg-slate-50 p-4">
                <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                  <svg class="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p class="text-xs font-medium text-slate-500">Correo electrónico</p>
                  <p class="mt-0.5 text-sm font-semibold text-slate-800">{{ profile()!.correo }}</p>
                </div>
              </div>

              <!-- Identificador -->
              <div class="flex items-start gap-4 rounded-xl bg-slate-50 p-4">
                <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <svg class="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                </div>
                <div>
                  <p class="text-xs font-medium text-slate-500">Identificador</p>
                  <p class="mt-0.5 font-mono text-sm font-semibold text-slate-800">{{ profile()!.identificador }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  /** Datos del perfil cargados del backend */
  readonly profile = signal<UserProfile | null>(null);

  /** Estado de carga */
  readonly loading = signal<boolean>(true);

  /** Mensaje de error */
  readonly error = signal<string>('');

  constructor(readonly authService: AuthService) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  /** Carga el perfil del usuario desde el endpoint /api/v1/auth/profile */
  loadProfile(): void {
    this.loading.set(true);
    this.error.set('');

    this.authService.getProfile().subscribe({
      next: (data) => {
        this.profile.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar perfil:', err);
        this.error.set('No se pudo cargar la información del perfil.');
        this.loading.set(false);
      },
    });
  }
}
