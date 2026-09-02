import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink,CommonModule],
  template: `
    <main class="min-h-screen bg-gray-50">
      <nav class="bg-blue-900 p-4 shadow-md text-white flex justify-between items-center">
        <div class="flex items-center space-x-8">
          <h1 class="text-xl font-bold tracking-wider">CAMISETAS 360</h1>
          <!-- Enlaces de navegación -->
          <div class="space-x-4">
            <a routerLink="/catalogo" class="hover:text-blue-200 transition">Catálogo</a>
            <a routerLink="/carrito" *ngIf="isLoggedIn" class="hover:text-blue-200 transition">Mi Carrito</a>
          </div>
        </div>
        
        <div class="space-x-4">
          <span *ngIf="isLoggedIn" class="font-medium">Hola, {{ activeUser }}</span>
          <button *ngIf="!isLoggedIn" (click)="login()" class="bg-white text-blue-900 px-4 py-2 rounded-md font-bold hover:bg-gray-100 transition">
            Iniciar Sesión
          </button>
          <button *ngIf="isLoggedIn" (click)="logout()" class="bg-red-500 text-white px-4 py-2 rounded-md font-bold hover:bg-red-600 transition">
            Cerrar Sesión
          </button>
        </div>
      </nav>
      
      <div class="container mx-auto p-6">
        <router-outlet></router-outlet>
      </div>
    </main>
  `
})
export class AppComponent implements OnInit {
  isLoggedIn = false;
  activeUser = '';

  constructor(private msalService: MsalService) {}

  ngOnInit(): void {
    this.msalService.instance.handleRedirectPromise().then(res => {
      if (res != null && res.account != null) {
        this.msalService.instance.setActiveAccount(res.account);
      }
      this.checkAccount();
    });
  }

  checkAccount() {
    const activeAccount = this.msalService.instance.getActiveAccount();
    if (activeAccount) {
      this.isLoggedIn = true;
      this.activeUser = activeAccount.name || activeAccount.username;
    }
  }

  login() {
    this.msalService.loginRedirect();
  }

  logout() {
    this.msalService.logoutRedirect();
  }
}