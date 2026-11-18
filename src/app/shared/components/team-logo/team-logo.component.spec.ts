import { TestBed } from '@angular/core/testing';
import { TeamLogoComponent, iniciales } from './team-logo.component';
import { TEAM_LOGOS, TEAM_LOGO_URLS } from './team-logos';
import { claveEquipo } from '../../utils/team-colors';

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: TEAM_LOGO_URLS,
        useValue: {
          'universidad-de-chile': 'logos/universidad-de-chile.svg',
          leeds: 'logos/leeds.svg',
        },
      },
    ],
  });
});

function crear(team: string | null) {
  const fixture = TestBed.createComponent(TeamLogoComponent);
  fixture.componentRef.setInput('team', team);
  fixture.detectChanges();
  return fixture;
}

describe('TeamLogoComponent', () => {
  it('las claves de TEAM_LOGOS son canónicas (las mismas de los colores del club)', () => {
    for (const clave of Object.keys(TEAM_LOGOS)) {
      expect(claveEquipo(clave), clave).toBe(clave);
    }
  });

  it('usa el escudo registrado, buscando por slug del nombre', () => {
    const el: HTMLElement = crear('Universidad de Chile').nativeElement;
    expect(el.querySelector('img')?.getAttribute('src')).toBe('logos/universidad-de-chile.svg');
  });

  it('reconoce el nombre largo del club ("Leeds United" -> leeds)', () => {
    const el: HTMLElement = crear('Leeds United').nativeElement;
    expect(el.querySelector('img')?.getAttribute('src')).toBe('logos/leeds.svg');
  });

  it('con [lamina] pone el escudo real sobre papel, pero no el de iniciales', () => {
    const real = TestBed.createComponent(TeamLogoComponent);
    real.componentRef.setInput('team', 'Leeds United');
    real.componentRef.setInput('lamina', true);
    real.detectChanges();
    expect(real.nativeElement.classList).toContain('lamina');

    const iniciales = TestBed.createComponent(TeamLogoComponent);
    iniciales.componentRef.setInput('team', 'Arsenal');
    iniciales.componentRef.setInput('lamina', true);
    iniciales.detectChanges();
    expect(iniciales.nativeElement.classList).not.toContain('lamina');
  });

  it('sin escudo registrado muestra las iniciales y no pide archivos', () => {
    const el: HTMLElement = crear('Arsenal').nativeElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[data-testid="escudo-iniciales"]')?.textContent?.trim()).toBe('AR');
  });

  it('si el archivo falla al cargar, cae a las iniciales', () => {
    const fixture = crear('Universidad de Chile');
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[data-testid="escudo-iniciales"]')?.textContent?.trim()).toBe('UC');
  });

  it('sin equipo no muestra nada', () => {
    const el: HTMLElement = crear(null).nativeElement;
    expect(el.querySelector('img, svg')).toBeNull();
  });

  it('es decorativo para lectores de pantalla', () => {
    expect(crear('Arsenal').nativeElement.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('iniciales', () => {
  it.each([
    ['Universidad de Chile', 'UC'],
    ['Arsenal', 'AR'],
    ['Colo-Colo', 'CO'],
    ['Real Madrid', 'RM'],
    ['  Boca   Juniors ', 'BJ'],
  ])('%s -> %s', (team, esperado) => {
    expect(iniciales(team)).toBe(esperado);
  });
});
