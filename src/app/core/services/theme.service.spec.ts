import { TestBed } from '@angular/core/testing';
import { CLAVE_TEMA, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const html = document.documentElement;
  let sistemaOscuro: boolean;

  beforeEach(() => {
    localStorage.removeItem(CLAVE_TEMA);
    html.removeAttribute('data-theme');
    sistemaOscuro = false;
    // jsdom no implementa matchMedia.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (q: string) => ({ matches: sistemaOscuro && q.includes('dark') }) as MediaQueryList,
    });
  });

  afterEach(() => {
    localStorage.removeItem(CLAVE_TEMA);
    html.removeAttribute('data-theme');
  });

  function crear(): ThemeService {
    const s = TestBed.inject(ThemeService);
    TestBed.tick();
    return s;
  }

  it('sin preferencia guardada sigue al sistema operativo', () => {
    sistemaOscuro = true;
    expect(crear().tema()).toBe('oscuro');
    expect(html.getAttribute('data-theme')).toBe('dark');
  });

  it('la preferencia guardada manda sobre la del sistema', () => {
    sistemaOscuro = true;
    localStorage.setItem(CLAVE_TEMA, 'claro');
    expect(crear().tema()).toBe('claro');
    expect(html.hasAttribute('data-theme')).toBe(false);
  });

  it('alternar cambia el tema, lo aplica en <html> y lo recuerda', () => {
    const s = crear();
    s.alternar();
    TestBed.tick();
    expect(s.tema()).toBe('oscuro');
    expect(html.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('oscuro');
    s.alternar();
    TestBed.tick();
    expect(html.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('claro');
  });

  it('ignora valores guardados que no son un tema', () => {
    localStorage.setItem(CLAVE_TEMA, '<script>');
    expect(crear().tema()).toBe('claro');
  });
});
