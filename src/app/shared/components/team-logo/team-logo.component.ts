import { Component, computed, inject, input, signal } from '@angular/core';
import { claveEquipo, coloresEquipo } from '../../utils/team-colors';
import { TEAM_LOGO_URLS } from './team-logos';

/** Iniciales del escudo de respaldo: "Universidad de Chile" -> "UC", "Arsenal" -> "AR". */
export function iniciales(team: string): string {
  const palabras = team
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w));
  const base = palabras.length ? palabras : team.trim().split(/\s+/);
  if (base.length === 1) return base[0].slice(0, 2).toUpperCase();
  return base
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Escudo del equipo, pensado para ir a la izquierda de su nombre. Usa el archivo
 * registrado en `TEAM_LOGOS` (estático, sin token); si no hay o falla la carga,
 * muestra un escudo con las iniciales. Es decorativo: el nombre ya va al lado.
 */
@Component({
  selector: 'app-team-logo',
  standalone: true,
  host: {
    class: 'inline-flex shrink-0 items-center justify-center',
    'aria-hidden': 'true',
    // Sobre una banda de color, el escudo real va en una lámina de papel (un escudo azul
    // marino desaparecería sobre la banda de Tottenham). El escudo de iniciales no la necesita.
    '[class.lamina]': 'lamina() && !!src()',
  },
  template: `
    @if (src(); as url) {
      <img
        [src]="url"
        alt=""
        class="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
        (error)="fallo.set(url)"
      />
    } @else if (team()) {
      <svg viewBox="0 0 40 46" class="h-full w-auto" data-testid="escudo-iniciales">
        <!-- Escudo en el color del club; el contorno toma el color del texto que lo rodea
             (tinta en el índice, el color «sobre» dentro de la banda del equipo). -->
        <path
          d="M20 2 37 8v14c0 11-7 18-17 22C10 40 3 33 3 22V8z"
          [attr.fill]="colores().primario"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <path d="M6 33h28" [attr.stroke]="colores().secundario" stroke-width="3" />
        <text
          x="20"
          y="25"
          text-anchor="middle"
          [attr.fill]="colores().sobre"
          font-size="13"
          font-weight="800"
          letter-spacing="0.5"
        >
          {{ letras() }}
        </text>
      </svg>
    }
  `,
})
export class TeamLogoComponent {
  private readonly logos = inject(TEAM_LOGO_URLS);

  readonly team = input<string | null | undefined>(null);

  /** Mostrar el escudo sobre papel (para fondos de color). */
  readonly lamina = input(false);

  /** URL que falló al cargar; se recuerda para no reintentar en bucle. */
  readonly fallo = signal<string | null>(null);

  readonly src = computed(() => {
    const team = this.team()?.trim();
    const url = team ? this.logos[claveEquipo(team)] : undefined;
    return url && url !== this.fallo() ? url : null;
  });

  readonly letras = computed(() => iniciales(this.team() ?? ''));

  readonly colores = computed(() => coloresEquipo(this.team()));
}
