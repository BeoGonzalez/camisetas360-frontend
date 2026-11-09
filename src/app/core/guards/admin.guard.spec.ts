import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { adminGuard } from './admin.guard';
import { CognitoAuthService } from '../services/cognito-auth.service';

describe('adminGuard', () => {
  let cognitoAuthMock: any;
  let routerMock: any;

  beforeEach(() => {
    cognitoAuthMock = {
      isAdmin: signal(false),
    };

    routerMock = {
      createUrlTree: (commands: any[]) => ({ path: commands.join('/') } as unknown as UrlTree),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: CognitoAuthService, useValue: cognitoAuthMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  it('debe permitir el acceso si el usuario es ADMIN', () => {
    cognitoAuthMock.isAdmin.set(true);
    const result = TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));
    expect(result).toBe(true);
  });

  it('debe redirigir al catálogo si el usuario NO es ADMIN', () => {
    cognitoAuthMock.isAdmin.set(false);
    const result = TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));
    expect(result).toEqual({ path: '/catalog' });
  });
});
