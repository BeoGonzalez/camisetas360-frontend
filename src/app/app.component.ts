import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { AuthService } from './core/services/auth.service';
import { CartService } from './core/services/cart.service';

/**
 * Componente raíz de la aplicación.
 *
 * Shell simplificado que contiene:
 * - Navbar (compartida)
 * - Router outlet (contenido dinámico por ruta)
 * - Footer (compartido)
 *
 * La lógica de autenticación está delegada al AuthService.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-paper">
      <!-- Barra de navegación -->
      <app-navbar />

      <!-- Contenido principal. min-h: el footer nace bajo el pliegue; si no, la ruta lazy lo
           empuja fuera de la vista al cargar (CLS ~0,29 medido en e2e/rendimiento.spec.ts). -->
      <main
        class="mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[1440px] flex-1 px-4 py-4 sm:px-8 sm:py-10 lg:px-14"
      >
        <router-outlet />
      </main>

      <!-- Pie de página -->
      <app-footer />
    </div>
  `,
})
export class AppComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly cartService = inject(CartService);

  ngOnInit(): void {
    // MSALInitializerFactory ya procesó el redirect y fijó la cuenta activa.
    // GET /auth/profile se llama UNA vez tras el login para sincronizar el perfil.
    this.authService.syncProfileOnce();
    // Contador del carrito en la navbar (errores se muestran en /carrito).
    if (this.authService.isCustomer()) {
      this.cartService.load().subscribe({ error: () => undefined });
    }
  }
}
