import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { authGuard } from './auth.guard';
import { CognitoAuthService } from '../services/cognito-auth.service';

describe('authGuard', () => {
  let cuentaEntra: object | null;
  let cognito: boolean;

  beforeEach(() => {
    cuentaEntra = null;
    cognito = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MsalService, useValue: { instance: { getActiveAccount: () => cuentaEntra } } },
        { provide: CognitoAuthService, useValue: { isLoggedIn: () => cognito } },
      ],
    });
  });

  const run = (url = '/perfil') =>
    TestBed.runInInjectionContext(() => authGuard({} as never, { url } as never));

  it('permite con cuenta Entra activa', () => {
    cuentaEntra = { username: 'u' };
    expect(run()).toBe(true);
  });

  it('permite con sesión Cognito', () => {
    cognito = true;
    expect(run()).toBe(true);
  });

  it('sin sesión devuelve un UrlTree real a /auth/login con returnUrl', () => {
    const res = run('/perfil?tab=1');
    expect(res).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(res as UrlTree)).toBe(
      '/auth/login?returnUrl=%2Fperfil%3Ftab%3D1',
    );
  });
});
