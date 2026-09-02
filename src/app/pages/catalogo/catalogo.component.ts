import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-gray-800">Catálogo de Camisetas</h2>
      <p class="text-gray-500 mt-2">Equipos de las 5 grandes ligas (Temporada Actual)</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
      <!-- Iteración sobre los productos -->
      <div *ngFor="let prod of productos" class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
        <div class="h-48 bg-gray-200 flex items-center justify-center">
          <span class="text-gray-400">Imagen de {{ prod.sku }}</span>
        </div>
        <div class="p-4">
          <h3 class="font-bold text-lg text-gray-800">{{ prod.equipo || 'Camiseta ' + prod.sku }}</h3>
          <p class="text-blue-600 font-bold mt-2">\${{ prod.precio || '45.000' }}</p>
          <button (click)="agregarAlCarrito(prod)" class="mt-4 w-full bg-gray-900 text-white py-2 rounded hover:bg-gray-800 transition">
            Añadir al Carrito
          </button>
        </div>
      </div>
    </div>
  `
})
export class CatalogoComponent implements OnInit {
  productos: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarProductos();
  }

  cargarProductos() {
    // Llama a tu AWS API Gateway que enruta al microservicio 1 (Catálogo)
    this.http.get<any[]>(`${environment.apiGateway}/api/v1/catalogo/productos`)
      .subscribe({
        next: (data) => this.productos = data,
        error: (err) => console.error('Error al cargar catálogo', err)
      });
  }

  agregarAlCarrito(producto: any) {
    console.log('Agregado:', producto);
    // Aquí conectaremos un servicio de estado de Angular (Signals o BehaviorSubject)
    alert('Camiseta agregada temporalmente.');
  }
}