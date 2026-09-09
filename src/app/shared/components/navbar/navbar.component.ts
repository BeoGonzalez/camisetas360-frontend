import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../features/auth/services/auth.service';
import { CartService } from '../../../features/cart/services/cart.service';

/**
 * Componente de barra de navegación principal.
 *
 * Incluye:
 * - Logo con gradiente de Camisetas360
 * - Navegación con RouterLink activo
 * - Badge de cantidad del carrito (reactivo)
 * - Botón login/logout dinámico
 * - Menú hamburguesa responsive
 * - Efecto glassmorphism en scroll
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="sticky top-0 z-50 border-b border-white/10 bg-slate-900/95 backdrop-blur-xl">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <!-- Logo -->
          <a routerLink="/catalog" class="flex items-center gap-2.5">
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-extrabold text-white shadow-lg shadow-blue-500/25">
              C3
            </div>
            <span class="text-lg font-extrabold tracking-wider text-white">
              CAMISETAS<span class="text-blue-400">360</span>
            </span>
          </a>

          <!-- Desktop Navigation -->
          <div class="hidden items-center gap-1 md:flex">
            <a routerLink="/catalog"
               routerLinkActive="bg-white/10 text-white"
               [routerLinkActiveOptions]="{ exact: false }"
               class="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-white/10 hover:text-white">
              Catálogo
            </a>

            @if (authService.isLoggedIn()) {
              <a routerLink="/carrito"
                 routerLinkActive="bg-white/10 text-white"
                 class="relative rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-white/10 hover:text-white">
                Carrito
                @if (cartService.itemCount() > 0) {
                  <span class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white shadow-lg shadow-blue-500/50 animate-cart-badge">
                    {{ cartService.itemCount() }}
                  </span>
                }
              </a>

              <a routerLink="/perfil"
                 routerLinkActive="bg-white/10 text-white"
                 class="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-white/10 hover:text-white">
                Mi Perfil
              </a>
            }
          </div>

          <!-- Right Section -->
          <div class="flex items-center gap-3">
            @if (authService.isLoggedIn()) {
              <!-- User Info -->
              <div class="hidden items-center gap-3 md:flex">
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {{ authService.userInitials() }}
                </div>
                <span class="text-sm font-medium text-slate-300">{{ authService.activeUser() }}</span>
              </div>

              <button
                (click)="authService.logout()"
                class="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-all duration-200 hover:border-red-500 hover:bg-red-500/10 hover:text-red-300">
                Salir
              </button>
            } @else {
              <a routerLink="/auth/login"
                class="rounded-lg bg-white px-5 py-2 text-sm font-bold text-slate-900 shadow-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-md active:scale-[0.97]">
                Iniciar Sesión
              </a>
            }

            <!-- Mobile Menu Toggle -->
            <button
              (click)="toggleMobileMenu()"
              class="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white md:hidden">
              @if (mobileMenuOpen()) {
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              } @else {
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              }
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Menu -->
      @if (mobileMenuOpen()) {
        <div class="border-t border-white/10 bg-slate-900/98 backdrop-blur-xl md:hidden animate-slide-down">
          <div class="space-y-1 px-4 py-4">
            <a routerLink="/catalog"
               routerLinkActive="bg-white/10 text-white"
               (click)="closeMobileMenu()"
               class="block rounded-lg px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">
              Catálogo
            </a>

            @if (authService.isLoggedIn()) {
              <a routerLink="/carrito"
                 routerLinkActive="bg-white/10 text-white"
                 (click)="closeMobileMenu()"
                 class="flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">
                <span>Carrito</span>
                @if (cartService.itemCount() > 0) {
                  <span class="rounded-full bg-blue-500 px-2.5 py-0.5 text-xs font-bold text-white">
                    {{ cartService.itemCount() }}
                  </span>
                }
              </a>

              <a routerLink="/perfil"
                 routerLinkActive="bg-white/10 text-white"
                 (click)="closeMobileMenu()"
                 class="block rounded-lg px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">
                Mi Perfil
              </a>

              <!-- User Info (Mobile) -->
              <div class="mt-2 border-t border-white/10 pt-3">
                <div class="flex items-center gap-3 px-4 py-2">
                  <div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {{ authService.userInitials() }}
                  </div>
                  <span class="text-sm font-medium text-slate-300">{{ authService.activeUser() }}</span>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </nav>
  `,
})
export class NavbarComponent {
  /** Estado del menú móvil */
  readonly mobileMenuOpen = signal<boolean>(false);

  constructor(
    readonly authService: AuthService,
    readonly cartService: CartService
  ) {}

  toggleMobileMenu(): void {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
