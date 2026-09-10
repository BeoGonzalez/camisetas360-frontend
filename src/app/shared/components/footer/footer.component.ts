import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Componente de pie de página.
 *
 * Incluye links de navegación, copyright y estilo corporativo.
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="mt-auto border-t border-slate-200 bg-slate-50">
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div class="grid gap-8 md:grid-cols-3">
          <!-- Brand -->
          <div>
            <div class="flex items-center gap-2.5">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-xs font-extrabold text-white">
                C3
              </div>
              <span class="text-base font-extrabold tracking-wider text-slate-800">
                CAMISETAS<span class="text-blue-600">360</span>
              </span>
            </div>
            <p class="mt-3 text-sm text-slate-500">
              Tu tienda de camisetas de fútbol. Las 5 grandes ligas en un solo lugar.
            </p>
          </div>

          <!-- Quick Links -->
          <div>
            <h4 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Navegación</h4>
            <ul class="mt-3 space-y-2">
              <li>
                <a routerLink="/catalog" class="text-sm text-slate-600 transition hover:text-blue-600">Catálogo</a>
              </li>
              <li>
                <a routerLink="/carrito" class="text-sm text-slate-600 transition hover:text-blue-600">Carrito</a>
              </li>
              <li>
                <a routerLink="/perfil" class="text-sm text-slate-600 transition hover:text-blue-600">Mi Perfil</a>
              </li>
            </ul>
          </div>

          <!-- Contact -->
          <div>
            <h4 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Contacto</h4>
            <ul class="mt-3 space-y-2">
              <li class="flex items-center gap-2 text-sm text-slate-600">
                <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                soporte&#64;camisetas360.com
              </li>
            </ul>
          </div>
        </div>

        <!-- Bottom Bar -->
        <div class="mt-8 border-t border-slate-200 pt-6 text-center">
          <p class="text-xs text-slate-400">
            &copy; {{ currentYear }} Camisetas360. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();
}
