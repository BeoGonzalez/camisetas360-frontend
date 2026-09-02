import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100">
      <h2 class="text-3xl font-bold text-gray-800 mb-6">Tu Carrito de Compras</h2>
      
      <div *ngIf="items.length > 0; else carritoVacio">
        <div class="divide-y divide-gray-200 mb-8">
          <div *ngFor="let item of items" class="py-4 flex justify-between items-center">
            <div>
              <h4 class="font-bold text-gray-800">{{ item.sku }}</h4>
              <p class="text-sm text-gray-500">Cantidad: {{ item.quantity }}</p>
            </div>
            <p class="font-bold text-gray-800">\${{ item.unitPrice * item.quantity }}</p>
          </div>
        </div>
        
        <div class="flex justify-between items-center border-t border-gray-200 pt-6">
          <span class="text-xl font-bold">Total:</span>
          <span class="text-2xl font-bold text-blue-600">\${{ calcularTotal() }}</span>
        </div>
        
        <button (click)="finalizarCompra()" class="mt-6 w-full bg-blue-600 text-white py-3 rounded-md font-bold text-lg hover:bg-blue-700 transition">
          Finalizar Pedido
        </button>
      </div>

      <ng-template #carritoVacio>
        <div class="text-center py-12">
          <p class="text-gray-500 text-lg">Tu carrito está vacío.</p>
        </div>
      </ng-template>
    </div>
  `
})
export class CarritoComponent {
  // Data simulada que luego llenaremos con un servicio de estado
  items: any[] = [
    { sku: 'CAM-RMD-2024', quantity: 1, unitPrice: 45000 },
    { sku: 'CAM-MCI-2024', quantity: 2, unitPrice: 42000 }
  ];

  constructor(private http: HttpClient) {}

  calcularTotal() {
    return this.items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  }

  finalizarCompra() {
    const orderRequest = { items: this.items };
    
    // El MsalInterceptor inyectará el JWT de Azure automáticamente en esta llamada
    this.http.post(`${environment.apiGateway}/api/v1/carrito/checkout`, orderRequest)
      .subscribe({
        next: (res) => {
          alert('¡Pedido registrado exitosamente!');
          this.items = []; // Limpiamos el carrito
        },
        error: (err) => {
          console.error('Error al procesar el pago', err);
          alert('Error en la transacción. Verifica tus permisos de Azure.');
        }
      });
  }
}