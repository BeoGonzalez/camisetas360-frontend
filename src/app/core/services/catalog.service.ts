import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';
import { ApiError, toApiError } from '../http/api-error';

/** Mismo patrón que valida el backend; evita un 400 evitable. */
export const SKU_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Catálogo (/api/v1/catalog). Requiere CUSTOMER/CATALOG_MANAGER/ADMIN + Catalog.Read.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.catalog}`;

  /** GET /products[?sku=A&sku=B]. Filtrar por sku no registra vistas (eso solo lo hace /{sku}). */
  getProducts(skus: readonly string[] = []): Observable<Product[]> {
    let params = new HttpParams();
    for (const sku of skus) params = params.append('sku', sku);
    return this.http
      .get<Product[]>(`${this.apiUrl}/products`, { params })
      .pipe(catchError((e) => throwError(() => toApiError(e))));
  }

  /**
   * GET /products/{sku}. El backend registra la visita (alimenta recomendaciones):
   * llamar SOLO cuando el usuario abre el detalle, nunca para precargar.
   */
  getProduct(sku: string): Observable<Product> {
    if (!SKU_PATTERN.test(sku)) {
      const err: ApiError = {
        kind: 'validation',
        status: 400,
        message: 'El código de producto no es válido.',
        retryable: false,
      };
      return throwError(() => err);
    }
    return this.http
      .get<Product>(`${this.apiUrl}/products/${encodeURIComponent(sku)}`)
      .pipe(
        catchError((e) => throwError(() => toApiError(e, { not_found: 'El producto no existe.' }))),
      );
  }

  /**
   * GET /products/{sku}/imagen?v={version}. Se descarga con HttpClient (lleva el Bearer, que un
   * `<img src>` no puede enviar). `v` cambia con cada foto nueva: cada URL se puede cachear.
   */
  getProductImage(sku: string, version: number): Observable<Blob> {
    return this.http
      .get(`${this.apiUrl}/products/${encodeURIComponent(sku)}/imagen`, {
        params: { v: String(version) },
        responseType: 'blob',
      })
      .pipe(catchError((e) => throwError(() => toApiError(e))));
  }
}
