import { InjectionToken } from '@angular/core';

/**
 * Escudos disponibles en `public/logos/`, por clave canónica del equipo (`claveEquipo` en
 * `shared/utils/team-colors.ts`: slug + alias, "Leeds United" -> 'leeds').
 *
 * Para agregar un escudo: copia el archivo (PNG, SVG o WebP, cuadrado, fondo transparente) a
 * `public/logos/` y registra aquí `clave: 'archivo'`. Solo se piden los registrados, así
 * los equipos sin escudo no generan 404; esos muestran sus iniciales.
 */
export const TEAM_LOGOS: Readonly<Record<string, string>> = {
  arsenal: 'arsenal.svg',
  'aston-villa': 'aston-villa.svg',
  bournemouth: 'bournemouth.svg',
  brentford: 'brentford.svg',
  brighton: 'brighton.svg',
  chelsea: 'chelsea.svg',
  coventry: 'coventry.svg',
  'crystal-palace': 'crystal-palace.svg',
  everton: 'everton.svg',
  fulham: 'fulham.svg',
  hull: 'hull.svg',
  ipswich: 'ipswich.svg',
  leeds: 'leeds.svg',
  liverpool: 'liverpool.svg',
  'manchester-city': 'manchester-city.svg',
  'manchester-united': 'manchester-united.svg',
  newcastle: 'newcastle.svg',
  'nottingham-forest': 'nottingham-forest.svg',
  sunderland: 'sunderland.svg',
  tottenham: 'tottenham.svg',
};

/** Logos de liga en `public/logos/ligas/`, por slug del nombre de la liga. */
export const LEAGUE_LOGOS: Readonly<Record<string, string>> = {
  'premier-league': 'ligas/premier-league.svg',
};

export const TEAM_LOGOS_BASE = 'logos/';

const conBase = (m: Readonly<Record<string, string>>) =>
  Object.fromEntries(Object.entries(m).map(([k, archivo]) => [k, TEAM_LOGOS_BASE + archivo]));

/** Mapa clave -> URL del escudo. Token para poder reemplazarlo en tests. */
export const TEAM_LOGO_URLS = new InjectionToken<Readonly<Record<string, string>>>(
  'TEAM_LOGO_URLS',
  { providedIn: 'root', factory: () => conBase(TEAM_LOGOS) },
);

/** Mapa slug de liga -> URL del logo. */
export const LEAGUE_LOGO_URLS = new InjectionToken<Readonly<Record<string, string>>>(
  'LEAGUE_LOGO_URLS',
  { providedIn: 'root', factory: () => conBase(LEAGUE_LOGOS) },
);
