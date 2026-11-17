import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product, ProductCreateRequest, ProductUpdateRequest } from '../models/product.model';
import { ApiError, toApiError } from '../http/api-error';

/** Tipos de foto que acepta el backend (revisa los bytes, no solo el Content-Type). */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Igual que ProductManagementService.MAX_IMAGE_BYTES. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Administración del catálogo (/api/v1/catalog/products): alta, edición, baja y fotos.
 * El backend exige rol CATALOG_MANAGER o ADMIN (+ Catalog.Read).
 */
@Injectable({ providedIn: 'root' })
export class ProductAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.catalog}/products`;

  create(body: ProductCreateRequest): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, body).pipe(catchError(mapError));
  }

  update(sku: string, body: ProductUpdateRequest): Observable<Product> {
    return this.http.put<Product>(this.url(sku), body).pipe(catchError(mapError));
  }

  remove(sku: string): Observable<void> {
    return this.http.delete<void>(this.url(sku)).pipe(
      map(() => undefined),
      catchError(mapError),
    );
  }

  /** PUT /products/{sku}/imagen con los bytes del archivo. Devuelve el producto con su nueva versión de foto. */
  uploadImage(sku: string, file: File): Observable<Product> {
    const error = validateImage(file);
    if (error) return throwError(() => error);
    return this.http
      .put<Product>(`${this.url(sku)}/imagen`, file, { headers: { 'Content-Type': file.type } })
      .pipe(catchError(mapError));
  }

  deleteImage(sku: string): Observable<Product> {
    return this.http.delete<Product>(`${this.url(sku)}/imagen`).pipe(catchError(mapError));
  }

  private url(sku: string): string {
    return `${this.apiUrl}/${encodeURIComponent(sku)}`;
  }
}

/** Validación previa al envío (el backend repite ambas reglas). */
export function validateImage(file: File): ApiError | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return {
      kind: 'validation',
      status: 415,
      message: 'La foto debe ser JPG, PNG o WebP.',
      retryable: false,
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      kind: 'validation',
      status: 413,
      message: 'La foto no puede superar los 2 MB.',
      retryable: false,
    };
  }
  return null;
}

function mapError(e: unknown): Observable<never> {
  if (e instanceof HttpErrorResponse) {
    const message = SPECIFIC_MESSAGES[e.status];
    if (message) {
      return throwError((): ApiError => ({
        kind: 'validation',
        status: e.status,
        message,
        retryable: false,
      }));
    }
  }
  return throwError(() =>
    toApiError(e, {
      not_found: 'El producto ya no existe. Recarga la lista.',
      forbidden: 'Tu perfil no puede administrar el catálogo.',
    }),
  );
}

const SPECIFIC_MESSAGES: Record<number, string> = {
  409: 'Ya existe un producto con ese SKU.',
  413: 'La foto no puede superar los 2 MB.',
  415: 'La foto debe ser JPG, PNG o WebP.',
};
