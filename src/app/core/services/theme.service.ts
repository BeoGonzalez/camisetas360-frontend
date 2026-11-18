import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro';

/** Preferencia guardada (solo 'claro' | 'oscuro'; sin datos personales). */
export const CLAVE_TEMA = 'c360_tema';

/**
 * Modo claro / oscuro. Aplica `data-theme="dark"` en <html>: `styles.css` remapea ahí los
 * tokens del álbum (papel, tinta, verde cancha) y Tailwind activa la variante `dark:`.
 * Sin preferencia guardada sigue la del sistema operativo. El script de `index.html` aplica
 * la misma regla antes de que Angular arranque, para que la página no parpadee en claro.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);

  readonly tema = signal<Tema>(this.inicial());

  constructor() {
    effect(() => {
      const oscuro = this.tema() === 'oscuro';
      const html = this.doc.documentElement;
      if (oscuro) html.setAttribute('data-theme', 'dark');
      else html.removeAttribute('data-theme');
      html.style.colorScheme = oscuro ? 'dark' : 'light';
      this.doc
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', oscuro ? '#121310' : '#161512');
    });
  }

  alternar(): void {
    const nuevo: Tema = this.tema() === 'oscuro' ? 'claro' : 'oscuro';
    this.tema.set(nuevo);
    try {
      localStorage.setItem(CLAVE_TEMA, nuevo);
    } catch {
      // Almacenamiento bloqueado: el cambio vale para esta visita.
    }
  }

  private inicial(): Tema {
    try {
      const guardado = localStorage.getItem(CLAVE_TEMA);
      if (guardado === 'claro' || guardado === 'oscuro') return guardado;
    } catch {
      // Sin acceso a localStorage: se usa la preferencia del sistema.
    }
    return this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'oscuro'
      : 'claro';
  }
}
