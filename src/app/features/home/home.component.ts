import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { KIT_TYPE_LABEL, KitType } from '../../core/models/product.model';
import { KIT_PHOTO } from '../../shared/components/product-image/kit-photos';
import { TeamLogoComponent } from '../../shared/components/team-logo/team-logo.component';
import { LEAGUE_LOGO_URLS } from '../../shared/components/team-logo/team-logos';
import { estiloEquipo } from '../../shared/utils/team-colors';
import { slug } from '../../shared/utils/slug';

/** Un tomo del álbum: una liga con sus equipos (nombres tal cual vienen del catálogo). */
export interface TomoLiga {
  nombre: string;
  /** Equipo cuyas tres camisetas se muestran en la portada. */
  destacado: string;
  equipos: readonly string[];
}

/**
 * Ligas del álbum 2026/27. Los nombres son los del campo `team` del catálogo (migraciones V3/V4
 * y V6 del ms catalog): `slug(nombre)` es la página del equipo en `/catalog?equipo=`.
 */
export const TOMOS: readonly TomoLiga[] = [
  {
    nombre: 'Premier League',
    destacado: 'Arsenal',
    equipos: [
      'Arsenal',
      'Aston Villa',
      'Bournemouth',
      'Brentford',
      'Brighton & Hove Albion',
      'Chelsea',
      'Coventry City',
      'Crystal Palace',
      'Everton',
      'Fulham',
      'Hull City',
      'Ipswich Town',
      'Leeds United',
      'Liverpool',
      'Manchester City',
      'Manchester United',
      'Newcastle United',
      'Nottingham Forest',
      'Sunderland',
      'Tottenham Hotspur',
    ],
  },
  {
    nombre: 'Serie A',
    destacado: 'Inter de Milán',
    equipos: [
      'AC Milan',
      'AC Monza',
      'AS Roma',
      'Atalanta',
      'Bologna',
      'Cagliari',
      'Como 1907',
      'Fiorentina',
      'Frosinone',
      'Genoa',
      'Inter de Milán',
      'Juventus',
      'Parma',
      'SS Lazio',
      'SSC Nápoles',
      'Torino',
      'Udinese',
      'US Lecce',
      'US Sassuolo',
      'Venezia',
    ],
  },
];

const TIPOS: readonly KitType[] = ['LOCAL', 'VISITANTE', 'ALTERNATIVA'];

/**
 * Portada del álbum (ruta raíz `/`): presenta la temporada, deja hojear las tres camisetas del
 * equipo destacado de cada liga y abre el índice de los dos tomos. Estática: no llama al
 * backend (el catálogo con precio y stock vive en `/catalog`).
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, TeamLogoComponent],
  template: `
    <!-- Portada -->
    <section class="border-b border-ink pb-12 pt-2 sm:pb-16 lg:pt-4">
      <h1
        class="album-display max-w-[14ch] text-[clamp(40px,7.4vw,96px)] lg:max-w-none"
        data-testid="portada-titulo"
      >
        El álbum de la temporada <span class="tnum text-pitch">2026/27</span>
      </h1>

      <div class="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div class="flex flex-col">
          <p class="max-w-[46ch] text-[17px] leading-relaxed text-slate-700">
            Las camisetas local, visitante y alternativa de los
            <span class="tnum font-semibold text-ink">{{ totalEquipos }}</span>
            equipos de la Premier League y la Serie A. Cada equipo tiene su página: ábrela, mira sus
            tres camisetas y elige la tuya.
          </p>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              routerLink="/catalog"
              class="album-caps bg-ink px-8 py-4 text-center text-[12px] text-paper transition-colors hover:bg-pitch"
              >Abrir el álbum &rarr;</a
            >
            @if (!auth.isLoggedIn()) {
              <a
                routerLink="/auth/login"
                [queryParams]="{ modo: 'registro' }"
                class="album-caps border border-ink px-8 py-4 text-center text-[12px] text-ink transition-colors hover:bg-ink hover:text-paper"
                >Crear cuenta</a
              >
            } @else if (auth.isCustomer()) {
              <a
                routerLink="/pedidos"
                class="album-caps border border-ink px-8 py-4 text-center text-[12px] text-ink transition-colors hover:bg-ink hover:text-paper"
                >Mis pedidos</a
              >
            }
          </div>

          <dl class="mt-auto hidden grid-cols-3 border-t border-ink pt-4 lg:mt-16 lg:grid">
            <div>
              <dt class="album-caps text-[10px] text-slate-600">Ligas</dt>
              <dd class="tnum mt-1 text-[40px] font-extrabold leading-none [font-stretch:110%]">
                {{ tomos.length }}
              </dd>
            </div>
            <div>
              <dt class="album-caps text-[10px] text-slate-600">Equipos</dt>
              <dd class="tnum mt-1 text-[40px] font-extrabold leading-none [font-stretch:110%]">
                {{ totalEquipos }}
              </dd>
            </div>
            <div>
              <dt class="album-caps text-[10px] text-slate-600">Camisetas por equipo</dt>
              <dd class="tnum mt-1 text-[40px] font-extrabold leading-none [font-stretch:110%]">
                {{ tipos.length }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- Hojear: las tres camisetas del equipo destacado de cada liga -->
        <div class="min-w-0">
          <div role="tablist" aria-label="Liga destacada" class="flex border-b border-rule">
            @for (t of tomos; track t.nombre; let i = $index) {
              <button
                type="button"
                role="tab"
                [id]="'tab-liga-' + i"
                [attr.aria-selected]="i === tomoIdx()"
                [attr.aria-controls]="'panel-liga'"
                [tabindex]="i === tomoIdx() ? 0 : -1"
                (click)="tomoIdx.set(i)"
                (keydown.arrowRight)="mover(1)"
                (keydown.arrowLeft)="mover(-1)"
                class="album-caps -mb-px border-b-2 px-4 py-3 text-[11px] transition-colors"
                [class]="
                  i === tomoIdx()
                    ? 'border-ink text-ink'
                    : 'border-transparent text-slate-600 hover:text-ink'
                "
              >
                {{ t.nombre }}
              </button>
            }
          </div>

          @for (t of [tomo()]; track t.nombre) {
            <div
              id="panel-liga"
              role="tabpanel"
              [attr.aria-labelledby]="'tab-liga-' + tomoIdx()"
              class="animate-page-turn mt-5"
              [style]="estilo()"
            >
              <a
                [routerLink]="'/catalog'"
                [queryParams]="{ equipo: clave(t.destacado) }"
                class="group flex items-center justify-between gap-4 border-b-[6px] border-[var(--eq-2)] bg-[var(--eq)] px-5 py-4 text-[var(--eq-sobre)] sm:px-6"
              >
                <span class="flex min-w-0 items-center gap-3">
                  <app-team-logo [team]="t.destacado" [lamina]="true" class="h-9 w-9" />
                  <span class="album-display truncate text-[clamp(20px,2.6vw,34px)]">{{
                    t.destacado
                  }}</span>
                </span>
                <span
                  class="album-caps shrink-0 text-[10px] underline-offset-[6px] group-hover:underline sm:text-[11px]"
                  >Ver su página &rarr;</span
                >
              </a>

              <ul class="mt-5 grid grid-cols-3 gap-3 sm:gap-5">
                @for (k of tipos; track k) {
                  <li class="flex min-w-0 flex-col">
                    <div
                      class="album-slot aspect-[4/5] bg-[color-mix(in_oklab,var(--eq)_7%,var(--color-paper))] p-2 sm:p-5"
                    >
                      @if (foto(t.destacado, k); as src) {
                        <img
                          [src]="src"
                          [alt]="'Camiseta ' + etiqueta[k].toLowerCase() + ' de ' + t.destacado"
                          width="400"
                          height="500"
                          class="h-full w-full object-contain"
                          [attr.fetchpriority]="k === 'LOCAL' ? 'high' : null"
                          decoding="async"
                        />
                      }
                    </div>
                    <p class="album-caps mt-3 border-b border-ink pb-2 text-[10px] sm:text-[12px]">
                      {{ etiqueta[k] }}
                    </p>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- Índice de los dos tomos -->
    <section class="border-b border-ink py-12 sm:py-16" aria-labelledby="titulo-tomos">
      <div class="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h2 id="titulo-tomos" class="album-display text-[clamp(30px,3.6vw,52px)]">
          Dos ligas, un álbum
        </h2>
        <a routerLink="/catalog" class="album-link text-[11px] text-ink"
          >Ver todos los equipos &rarr;</a
        >
      </div>

      <div class="mt-10 grid gap-14 lg:grid-cols-2 lg:gap-16">
        @for (t of tomos; track t.nombre) {
          <div class="min-w-0">
            <div class="flex items-center justify-between gap-4 border-b border-ink pb-3">
              <h3 class="flex items-center gap-3 album-display text-[clamp(22px,2.4vw,30px)]">
                @if (logoLiga(t.nombre); as logo) {
                  <img [src]="logo" alt="" class="lamina h-9 w-9 object-contain" />
                }
                {{ t.nombre }}
              </h3>
              <span class="album-caps tnum shrink-0 text-[11px] text-slate-700"
                >{{ t.equipos.length }} equipos</span
              >
            </div>
            <ol class="grid grid-cols-2 gap-x-4 sm:gap-x-8">
              @for (e of t.equipos; track e) {
                <li class="border-b border-rule">
                  <a
                    routerLink="/catalog"
                    [queryParams]="{ equipo: clave(e) }"
                    class="flex items-center gap-2 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:text-pitch sm:gap-3 sm:text-[13px] sm:tracking-[0.12em]"
                  >
                    <app-team-logo [team]="e" class="h-6 w-6 shrink-0 dark:lamina" />
                    <span class="min-w-0">{{ e }}</span>
                  </a>
                </li>
              }
            </ol>
          </div>
        }
      </div>
    </section>

    <!-- Cómo se compra: el orden importa, por eso va numerado -->
    <section class="py-12 sm:py-16" aria-labelledby="titulo-compra">
      <h2 id="titulo-compra" class="album-display text-[clamp(30px,3.6vw,52px)]">Cómo se compra</h2>
      <ol class="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        @for (p of pasos; track p.titulo; let i = $index) {
          <li class="border-t border-ink pt-4">
            <span class="tnum text-[13px] font-bold tracking-[0.16em] text-pitch">{{ i + 1 }}</span>
            <h3 class="album-caps mt-3 text-[13px]">{{ p.titulo }}</h3>
            <p class="mt-2 max-w-[38ch] text-[15px] leading-relaxed text-slate-700">
              {{ p.texto }}
            </p>
          </li>
        }
      </ol>

      <div
        class="mt-16 flex flex-col items-start justify-between gap-6 border-t border-ink pt-8 sm:flex-row sm:items-end"
      >
        <p class="album-display max-w-[18ch] text-[clamp(26px,3vw,40px)]">
          Tu camiseta está en la página de tu equipo
        </p>
        <a
          routerLink="/catalog"
          class="album-caps shrink-0 bg-ink px-8 py-4 text-[12px] text-paper transition-colors hover:bg-pitch"
          >Abrir el álbum &rarr;</a
        >
      </div>
    </section>
  `,
})
export class HomeComponent {
  readonly auth = inject(AuthService);
  private readonly fotoDe = inject(KIT_PHOTO);
  private readonly logosLiga = inject(LEAGUE_LOGO_URLS);

  readonly tomos = TOMOS;
  readonly tipos = TIPOS;
  readonly etiqueta = KIT_TYPE_LABEL;
  readonly totalEquipos = TOMOS.reduce((n, t) => n + t.equipos.length, 0);

  readonly pasos = [
    {
      titulo: 'Explora',
      texto: 'El álbum es público: recorre la página de cada equipo sin crear una cuenta.',
    },
    {
      titulo: 'Inicia sesión',
      texto:
        'Para comprar entra con tu cuenta Camisetas360 o con Microsoft; vuelves a la camiseta que elegiste.',
    },
    {
      titulo: 'Paga',
      texto:
        'El pago usa una pasarela Webpay simulada con tarjetas de prueba: no se cobra dinero real.',
    },
    {
      titulo: 'Sigue tu pedido',
      texto: 'Tu pedido aparece en Mis pedidos apenas el sistema lo registra.',
    },
  ] as const;

  readonly tomoIdx = signal(0);
  readonly tomo = computed(() => TOMOS[this.tomoIdx()]);
  readonly estilo = computed(() => estiloEquipo(this.tomo().destacado));

  /** Página del equipo en el catálogo (`?equipo=`): el mismo slug que usa el índice. */
  clave(team: string): string {
    return slug(team);
  }

  foto(team: string, kit: KitType): string | null {
    return this.fotoDe(team, kit);
  }

  logoLiga(nombre: string): string | null {
    return this.logosLiga[slug(nombre)] ?? null;
  }

  /** Flechas del teclado entre pestañas (patrón ARIA de tabs). */
  mover(delta: number): void {
    const n = TOMOS.length;
    this.tomoIdx.set((this.tomoIdx() + delta + n) % n);
    document.getElementById(`tab-liga-${this.tomoIdx()}`)?.focus();
  }
}
