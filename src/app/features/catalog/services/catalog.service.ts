import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Product } from '../../../core/models/product.model';

/**
 * Servicio dedicado al consumo del microservicio de catálogo.
 *
 * Todas las peticiones apuntan al API Gateway configurado en environment.ts
 * La lista de productos es pública y no requiere token.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.catalog}`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Obtiene la lista completa de productos del catálogo.
   * GET /api/v1/catalog/products
   */
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/products`);
  }

  /**
   * Obtiene un producto específico por su ID.
   * GET /api/v1/catalog/products/:id
   */
  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/products/${id}`);
  }
}
