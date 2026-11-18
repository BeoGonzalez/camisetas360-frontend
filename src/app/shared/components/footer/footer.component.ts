import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Contratapa del álbum: columnas de enlaces sobre la banda crema y el logotipo a todo el ancho.
 * Solo dice lo que es cierto (proyecto académico, pasarela simulada).
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="mt-auto border-t border-ink bg-paper-2">
      <div class="mx-auto max-w-[1440px] px-4 pt-14 sm:px-8 lg:px-14">
        <div class="grid gap-10 sm:grid-cols-3">
          <div>
            <h2 class="album-caps text-[11px] text-ink">El álbum</h2>
            <ul class="mt-4 space-y-2.5 text-sm text-slate-700">
              <li>
                <a routerLink="/catalog" class="hover:text-ink hover:underline"
                  >Todos los equipos</a
                >
              </li>
              <li>Premier League y Serie A 2026/27</li>
              <li>Local, visitante y alternativa</li>
            </ul>
          </div>
          <div>
            <h2 class="album-caps text-[11px] text-ink">Tu cuenta</h2>
            <ul class="mt-4 space-y-2.5 text-sm text-slate-700">
              <li><a routerLink="/perfil" class="hover:text-ink hover:underline">Mi perfil</a></li>
              <li>
                <a routerLink="/pedidos" class="hover:text-ink hover:underline">Mis pedidos</a>
              </li>
              <li><a routerLink="/carrito" class="hover:text-ink hover:underline">Carrito</a></li>
            </ul>
          </div>
          <div>
            <h2 class="album-caps text-[11px] text-ink">El proyecto</h2>
            <p class="mt-4 max-w-xs text-sm leading-relaxed text-slate-700">
              Proyecto académico en AWS Academy. No se venden camisetas reales: los pagos usan una
              pasarela Webpay simulada con tarjetas de prueba.
            </p>
          </div>
        </div>

        <p
          class="mt-16 overflow-hidden whitespace-nowrap text-center text-[8.2vw] font-extrabold leading-[0.8] tracking-[0.04em] sm:tracking-[0.08em] text-ink [font-stretch:125%] lg:text-[min(8vw,116px)]"
          aria-hidden="true"
        >
          CAMISETAS360
        </p>
        <div
          class="album-caps flex flex-col gap-2 border-t border-ink py-5 text-[10px] text-slate-600 sm:flex-row sm:justify-between"
        >
          <span>&copy; {{ currentYear }} Camisetas360</span>
          <span>Temporada 2026/27</span>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();
}
