import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/http/api-error';

function crear(getProfile: () => unknown) {
  const auth = {
    getProfile: vi.fn(getProfile),
    logout: vi.fn(),
    userInitials: signal('AN'),
    userRoles: signal(['CUSTOMER']),
    canSeeRecommendations: signal(false),
  };
  TestBed.configureTestingModule({
    imports: [ProfileComponent],
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
  const f = TestBed.createComponent(ProfileComponent);
  f.detectChanges();
  return { f, auth, el: f.nativeElement as HTMLElement };
}

const boton = (el: HTMLElement) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Cerrar sesión'));

describe('ProfileComponent', () => {
  it('"Cerrar sesión" cierra la sesión y se deshabilita para evitar doble clic', () => {
    const { f, auth, el } = crear(() =>
      of({ userId: 'u1', tenantId: null, email: 'ana@x.cl', name: 'Ana' }),
    );
    const b = boton(el)!;
    expect(b).toBeDefined();
    b.click();
    f.detectChanges();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(b.disabled).toBe(true);
    expect(b.textContent).toContain('Cerrando sesión');
  });

  it('se puede cerrar sesión aunque el perfil no haya cargado', () => {
    const error: ApiError = {
      kind: 'unavailable',
      status: 503,
      message: 'Servicio no disponible',
      retryable: true,
    } as ApiError;
    const { el } = crear(() => throwError(() => error));
    expect(boton(el)).toBeDefined();
  });
});
