import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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

  private readonly seedProducts: Product[] = [
    {
      sku: 'CAM-001',
      name: 'Camiseta Titular 2026',
      category: 'Fútbol',
      price: 39.99,
      stock: 100,
      description: 'Camiseta oficial de local para la temporada',
    },
    {
      sku: 'CAM-002',
      name: 'Camiseta Visitante 2026',
      category: 'Fútbol',
      price: 39.99,
      stock: 80,
      description: 'Camiseta alternativa de visitante',
    },
    {
      sku: 'CAM-003',
      name: 'Camiseta Retro Edición Especial',
      category: 'Colección',
      price: 49.99,
      stock: 25,
      description: 'Diseño clásico conmemorativo',
    },
  ];

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
