import { Component, computed, inject, signal } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { NotificationCenterComponent } from '../../../features/notifications/notification-center.component';

const LINK =
  'album-caps text-[11px] text-slate-700 underline-offset-[7px] decoration-1 transition-colors hover:text-ink hover:underline';
const LINK_ACTIVO = '!text-ink underline';

/**
 * Encabezado del álbum: franja de tinta con el estado de la temporada, logotipo espaciado y
 * navegación en mayúsculas sobre papel, cerrada por una regla de tinta. Solo muestra lo que el
 * rol puede usar (la autorización real es del backend).
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NotificationCenterComponent],
  template: `
    <div
      class="album-caps flex h-8 items-center justify-center bg-ink px-4 text-center text-[10px] text-paper sm:text-[11px] dark:bg-blue-100 dark:text-ink"
    >
      Premier League y Serie A 2026/27<span class="max-sm:hidden"
        >&nbsp;· Local, visitante y alternativa</span
      >
    </div>
    <nav class="sticky top-0 z-50 border-b border-ink bg-paper/95 backdrop-blur-sm">
      <div
        class="mx-auto flex h-18 max-w-[1440px] items-center justify-between gap-3 px-4 sm:gap-6 sm:px-8 lg:px-14"
      >
        <a
          routerLink="/"
          class="shrink-0 text-[13px] font-extrabold tracking-[0.26em] text-ink [font-stretch:125%] sm:text-[17px] sm:tracking-[0.42em]"
          aria-label="Camisetas360, ir a la portada"
          >CAMISETAS<span class="text-pitch">360</span></a
        >

        <div class="hidden items-center gap-8 lg:flex">
          <a routerLink="/catalog" [routerLinkActive]="activo" [class]="link">Catálogo</a>
          @if (authService.isLoggedIn() && authService.isCustomer()) {
            <a routerLink="/pedidos" [routerLinkActive]="activo" [class]="link">Mis pedidos</a>
          }
          @if (authService.isLoggedIn()) {
            @if (authService.canManageCatalog()) {
              <a routerLink="/admin/productos" [routerLinkActive]="activo" [class]="link"
                >Panel admin</a
              >
            }
            @if (authService.canSeeMetrics()) {
              <a routerLink="/admin/metricas" [routerLinkActive]="activo" [class]="link"
                >Métricas</a
              >
            }
            @if (authService.isAdmin()) {
              <a routerLink="/pago/alertas" [routerLinkActive]="activo" [class]="link"
                >Alertas Antifraude</a
              >
            }
            <a routerLink="/perfil" [routerLinkActive]="activo" [class]="link">Mi Perfil</a>
          }
        </div>

        <div class="flex shrink-0 items-center gap-0.5 sm:gap-3">
          <!-- Modo claro / oscuro: el ícono muestra el modo al que se cambia. -->
          <button
            type="button"
            (click)="theme.alternar()"
            class="p-2 text-ink transition-colors hover:text-pitch"
            [attr.aria-label]="oscuro() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
            [title]="oscuro() ? 'Modo claro' : 'Modo oscuro'"
            data-testid="cambiar-tema"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.6"
              aria-hidden="true"
            >
              @if (oscuro()) {
                <!-- Sol -->
                <circle cx="12" cy="12" r="4" />
                <path
                  stroke-linecap="square"
                  d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
                />
              } @else {
                <!-- Luna -->
                <path stroke-linejoin="miter" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
              }
            </svg>
          </button>

          <button
            type="button"
            (click)="toggleNotificationCenter()"
            class="relative p-2 text-ink transition-colors hover:text-pitch"
            title="Centro de notificaciones"
            aria-label="Abrir centro de notificaciones"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.6"
              aria-hidden="true"
            >
              <path
                stroke-linecap="square"
                d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v.3A6 6 0 0 0 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
              />
            </svg>
            @if (authService.isLoggedIn()) {
              <span
                class="absolute right-1.5 top-1.5 h-1.5 w-1.5 bg-pitch"
                aria-hidden="true"
              ></span>
            }
          </button>

          @if (authService.isLoggedIn() && authService.isCustomer()) {
            <a
              routerLink="/carrito"
              [routerLinkActive]="activo"
              class="album-caps flex items-center gap-2 px-2 py-2 text-[11px] text-ink underline-offset-[7px] hover:underline"
            >
              <svg
                class="h-5 w-5 sm:hidden"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.6"
                aria-hidden="true"
              >
                <path stroke-linecap="square" d="M5 8h14l-1 12H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2" />
              </svg>
              <span class="max-sm:sr-only">Carrito</span>
              <span
                class="tnum inline-flex min-w-6 justify-center border border-ink px-1 text-[11px] tracking-normal"
                >{{ cartService.itemCount() }}</span
              >
            </a>
          }

          @if (authService.isLoggedIn()) {
            <span
              class="hidden h-8 w-8 items-center justify-center border border-ink text-[11px] font-bold tracking-wider md:flex"
              [title]="authService.activeUser()"
              aria-hidden="true"
              >{{ authService.userInitials() }}</span
            >
            <button
              type="button"
              (click)="authService.logout()"
              [title]="'Cerrar la sesión de ' + authService.activeUser()"
              class="album-caps hidden items-center gap-1.5 border border-ink px-2.5 py-1.5 text-[11px] text-ink transition-colors hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 sm:inline-flex"
            >
              <svg
                class="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <path stroke-linecap="square" d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
              </svg>
              Cerrar sesión
            </button>
          } @else {
            <a
              routerLink="/catalog"
              [routerLinkActive]="activo"
              [class]="link + ' hidden px-1.5 py-2 sm:inline lg:hidden'"
              >Catálogo</a
            >
            <a
              routerLink="/auth/login"
              class="album-caps whitespace-nowrap bg-ink px-3 py-2.5 max-sm:hidden text-[10px] tracking-[0.14em] text-paper transition-colors hover:bg-pitch sm:px-4 sm:text-[11px] sm:tracking-[0.2em]"
            >
              Iniciar Sesión
            </a>
          }

          <!-- Con sesión, el menú baja de lg. Sin sesión, solo en móvil (sm+ ya muestra «Catálogo»
               e «Iniciar sesión» en la barra). -->
          <button
            type="button"
            (click)="toggleMobileMenu()"
            class="p-2 text-ink"
            [class]="authService.isLoggedIn() ? 'lg:hidden' : 'sm:hidden'"
            [attr.aria-expanded]="mobileMenuOpen()"
            aria-label="Abrir menú"
          >
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.6"
              aria-hidden="true"
            >
              @if (mobileMenuOpen()) {
                <path stroke-linecap="square" d="M6 18 18 6M6 6l12 12" />
              } @else {
                <path stroke-linecap="square" d="M4 7h16M4 12h16M4 17h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      @if (mobileMenuOpen()) {
        <div
          class="animate-slide-down border-t border-ink bg-paper"
          [class]="authService.isLoggedIn() ? 'lg:hidden' : 'sm:hidden'"
        >
          <div class="mx-auto flex max-w-[1440px] flex-col px-4 py-2 sm:px-8">
            <a routerLink="/catalog" (click)="closeMobileMenu()" [class]="mobileLink">Catálogo</a>
            @if (authService.isLoggedIn() && authService.isCustomer()) {
              <a routerLink="/carrito" (click)="closeMobileMenu()" [class]="mobileLink"
                >Carrito
                <span class="tnum ml-2 border border-ink px-1.5 text-[11px] tracking-normal">{{
                  cartService.itemCount()
                }}</span></a
              >
              <a routerLink="/pedidos" (click)="closeMobileMenu()" [class]="mobileLink"
                >Mis pedidos</a
              >
            }
            @if (authService.isLoggedIn()) {
              @if (authService.canManageCatalog()) {
                <a routerLink="/admin/productos" (click)="closeMobileMenu()" [class]="mobileLink"
                  >Panel admin</a
                >
              }
              @if (authService.canSeeMetrics()) {
                <a routerLink="/admin/metricas" (click)="closeMobileMenu()" [class]="mobileLink"
                  >Métricas</a
                >
              }
              @if (authService.isAdmin()) {
                <a routerLink="/pago/alertas" (click)="closeMobileMenu()" [class]="mobileLink"
                  >Alertas Antifraude</a
                >
              }
              <a routerLink="/perfil" (click)="closeMobileMenu()" [class]="mobileLink">Mi Perfil</a>
              <p class="flex items-center justify-between py-4 text-sm text-slate-600">
                <span>{{ authService.activeUser() }}</span>
                <button
                  type="button"
                  (click)="authService.logout()"
                  class="album-caps border border-ink px-2.5 py-1.5 text-[11px] text-ink"
                >
                  Cerrar sesión
                </button>
              </p>
            } @else {
              <a routerLink="/auth/login" (click)="closeMobileMenu()" [class]="mobileLink"
                >Iniciar Sesión</a
              >
            }
          </div>
        </div>
      }
    </nav>

    <!-- Fuera del <nav>: su backdrop-blur lo vuelve el bloque contenedor de los position:fixed
         y el panel quedaba del alto de la barra en vez de la pantalla completa. -->
    @if (showNotificationCenter()) {
      <app-notification-center (close)="closeNotificationCenter()" />
    }
  `,
})
export class NavbarComponent {
  readonly link = LINK;
  readonly activo = LINK_ACTIVO;
  readonly mobileLink =
    'album-caps flex items-center border-b border-rule py-4 text-[12px] text-ink last:border-b-0';

  readonly theme = inject(ThemeService);
  readonly oscuro = computed(() => this.theme.tema() === 'oscuro');

  readonly mobileMenuOpen = signal<boolean>(false);
  readonly showNotificationCenter = signal<boolean>(false);

  constructor(
    readonly authService: AuthService,
    readonly cartService: CartService,
  ) {}

  toggleMobileMenu(): void {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleNotificationCenter(): void {
    this.showNotificationCenter.set(!this.showNotificationCenter());
  }

  closeNotificationCenter(): void {
    this.showNotificationCenter.set(false);
  }
}
