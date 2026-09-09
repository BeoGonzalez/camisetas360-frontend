import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrderRequestDTO, OrderResponseDTO } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private http = inject(HttpClient);
  // Using the exact route requested
  private apiUrl = `${environment.apiGateway}/api/v1/carrito`;

  /**
   * Envía los ítems seleccionados y retorna el estado de la compra
   */
  checkout(orderRequest: OrderRequestDTO): Observable<OrderResponseDTO> {
    return this.http.post<OrderResponseDTO>(`${this.apiUrl}/checkout`, orderRequest)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    console.error('CartService Error:', error.message);
    return throwError(() => new Error('Ocurrió un error al procesar el carrito. Inténtalo de nuevo más tarde.'));
  }
}
