import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent, rutaSegura } from './login.component';
import { AuthService } from '../../core/services/auth.service';
import { CognitoAuthService } from '../../core/services/cognito-auth.service';

describe('rutaSegura', () => {
  it.each([
    ['/catalog/CAM-001', '/catalog/CAM-001'],
    ['/carrito?x=1', '/carrito?x=1'],
    [null, '/catalog'],
    ['', '/catalog'],
    ['https://evil.example', '/catalog'],
    ['//evil.example', '/catalog'],
    ['/\\evil.example', '/catalog'],
    ['/auth/login', '/catalog'],
  ])('%s -> %s', (entrada, salida) => {
    expect(rutaSegura(entrada)).toBe(salida);
  });
});

describe('LoginComponent', () => {
  let loggedIn: boolean;
  const auth = {
    isLoggedIn: () => loggedIn,
    login: vi.fn(),
    logout: vi.fn(),
    checkAccount: vi.fn(),
    userInitials: () => 'U',
    activeUser: () => 'Usuario',
    userEmail: () => 'u@x.com',
    authProvider: () => 'cognito',
    userRoles: () => ['CUSTOMER'],
  };
  const cognito = {
    login: vi.fn(),
    register: vi.fn(),
    urlHostedUi: vi.fn(),
    completarHostedUi: vi.fn(),
  };

  beforeEach(() => {
    loggedIn = false;
    vi.clearAllMocks();
    cognito.login.mockReturnValue(of({}));
    cognito.register.mockReturnValue(of({}));
    cognito.urlHostedUi.mockResolvedValue('https://cognito.example/oauth2/authorize?x=1');
    cognito.completarHostedUi.mockReturnValue(of('/admin/productos'));
  });

  function render(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: CognitoAuthService, useValue: cognito },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const f = TestBed.createComponent(LoginComponent);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement, navigate };
  }

  async function escribir(f: ReturnType<typeof render>['f'], id: string, valor: string) {
    await f.whenStable(); // ngModel escribe su valor inicial de forma asíncrona
    const input = f.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
  }

  function enviar(el: HTMLElement) {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  function boton(el: HTMLElement, texto: string): HTMLButtonElement {
    return [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)!;
  }

  it('con motivo=comprar explica por qué se pide la sesión', () => {
    const { el } = render({ motivo: 'comprar', returnUrl: '/catalog/CAM-001' });
    expect(el.textContent).toContain('Para comprar necesitas una cuenta.');
  });

  it('inicia sesión con Cognito y vuelve a la camiseta', async () => {
    const { f, el, navigate } = render({ returnUrl: '/catalog/CAM-001', motivo: 'comprar' });
    await escribir(f, 'email', ' ana@x.com ');
    await escribir(f, 'password', 'Secreta1!');
    enviar(el);
    expect(cognito.login).toHaveBeenCalledWith('ana@x.com', 'Secreta1!');
    expect(navigate).toHaveBeenCalledWith('/catalog/CAM-001');
  });

  it('no envía el login vacío', () => {
    const { el, f } = render();
    enviar(el);
    f.detectChanges();
    expect(cognito.login).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('correo y contraseña');
  });

  it('crea la cuenta y vuelve al destino', async () => {
    const { f, el, navigate } = render({ returnUrl: '/catalog/CAM-001' });
    boton(el, 'Crear cuenta').click();
    f.detectChanges();
    await escribir(f, 'nombre', 'Ana');
    await escribir(f, 'email-registro', 'ana@x.com');
    await escribir(f, 'password-registro', 'Secreta1!');
    await escribir(f, 'confirmar', 'Secreta1!');
    enviar(el);
    expect(cognito.register).toHaveBeenCalledWith('ana@x.com', 'Secreta1!', 'Ana');
    expect(navigate).toHaveBeenCalledWith('/catalog/CAM-001');
  });

  it.each([
    ['', 'ana@x.com', 'Secreta1!', 'Secreta1!', 'Ingresa tu nombre.'],
    ['Ana', 'no-es-correo', 'Secreta1!', 'Secreta1!', 'Ingresa un correo válido.'],
    ['Ana', 'ana@x.com', 'debil', 'debil', 'mínimo 8 caracteres'],
    ['Ana', 'ana@x.com', 'Secreta1!', 'Otra123!', 'Las contraseñas no coinciden.'],
  ])('valida el registro antes de enviarlo (%s, %s)', async (nombre, email, pass, conf, error) => {
    const { f, el } = render({ modo: 'registro' });
    await escribir(f, 'nombre', nombre);
    await escribir(f, 'email-registro', email);
    await escribir(f, 'password-registro', pass);
    await escribir(f, 'confirmar', conf);
    enviar(el);
    f.detectChanges();
    expect(cognito.register).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(error);
  });

  it('muestra el error del registro (correo ya usado) y limpia las contraseñas', async () => {
    cognito.register.mockReturnValue(
      throwError(() => new Error('Ya existe una cuenta con ese correo. Inicia sesión.')),
    );
    const { f, el, navigate } = render({ modo: 'registro' });
    await escribir(f, 'nombre', 'Ana');
    await escribir(f, 'email-registro', 'ana@x.com');
    await escribir(f, 'password-registro', 'Secreta1!');
    await escribir(f, 'confirmar', 'Secreta1!');
    enviar(el);
    f.detectChanges();
    await f.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Ya existe una cuenta');
    expect((el.querySelector('#password-registro') as HTMLInputElement).value).toBe('');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('Microsoft Entra ID recibe el destino validado', () => {
    const { el } = render({ returnUrl: '//evil.example' });
    boton(el, 'Microsoft Entra ID').click();
    expect(auth.login).toHaveBeenCalledWith('/catalog');
  });

  it('con sesión y returnUrl sigue directo al destino', () => {
    loggedIn = true;
    const { navigate } = render({ returnUrl: '/catalog/CAM-001' });
    expect(navigate).toHaveBeenCalledWith('/catalog/CAM-001');
  });

  it('Hosted UI: abre la URL con PKCE que arma el servicio', async () => {
    const { f, el } = render({ returnUrl: '/catalog/CAM-001' });
    const irA = vi.spyOn(f.componentInstance, 'irA').mockImplementation(() => undefined);
    boton(el, 'Portal Cognito Hosted UI').click();
    await f.whenStable();
    expect(cognito.urlHostedUi).toHaveBeenCalledWith('/catalog/CAM-001');
    expect(irA).toHaveBeenCalledWith('https://cognito.example/oauth2/authorize?x=1');
  });

  it('callback con code y state: completa el login real (no el usuario demo)', () => {
    const { navigate } = render({ code: 'abc', state: 'st' });
    expect(cognito.completarHostedUi).toHaveBeenCalledWith('abc', 'st');
    expect(cognito.login).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/admin/productos');
  });

  it('callback rechazado muestra el error', () => {
    cognito.completarHostedUi.mockReturnValue(
      throwError(() => new Error('La respuesta de Cognito no es válida o expiró.')),
    );
    const { el, f } = render({ code: 'abc', state: 'malo' });
    f.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no es válida');
  });

  it('callback con error de Cognito (cancelado) no intenta canjear', () => {
    const { el, f } = render({ error: 'access_denied' });
    f.detectChanges();
    expect(cognito.completarHostedUi).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('canceló');
  });
});
