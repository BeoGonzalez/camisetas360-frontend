import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CognitoAuthService } from '../../core/services/cognito-auth.service';
import { environment } from '../../../environments/environment';

type Modo = 'login' | 'registro';

const RUTA_POR_DEFECTO = '/catalog';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Política por defecto de Cognito (la Lambda/Cognito es la fuente de verdad). */
const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * Solo rutas internas: evita redirecciones abiertas (`//evil.com`, `https://...`) y volver al login.
 */
export function rutaSegura(url: string | null | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) {
    return RUTA_POR_DEFECTO;
  }
  return url.startsWith('/auth') ? RUTA_POR_DEFECTO : url;
}

/**
 * Login y registro. Opciones: cuenta Camisetas360 (Cognito vía Lambda: iniciar sesión o crear
 * cuenta), Microsoft Entra ID y el portal de Cognito. Respeta `returnUrl` (p. ej. el producto que
 * se quería comprar) y `motivo=comprar` muestra por qué se pide la sesión.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex min-h-[75vh] items-center justify-center px-4 py-8">
      <div class="w-full max-w-md">
        <div class="border-t border-ink">
          <h1 class="album-display pt-8 text-[clamp(34px,6vw,48px)]">
            {{ modo() === 'registro' ? 'Crea tu cuenta' : 'Inicia sesión' }}
          </h1>

          <div class="py-6">
            @if (authService.isLoggedIn()) {
              <div class="py-2 text-center">
                <div
                  class="mx-auto mb-4 flex h-16 w-16 items-center justify-center border border-ink text-ink"
                >
                  <span class="text-xl font-bold">{{ authService.userInitials() }}</span>
                </div>
                <h2 class="text-lg font-semibold text-slate-800">
                  ¡Hola, {{ authService.activeUser() }}!
                </h2>
                <p class="mt-1 text-xs text-slate-500">{{ authService.userEmail() }}</p>
                <div class="mt-3 flex items-center justify-center gap-2">
                  <span
                    class="album-caps inline-flex items-center border border-ink px-2.5 py-1 text-[10px] text-ink"
                  >
                    {{
                      authService.authProvider() === 'cognito' ? 'AWS Cognito' : 'Azure Entra ID'
                    }}
                  </span>
                  @for (role of authService.userRoles(); track role) {
                    <span class="album-caps px-2 py-1 text-[10px] text-pitch">
                      {{ role }}
                    </span>
                  }
                </div>
                <div class="mt-6 flex flex-col gap-2">
                  <button
                    type="button"
                    (click)="continuar()"
                    class="album-caps flex w-full items-center justify-center bg-ink px-5 py-4 text-[11px] text-paper transition-colors hover:bg-pitch"
                  >
                    Ir al Catálogo de Camisetas
                  </button>
                  <button
                    type="button"
                    (click)="logout()"
                    class="album-caps flex w-full items-center justify-center border border-ink px-5 py-4 text-[11px] text-ink transition-colors hover:border-red-700 hover:text-red-700"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            } @else {
              <div class="space-y-4">
                @if (motivoCompra()) {
                  <p role="status" class="border-y border-pitch py-3 text-sm text-pitch">
                    <strong>Para comprar necesitas una cuenta.</strong> Inicia sesión o crea una
                    cuenta y te llevamos de vuelta a la camiseta.
                  </p>
                }

                <!-- Pestañas -->
                <div
                  role="tablist"
                  aria-label="Acceso"
                  class="grid grid-cols-2 border-b border-rule"
                >
                  <button
                    type="button"
                    role="tab"
                    id="tab-login"
                    aria-controls="panel-acceso"
                    [attr.aria-selected]="modo() === 'login'"
                    (click)="cambiarModo('login')"
                    class="album-caps -mb-px border-b-2 px-3 py-3 text-[11px] transition-colors"
                    [class]="
                      modo() === 'login'
                        ? 'border-ink text-ink'
                        : 'border-transparent text-slate-600 hover:text-ink'
                    "
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="tab-registro"
                    aria-controls="panel-acceso"
                    [attr.aria-selected]="modo() === 'registro'"
                    (click)="cambiarModo('registro')"
                    class="album-caps -mb-px border-b-2 px-3 py-3 text-[11px] transition-colors"
                    [class]="
                      modo() === 'registro'
                        ? 'border-ink text-ink'
                        : 'border-transparent text-slate-600 hover:text-ink'
                    "
                  >
                    Crear cuenta
                  </button>
                </div>

                <div
                  id="panel-acceso"
                  role="tabpanel"
                  [attr.aria-labelledby]="modo() === 'login' ? 'tab-login' : 'tab-registro'"
                  class="space-y-3"
                >
                  @if (errorMessage()) {
                    <div role="alert" class="border border-red-700 p-3 text-sm text-red-800">
                      {{ errorMessage() }}
                    </div>
                  }

                  @if (modo() === 'login') {
                    <form (ngSubmit)="loginWithCognito()" class="space-y-3" novalidate>
                      <div>
                        <label
                          for="email"
                          class="album-caps mb-1.5 block text-[10px] text-slate-700"
                          >Correo electrónico</label
                        >
                        <input
                          id="email"
                          type="email"
                          [(ngModel)]="email"
                          name="email"
                          required
                          autocomplete="email"
                          placeholder="tu@correo.com"
                          class="w-full border border-ink bg-transparent px-3 py-3 text-base text-ink outline-none focus:border-pitch focus:ring-0"
                        />
                      </div>
                      <div>
                        <label
                          for="password"
                          class="album-caps mb-1.5 block text-[10px] text-slate-700"
                          >Contraseña</label
                        >
                        <input
                          id="password"
                          type="password"
                          [(ngModel)]="password"
                          name="password"
                          required
                          autocomplete="current-password"
                          class="w-full border border-ink bg-transparent px-3 py-3 text-base text-ink outline-none focus:border-pitch focus:ring-0"
                        />
                      </div>
                      <button
                        type="submit"
                        [disabled]="loading()"
                        class="album-caps flex w-full items-center justify-center bg-ink px-5 py-4 text-[11px] text-paper transition-colors hover:bg-pitch disabled:opacity-50"
                      >
                        {{ loading() ? 'Iniciando sesión…' : 'Iniciar sesión' }}
                      </button>
                    </form>
                    <p class="text-center text-xs text-slate-500">
                      ¿No tienes cuenta?
                      <button
                        type="button"
                        (click)="cambiarModo('registro')"
                        class="font-semibold text-blue-700 hover:underline"
                      >
                        Crea una aquí
                      </button>
                    </p>
                    <button
                      type="button"
                      (click)="loginWithDemoCredentials()"
                      [disabled]="loading()"
                      class="album-caps flex w-full items-center justify-center border border-dashed border-slot px-4 py-3 text-[10px] text-slate-700 transition-colors hover:border-ink hover:text-ink"
                    >
                      Acceso rápido (Usuario Demo Cognito)
                    </button>
                  } @else {
                    <form (ngSubmit)="registrar()" class="space-y-3" novalidate>
                      <div>
                        <label
                          for="nombre"
                          class="album-caps mb-1.5 block text-[10px] text-slate-700"
                          >Nombre</label
                        >
                        <input
                          id="nombre"
                          type="text"
                          [(ngModel)]="nombre"
                          name="nombre"
                          required
                          maxlength="100"
                          autocomplete="name"
                          class="w-full border border-ink bg-transparent px-3 py-3 text-base text-ink outline-none focus:border-pitch focus:ring-0"
                        />
                      </div>
                      <div>
                        <label
                          for="email-registro"
                          class="album-caps mb-1.5 block text-[10px] text-slate-700"
                          >Correo electrónico</label
                        >
                        <input
                          id="email-registro"
                          type="email"
                          [(ngModel)]="email"
                          name="email"
                          required
                          autocomplete="email"
                          placeholder="tu@correo.com"
                          class="w-full border border-ink bg-transparent px-3 py-3 text-base text-ink outline-none focus:border-pitch focus:ring-0"
                        />
                      </div>
                      <div>
                        <label
                          for="password-registro"
                          class="album-caps mb-1.5 block text-[10px] text-slate-700"
                          >Contraseña</label
                        >
                        <input
                          id="password-registro"
                          type="password"
                          [(ngModel)]="password"
                          name="password"
                          required
                          autocomplete="new-password"
                          aria-describedby="password-ayuda"
                          class="w-full border border-ink bg-transparent px-3 py-3 text-base text-ink outline-none focus:border-pitch focus:ring-0"
                        />
                        <p id="password-ayuda" class="mt-1 text-[11px] text-slate-500">
                          Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.
                        </p>
                      </div>
                      <div>
                        <label
                          for="confirmar"
                          class="album-caps mb-1.5 block text-[10px] text-slate-700"
                          >Repite la contraseña</label
                        >
                        <input
                          id="confirmar"
                          type="password"
                          [(ngModel)]="confirmar"
                          name="confirmar"
                          required
                          autocomplete="new-password"
                          class="w-full border border-ink bg-transparent px-3 py-3 text-base text-ink outline-none focus:border-pitch focus:ring-0"
                        />
                      </div>
                      <button
                        type="submit"
                        [disabled]="loading()"
                        class="album-caps flex w-full items-center justify-center bg-ink px-5 py-4 text-[11px] text-paper transition-colors hover:bg-pitch disabled:opacity-50"
                      >
                        {{ loading() ? 'Creando cuenta…' : 'Crear cuenta' }}
                      </button>
                    </form>
                    <p class="text-center text-xs text-slate-500">
                      ¿Ya tienes cuenta?
                      <button
                        type="button"
                        (click)="cambiarModo('login')"
                        class="font-semibold text-blue-700 hover:underline"
                      >
                        Inicia sesión
                      </button>
                    </p>
                  }
                </div>

                <div class="relative my-4 flex items-center justify-center">
                  <div class="w-full border-t border-slate-200"></div>
                  <span class="album-caps absolute bg-paper px-3 text-[10px] text-slate-600"
                    >O continúa con</span
                  >
                </div>

                <button
                  type="button"
                  (click)="loginMicrosoft()"
                  class="album-caps flex w-full items-center justify-center gap-3 border border-ink px-5 py-3.5 text-[11px] text-ink transition-colors hover:bg-ink hover:text-paper"
                >
                  <svg class="h-4 w-4" viewBox="0 0 21 21" fill="none" aria-hidden="true">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                  </svg>
                  Microsoft Entra ID
                </button>
                <button
                  type="button"
                  (click)="loginCognitoHostedUI()"
                  class="album-caps flex w-full items-center justify-center border border-rule px-4 py-3 text-[10px] text-slate-700 transition-colors hover:border-ink hover:text-ink"
                >
                  Portal Cognito Hosted UI
                </button>
                @if (modo() === 'registro') {
                  <p class="text-center text-[11px] text-slate-500">
                    Las cuentas Microsoft Entra ID las crea el administrador de tu organización; si
                    no tienes una, crea tu cuenta Camisetas360 arriba.
                  </p>
                }
              </div>
            }
          </div>
        </div>

        <p class="mt-4 text-center text-xs text-slate-400">
          Camisetas360 · AWS Academy Learner Lab · ECS Fargate & Lambda Serverless
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly cognitoAuth = inject(CognitoAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  nombre = '';
  email = '';
  password = '';
  confirmar = '';
  readonly modo = signal<Modo>('login');
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  private readonly query = this.route.snapshot.queryParamMap;
  /** A dónde volver tras iniciar sesión (solo rutas internas). */
  readonly returnUrl = computed(() => rutaSegura(this.query.get('returnUrl')));
  readonly motivoCompra = computed(() => this.query.get('motivo') === 'comprar');

  ngOnInit(): void {
    if (this.query.get('modo') === 'registro') this.modo.set('registro');
    // Ya con sesión y con destino explícito (p. ej. volvió del login): seguir de largo.
    if (this.authService.isLoggedIn() && this.query.get('returnUrl')) {
      this.router.navigateByUrl(this.returnUrl());
      return;
    }
    this.handleCognitoCallback();
  }

  cambiarModo(modo: Modo): void {
    this.modo.set(modo);
    this.errorMessage.set(null);
    this.password = '';
    this.confirmar = '';
  }

  /** Inicio de sesión con AWS Cognito vía Lambda. */
  loginWithCognito(): void {
    if (!this.email.trim() || !this.password) {
      this.errorMessage.set('Por favor ingresa tu correo y contraseña.');
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.cognitoAuth.login(this.email.trim(), this.password).subscribe({
      next: () => this.entrar(),
      error: (err: Error) => this.fallo(err, 'No se pudo iniciar sesión. Revisa tus credenciales.'),
    });
  }

  /** Crea la cuenta en Cognito (grupo CUSTOMER) y deja la sesión iniciada. */
  registrar(): void {
    const error = this.validarRegistro();
    if (error) {
      this.errorMessage.set(error);
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.cognitoAuth.register(this.email.trim(), this.password, this.nombre.trim()).subscribe({
      next: () => this.entrar(),
      error: (err: Error) => this.fallo(err, 'No se pudo crear la cuenta. Inténtalo nuevamente.'),
    });
  }

  /** Inicio de sesión rápido con credenciales demo preconfiguradas. */
  loginWithDemoCredentials(): void {
    this.email = 'usuario@camisetas360.com';
    this.password = 'Password123!';
    this.loginWithCognito();
  }

  /** Hosted UI de Cognito (OAuth code + PKCE); al volver se completa en handleCognitoCallback. */
  loginCognitoHostedUI(): void {
    this.errorMessage.set(null);
    this.cognitoAuth
      .urlHostedUi(this.returnUrl())
      .then((url) => this.irA(url))
      .catch(() => this.errorMessage.set('No se pudo abrir el portal de Cognito.'));
  }

  /** Navegación fuera de la app (aislada para los tests). */
  irA(url: string): void {
    window.location.assign(url);
  }

  loginMicrosoft(): void {
    this.authService.login(this.returnUrl());
  }

  logout(): void {
    this.authService.logout();
  }

  continuar(): void {
    this.router.navigateByUrl(this.returnUrl());
  }

  private validarRegistro(): string | null {
    if (!this.nombre.trim()) return 'Ingresa tu nombre.';
    if (!EMAIL.test(this.email.trim())) return 'Ingresa un correo válido.';
    if (!PASSWORD.test(this.password)) {
      return 'La contraseña debe tener mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.';
    }
    if (this.password !== this.confirmar) return 'Las contraseñas no coinciden.';
    return null;
  }

  private entrar(): void {
    this.loading.set(false);
    this.password = '';
    this.confirmar = '';
    this.authService.checkAccount();
    this.router.navigateByUrl(this.returnUrl());
  }

  private fallo(err: Error, porDefecto: string): void {
    this.loading.set(false);
    this.password = '';
    this.confirmar = '';
    this.errorMessage.set(err?.message || porDefecto);
  }

  /** Vuelta del Hosted UI: canjea el código por la sesión del usuario que inició sesión. */
  private handleCognitoCallback(): void {
    if (this.query.get('error')) {
      this.errorMessage.set('Cognito canceló o rechazó el inicio de sesión. Inténtalo nuevamente.');
      return;
    }
    const code = this.query.get('code');
    if (!code) return;
    this.loading.set(true);
    this.cognitoAuth.completarHostedUi(code, this.query.get('state')).subscribe({
      next: (destino) => {
        this.loading.set(false);
        this.authService.checkAccount();
        this.router.navigateByUrl(rutaSegura(destino));
      },
      error: (err: Error) => this.fallo(err, 'No se pudo completar el inicio de sesión.'),
    });
  }
}
