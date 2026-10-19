import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from './services/auth.service';
import { CognitoAuthService } from '../../core/services/cognito-auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex min-h-[75vh] items-center justify-center px-4 py-8">
      <div class="w-full max-w-md">
        <!-- Tarjeta Principal -->
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <!-- Header con gradiente -->
          <div class="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-8 py-8 text-center text-white">
            <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm shadow-inner">
              <svg class="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h1 class="text-2xl font-extrabold tracking-tight">CAMISETAS 360</h1>
            <p class="mt-1 text-xs text-blue-200/80">Plataforma de E-commerce y Microservicios</p>
          </div>

          <!-- Body -->
          <div class="px-8 py-6">
            @if (authService.isLoggedIn()) {
              <!-- Estado Autenticado -->
              <div class="text-center py-2">
                <div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
                  <span class="text-xl font-bold">{{ authService.userInitials() }}</span>
                </div>
                <h2 class="text-lg font-semibold text-slate-800">¡Hola, {{ authService.activeUser() }}!</h2>
                <p class="mt-1 text-xs text-slate-500">{{ authService.userEmail() }}</p>

                <!-- Badges de proveedor y rol -->
                <div class="mt-3 flex items-center justify-center gap-2">
                  <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                    {{ authService.authProvider() === 'cognito' ? 'AWS Cognito' : 'Azure Entra ID' }}
                  </span>
                  @for (role of authService.userRoles(); track role) {
                    <span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                      {{ role }}
                    </span>
                  }
                </div>

                <div class="mt-6 flex flex-col gap-2">
                  <button
                    (click)="goToCatalog()"
                    class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]">
                    Ir al Catálogo de Camisetas
                  </button>

                  <button
                    (click)="logout()"
                    class="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 hover:text-red-700 active:scale-[0.98]">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            } @else {
              <!-- Formulario de Autenticación con AWS Cognito -->
              <div class="space-y-4">
                <div class="text-center pb-2 border-b border-slate-100">
                  <h3 class="text-sm font-bold text-slate-800">Iniciar Sesión con AWS Cognito</h3>
                  <p class="text-xs text-slate-500 mt-0.5">Ingresa con tus credenciales de usuario de Amazon Cognito</p>
                </div>

                <!-- Mensaje de Error -->
                @if (errorMessage()) {
                  <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {{ errorMessage() }}
                  </div>
                }

                <!-- Inputs de Inicio de Sesión -->
                <form (ngSubmit)="loginWithCognito()" class="space-y-3">
                  <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      [(ngModel)]="email"
                      name="email"
                      required
                      placeholder="usuario@camisetas360.com"
                      class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1">Contraseña</label>
                    <input
                      type="password"
                      [(ngModel)]="password"
                      name="password"
                      required
                      placeholder="••••••••••••"
                      class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  <!-- Botón Principal Cognito -->
                  <button
                    type="submit"
                    [disabled]="loading()"
                    class="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition-all duration-200 hover:from-amber-600 hover:to-amber-700 hover:shadow-lg active:scale-[0.98] disabled:opacity-50">
                    @if (loading()) {
                      <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      <span>Autenticando con Cognito...</span>
                    } @else {
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                      <span>Iniciar Sesión con Cognito</span>
                    }
                  </button>
                </form>

                <!-- Acceso Rápido Demo -->
                <button
                  type="button"
                  (click)="loginWithDemoCredentials()"
                  [disabled]="loading()"
                  class="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100/80 active:scale-[0.98]">
                  <span>Acceso rápido (Usuario Demo Cognito)</span>
                </button>

                <!-- Divider -->
                <div class="relative my-4 flex items-center justify-center">
                  <div class="w-full border-t border-slate-200"></div>
                  <span class="absolute bg-white px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Otras Opciones</span>
                </div>

                <!-- Hosted UI Button -->
                <button
                  type="button"
                  (click)="loginCognitoHostedUI()"
                  class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 active:scale-[0.98]">
                  <svg class="h-4 w-4 text-amber-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  <span>Portal Cognito Hosted UI</span>
                </button>

                <!-- Botón Microsoft Entra ID -->
                <button
                  type="button"
                  (click)="loginMicrosoft()"
                  class="group flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/50 active:scale-[0.98]">
                  <!-- Microsoft Icon -->
                  <svg class="h-4 w-4" viewBox="0 0 21 21" fill="none">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                  </svg>
                  <span>Acceso Microsoft Entra ID</span>
                </button>
              </div>
            }
          </div>
        </div>

        <!-- Footer -->
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

  email = 'usuario@camisetas360.com';
  password = 'Password123!';
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    // Si viene redirigido desde Cognito Hosted UI con code o tokens
    this.handleCognitoCallback();
  }

  /** Procesa el inicio de sesión con AWS Cognito vía Serverless Lambda */
  loginWithCognito(): void {
    if (!this.email || !this.password) {
      this.errorMessage.set('Por favor ingresa tu correo y contraseña.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.cognitoAuth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.authService.checkAccount();
        // Redirigir al catálogo con sesión activa
        this.router.navigate(['/catalog']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.message || 'No se pudo iniciar sesión con AWS Cognito. Revisa tus credenciales.'
        );
      },
    });
  }

  /** Inicio de sesión rápido con credenciales demo preconfiguradas */
  loginWithDemoCredentials(): void {
    this.email = 'usuario@camisetas360.com';
    this.password = 'Password123!';
    this.loginWithCognito();
  }

  /** Procesa callbacks de Hosted UI si se reciben en URL */
  private handleCognitoCallback(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) {
      // Simular resolución de sesión o invocar login demo
      this.loginWithDemoCredentials();
    }
  }

  /** Redirige al usuario hacia la interfaz web alojada de Amazon Cognito */
  loginCognitoHostedUI(): void {
    const domain = environment.cognito.domain;
    const clientId = environment.cognito.clientId;
    const redirectUri = encodeURIComponent(environment.cognito.redirectUri);
    const scopes = environment.cognito.scopes.join('+');

    const cognitoUrl = `${domain}/login?client_id=${clientId}&response_type=code&scope=${scopes}&redirect_uri=${redirectUri}`;
    window.location.href = cognitoUrl;
  }

  loginMicrosoft(): void {
    this.authService.login();
  }

  logout(): void {
    this.authService.logout();
  }

  goToCatalog(): void {
    this.router.navigate(['/catalog']);
  }
}