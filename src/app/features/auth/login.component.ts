import { Component } from '@angular/core';
import { AuthService } from './services/auth.service';

/**
 * Componente de inicio de sesión.
 *
 * Página de login con branding Camisetas360 y botón de
 * inicio de sesión con Microsoft (Azure Entra ID).
 */
@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="flex min-h-[70vh] items-center justify-center">
      <div class="w-full max-w-md">
        <!-- Card -->
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          <!-- Header con gradiente -->
          <div class="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-8 py-10 text-center text-white">
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
              <svg class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h1 class="text-2xl font-extrabold tracking-tight">CAMISETAS 360</h1>
            <p class="mt-2 text-sm text-blue-200/70">Accede a tu cuenta corporativa</p>
          </div>

          <!-- Body -->
          <div class="px-8 py-8">
            <p class="mb-6 text-center text-sm text-slate-500">
              Inicia sesión con tu cuenta de Microsoft para acceder al carrito de compras y tu perfil.
            </p>

            <!-- Botón Microsoft -->
            <button
              (click)="login()"
              class="group flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md active:scale-[0.98]">
              <!-- Microsoft Icon -->
              <svg class="h-5 w-5" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Iniciar sesión con Microsoft
            </button>

            <!-- Divider -->
            <div class="my-6 flex items-center gap-3">
              <div class="h-px flex-1 bg-slate-200"></div>
              <span class="text-xs text-slate-400">Azure Entra ID</span>
              <div class="h-px flex-1 bg-slate-200"></div>
            </div>

            <!-- Info -->
            <div class="rounded-xl bg-slate-50 p-4">
              <div class="flex gap-3">
                <svg class="h-5 w-5 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p class="text-xs font-medium text-slate-700">Autenticación corporativa</p>
                  <p class="mt-0.5 text-xs text-slate-500">
                    Utilizamos OAuth2 con Azure Entra ID para garantizar la seguridad de tu cuenta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <p class="mt-6 text-center text-xs text-slate-400">
          Al iniciar sesión, aceptas nuestros términos de servicio y política de privacidad.
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  constructor(private readonly authService: AuthService) {}

  /** Inicia el flujo de login con Azure Entra ID */
  login(): void {
    this.authService.login();
  }
}
