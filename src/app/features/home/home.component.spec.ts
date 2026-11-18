import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent, TOMOS } from './home.component';
import { AuthService } from '../../core/services/auth.service';

describe('HomeComponent', () => {
  let loggedIn: boolean;
  let customer: boolean;

  beforeEach(() => {
    loggedIn = false;
    customer = false;
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isLoggedIn: () => loggedIn, isCustomer: () => customer },
        },
      ],
    });
  });

  function render() {
    const f = TestBed.createComponent(HomeComponent);
    f.detectChanges();
    return f;
  }

  const links = (el: HTMLElement) =>
    [...el.querySelectorAll<HTMLAnchorElement>('a')].map((a) => a.getAttribute('href'));

  it('no llama al backend', () => {
    render();
    TestBed.inject(HttpTestingController).verify();
  });

  it('lleva al catálogo y, sin sesión, ofrece crear cuenta', () => {
    const el: HTMLElement = render().nativeElement;
    expect(links(el)).toContain('/catalog');
    expect(links(el)).toContain('/auth/login?modo=registro');
    expect(links(el)).not.toContain('/pedidos');
  });

  it('un cliente con sesión ve Mis pedidos en vez de Crear cuenta', () => {
    loggedIn = true;
    customer = true;
    const el: HTMLElement = render().nativeElement;
    expect(links(el)).toContain('/pedidos');
    expect(links(el)).not.toContain('/auth/login?modo=registro');
  });

  it('cada equipo enlaza a su página del catálogo con el slug del índice', () => {
    const el: HTMLElement = render().nativeElement;
    const total = TOMOS.reduce((n, t) => n + t.equipos.length, 0);
    expect(total).toBe(40);
    expect(links(el)).toContain('/catalog?equipo=inter-de-milan');
    expect(links(el)).toContain('/catalog?equipo=brighton-hove-albion');
  });

  it('las pestañas cambian el equipo destacado y sus tres camisetas', () => {
    const f = render();
    const el: HTMLElement = f.nativeElement;
    const fotos = () =>
      [...el.querySelectorAll<HTMLImageElement>('[role="tabpanel"] img[src*="camisetas/"]')].map(
        (i) => i.getAttribute('src'),
      );
    expect(fotos()).toEqual([
      'camisetas/arsenal-local.avif',
      'camisetas/arsenal-visitante.avif',
      'camisetas/arsenal-alternativa.avif',
    ]);
    el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    f.detectChanges();
    expect(fotos()).toEqual([
      'camisetas/inter-local.avif',
      'camisetas/inter-visitante.avif',
      'camisetas/inter-alternativa.avif',
    ]);
    expect(el.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true');
  });
});
