import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductDTO } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private http = inject(HttpClient);
  // Using the exact route requested
  private apiUrl = `${environment.apiGateway}/api/v1/catalog`;

  /**
   * Retorna una lista de objetos ProductDTO
   */
  getProducts(): Observable<ProductDTO[]> {
    return this.http.get<ProductDTO[]>(`${this.apiUrl}/products`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    console.error('CatalogService Error:', error.message);
    return throwError(() => new Error('Ocurrió un error al obtener el catálogo. Inténtalo de nuevo más tarde.'));
  }
}
