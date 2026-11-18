import { COLORES_ALBUM, TEAM_COLORS, coloresEquipo, estiloEquipo } from './team-colors';

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const PAPER = '#f3efe6';
const PAPER_2 = '#e9e3d6';

describe('colores de equipo', () => {
  it.each(Object.entries({ album: COLORES_ALBUM, ...TEAM_COLORS }))(
    '%s cumple AA: texto sobre su color y acento sobre el papel',
    (_, k) => {
      expect(contraste(k.sobre, k.primario)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(k.acento, PAPER)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(k.acento, PAPER_2)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('reconoce el nombre con tildes, mayúsculas o alias', () => {
    expect(coloresEquipo('Manchester City')).toBe(TEAM_COLORS['manchester-city']);
    expect(coloresEquipo('Wolves')).toBe(TEAM_COLORS['wolverhampton']);
    expect(coloresEquipo('Tottenham Hotspur')).toBe(TEAM_COLORS['tottenham']);
  });

  it('un equipo desconocido o vacío usa las tintas del álbum', () => {
    expect(coloresEquipo('Club Inventado')).toBe(COLORES_ALBUM);
    expect(coloresEquipo(null)).toBe(COLORES_ALBUM);
  });

  it('estiloEquipo expone las variables CSS de la página', () => {
    expect(estiloEquipo('Arsenal')).toEqual({
      '--eq': '#db0007',
      '--eq-2': '#063672',
      '--eq-sobre': '#ffffff',
      '--eq-acento': '#b80006',
    });
  });
});
