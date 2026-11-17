import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';
import { AppRole } from '../models/auth.model';

describe('roleGuard / adminGuard', () => {
  let loggedIn: boolean;
  let roles: AppRole[];

  beforeEach(() => {
    loggedIn = true;
    roles = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: () => loggedIn,
            hasAnyRole: (r: AppRole[]) => r.some((x) => roles.includes(x)),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: string[], extras?: unknown) =>
              ({ path: commands.join('/'), extras }) as unknown as UrlTree,
          },
        },
      ],
    });
  });

  const run = (guard: typeof adminGuard) =>
    TestBed.runInInjectionContext(() => guard({} as never, { url: '/x' } as never));

  it('adminGuard permite ADMIN', () => {
    roles = ['ADMIN'];
    expect(run(adminGuard)).toBe(true);
  });

  it('adminGuard redirige a /sin-permiso a un CUSTOMER', () => {
    roles = ['CUSTOMER'];
    expect(run(adminGuard)).toMatchObject({ path: '/sin-permiso' });
  });

  it('sin sesión redirige al login conservando la URL', () => {
    loggedIn = false;
    expect(run(adminGuard)).toEqual({
      path: '/auth/login',
      extras: { queryParams: { returnUrl: '/x' } },
    });
  });

  it('roleGuard acepta cualquiera de los roles indicados', () => {
    roles = ['CATALOG_MANAGER'];
    expect(run(roleGuard('ADMIN', 'CATALOG_MANAGER'))).toBe(true);
    expect(run(roleGuard('CUSTOMER'))).toMatchObject({ path: '/sin-permiso' });
  });
});
