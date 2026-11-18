import { slug } from './slug';

/**
 * Colores de club para las páginas del álbum: cada equipo imprime su página con su color
 * (banda del título, casillero, número y botón). Los colores son los tradicionales de cada
 * camiseta, no escudos ni marcas.
 *
 * - `primario`: banda del título, botón de compra y relleno del escudo.
 * - `secundario`: franja (ribete) bajo la banda.
 * - `sobre`: texto sobre `primario` (contraste AA ≥ 4.5:1).
 * - `acento`: el color del club legible como texto sobre el papel (≥ 4.5:1 en paper y paper-2).
 *
 * `team-colors.spec.ts` verifica los contrastes de todos los equipos.
 */
export interface ColoresEquipo {
  primario: string;
  secundario: string;
  sobre: string;
  acento: string;
}

const c = (
  primario: string,
  secundario: string,
  sobre: string,
  acento = primario,
): ColoresEquipo => ({
  primario,
  secundario,
  sobre,
  acento,
});

const BLANCO = '#ffffff';

/** Equipo sin color registrado (o «Otras camisetas»): las tintas del álbum. */
export const COLORES_ALBUM: ColoresEquipo = c('#1f5f3a', '#161512', '#f3efe6');

export const TEAM_COLORS: Readonly<Record<string, ColoresEquipo>> = {
  arsenal: c('#db0007', '#063672', BLANCO, '#b80006'),
  'aston-villa': c('#670e36', '#95bfe5', BLANCO),
  bournemouth: c('#da291c', '#111111', BLANCO, '#b8231a'),
  brentford: c('#d20a11', '#111111', BLANCO, '#b80a10'),
  brighton: c('#0057b8', '#ffcd00', BLANCO),
  burnley: c('#6c1d45', '#99d6ea', BLANCO),
  chelsea: c('#034694', '#dba111', BLANCO),
  coventry: c('#59cbe8', '#0b1f3a', '#0b1f3a', '#1b6a8a'),
  'crystal-palace': c('#1b458f', '#c4122e', BLANCO),
  everton: c('#003399', BLANCO, BLANCO),
  fulham: c('#141414', '#cc0000', BLANCO),
  hull: c('#f5a12d', '#111111', '#111111', '#8a5300'),
  ipswich: c('#0044a9', '#de2c37', BLANCO),
  leeds: c('#1d428a', '#ffcd00', BLANCO),
  leicester: c('#003090', '#fdbe11', BLANCO),
  liverpool: c('#c8102e', '#00b2a9', BLANCO, '#b00e28'),
  'manchester-city': c('#6cabdd', '#1c2c5b', '#1c2c5b', '#24639a'),
  'manchester-united': c('#da291c', '#fbe122', BLANCO, '#b8231a'),
  middlesbrough: c('#d0021b', '#111111', BLANCO, '#b80218'),
  newcastle: c('#241f20', '#41b6e6', BLANCO),
  'nottingham-forest': c('#d10a11', BLANCO, BLANCO, '#b8090f'),
  'sheffield-united': c('#d71920', '#111111', BLANCO, '#b8141b'),
  southampton: c('#d71920', '#130c0e', BLANCO, '#b8141b'),
  sunderland: c('#d6142a', '#111111', BLANCO, '#b8141b'),
  tottenham: c('#132257', BLANCO, BLANCO),
  'west-ham': c('#7a263a', '#1bb1e7', BLANCO),
  wolverhampton: c('#fdb913', '#231f20', '#231f20', '#7a5600'),
};

/** Otros nombres con que puede venir el equipo desde el catálogo. */
const ALIAS: Readonly<Record<string, string>> = {
  'afc-bournemouth': 'bournemouth',
  'brighton-hove-albion': 'brighton',
  'brighton-and-hove-albion': 'brighton',
  'coventry-city': 'coventry',
  'fulham-fc': 'fulham',
  'hull-city': 'hull',
  'hull-city-afc': 'hull',
  'liverpool-fc': 'liverpool',
  'arsenal-fc': 'arsenal',
  'chelsea-fc': 'chelsea',
  'everton-fc': 'everton',
  'ipswich-town-fc': 'ipswich',
  'aston-villa-fc': 'aston-villa',
  'brentford-fc': 'brentford',
  'sunderland-afc': 'sunderland',
  'ipswich-town': 'ipswich',
  'leeds-united': 'leeds',
  'leicester-city': 'leicester',
  'man-city': 'manchester-city',
  'man-united': 'manchester-united',
  'man-utd': 'manchester-united',
  'manchester-utd': 'manchester-united',
  'newcastle-united': 'newcastle',
  'nottm-forest': 'nottingham-forest',
  'sheffield-utd': 'sheffield-united',
  'tottenham-hotspur': 'tottenham',
  spurs: 'tottenham',
  'west-ham-united': 'west-ham',
  wolves: 'wolverhampton',
  'wolverhampton-wanderers': 'wolverhampton',
};

/**
 * Clave canónica del equipo (slug + alias): "Leeds United" -> 'leeds', "Wolves" -> 'wolverhampton'.
 * La usan los colores y los escudos (`team-logos.ts`).
 */
export function claveEquipo(team: string | null | undefined): string {
  if (!team?.trim()) return '';
  const s = slug(team);
  return ALIAS[s] ?? s;
}

export function coloresEquipo(team: string | null | undefined): ColoresEquipo {
  return TEAM_COLORS[claveEquipo(team)] ?? COLORES_ALBUM;
}

/** Variables CSS de la página del equipo: `--eq`, `--eq-2`, `--eq-sobre`, `--eq-acento`. */
export function estiloEquipo(team: string | null | undefined): Record<string, string> {
  const k = coloresEquipo(team);
  return {
    '--eq': k.primario,
    '--eq-2': k.secundario,
    '--eq-sobre': k.sobre,
    '--eq-acento': k.acento,
  };
}
