import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Destino de los guards por rol (403 de UX; la autorización real la hace el backend). */
@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div
      class="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"
      role="alert"
    >
      <h1 class="text-2xl font-extrabold text-amber-900">Sin permiso</h1>
      <p class="mt-2 text-sm text-amber-900">
        Tu cuenta no tiene el rol necesario para ver esta sección. Si crees que es un error, pide a
        un administrador que te asigne el rol en Microsoft Entra ID.
      </p>
      <a
        routerLink="/catalog"
        class="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white"
        >Volver al catálogo</a
      >
    </div>
  `,
})
export class ForbiddenComponent {}
