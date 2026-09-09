import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { AuthService } from './features/auth/services/auth.service';

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
    <div class="flex min-h-screen flex-col bg-slate-50">
      <!-- Barra de navegación -->
      <app-navbar />

      <!-- Contenido principal -->
      <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <router-outlet />
      </main>

      <!-- Pie de página -->
      <app-footer />
    </div>
  `,
})
export class AppComponent implements OnInit {
  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    // AuthService se encarga de procesar la respuesta de redirección
    // de MSAL al construirse (handleRedirect en el constructor).
    // El checkAccount() se llama internamente.
  }
}