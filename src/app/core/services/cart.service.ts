import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, concat, last, map, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AddCartItemRequest,
  CANTIDAD_MAXIMA_POR_SKU,
  CARRITO_VACIO,
  CartDTO,
  CartItemDTO,
  CheckoutRequest,
  CheckoutResponse,
  ShippingRequest,
} from '../models/cart.model';
import { Product } from '../models/product.model';
import { ApiError, toApiError } from '../http/api-error';

/**
 * Carrito persistido en el backend (/api/v1/carrito, CUSTOMER + Checkout.Create).
 * El estado local es solo un espejo del último CartDTO recibido.
 * El precio lo envía el cliente: se muestra pero es informativo.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.cart}`;

  private readonly _cart = signal<CartDTO>(CARRITO_VACIO);
  readonly cart = this._cart.asReadonly();
  readonly items = computed(() => this._cart().items);
  readonly itemCount = computed(() => this._cart().items.reduce((n, i) => n + i.cantidad, 0));
  readonly loaded = signal(false);

  private readonly errorMap = {
    business: 'No se puede superar 99 unidades por producto.',
    not_found: 'El producto ya no está en tu carrito.',
  };

  private wrap(obs: Observable<CartDTO>): Observable<CartDTO> {
    return obs.pipe(
      tap((c) => {
        this._cart.set(c);
        this.loaded.set(true);
      }),
      catchError((e) => throwError(() => (isApiErr(e) ? e : toApiError(e, this.errorMap)))),
    );
  }

  /** GET /carrito */
  load(): Observable<CartDTO> {
    return this.wrap(this.http.get<CartDTO>(this.apiUrl));
  }

  /** POST /carrito/items (si el sku ya existe el backend suma unidades; 422 si pasa de 99). */
  addItem(product: Product, cantidad = 1): Observable<CartDTO> {
    const actual = this.items().find((i) => i.sku === product.sku)?.cantidad ?? 0;
    if (actual + cantidad > CANTIDAD_MAXIMA_POR_SKU) {
      return throwError(() => localError('business', this.errorMap.business));
    }
    const body: AddCartItemRequest = {
      sku: product.sku,
      nombre: product.name,
      categoria: product.category || undefined,
      precioUnitario: product.price,
      cantidad,
    };
    return this.wrap(this.http.post<CartDTO>(`${this.apiUrl}/items`, body));
  }

  /** DELETE /carrito/items/{sku} */
  removeItem(sku: string): Observable<CartDTO> {
    return this.wrap(this.http.delete<CartDTO>(`${this.apiUrl}/items/${encodeURIComponent(sku)}`));
  }

  /**
   * No existe PUT de cantidad: subir = POST con la diferencia; bajar = DELETE + POST.
   * (No es atómico: si el POST falla, el ítem queda eliminado y se informa el error.)
   */
  setQuantity(item: CartItemDTO, nueva: number): Observable<CartDTO> {
    if (!Number.isInteger(nueva) || nueva < 0 || nueva > CANTIDAD_MAXIMA_POR_SKU) {
      return throwError(() => localError('validation', 'La cantidad debe estar entre 1 y 99.'));
    }
    if (nueva === item.cantidad) return of(this._cart());
    if (nueva === 0) return this.removeItem(item.sku);

    const body = (cantidad: number): AddCartItemRequest => ({
      sku: item.sku,
      nombre: item.nombre,
      categoria: item.categoria ?? undefined,
      precioUnitario: item.precioUnitario,
      cantidad,
    });
    if (nueva > item.cantidad) {
      return this.wrap(
        this.http.post<CartDTO>(`${this.apiUrl}/items`, body(nueva - item.cantidad)),
      );
    }
    return this.removeItem(item.sku).pipe(
      switchMap(() => this.wrap(this.http.post<CartDTO>(`${this.apiUrl}/items`, body(nueva)))),
    );
  }

  /** PUT /carrito/envio */
  setShipping(req: ShippingRequest): Observable<CartDTO> {
    return this.wrap(this.http.put<CartDTO>(`${this.apiUrl}/envio`, req));
  }

  /**
   * POST /carrito/checkout -> 202 { requestId, status: PROCESSING }. ASÍNCRONO: el pedido
   * aparece después en /orders. Tras el 202 se consulta GET /carrito para reflejar lo que dejó
   * el backend; si los ítems comprados siguen ahí (el backend no vació el carrito), se eliminan.
   * Todo es best effort: si falla, el checkout ya fue aceptado y se informa igual.
   */
  checkout(): Observable<CheckoutResponse> {
    const items = this.items();
    if (items.length === 0) {
      return throwError(() => localError('validation', 'Tu carrito está vacío.'));
    }
    const body: CheckoutRequest = {
      items: items.map((i) => ({ sku: i.sku, quantity: i.cantidad, unitPrice: i.precioUnitario })),
    };
    return this.http.post<CheckoutResponse>(`${this.apiUrl}/checkout`, body).pipe(
      catchError((e) =>
        throwError(() =>
          toApiError(e, {
            business: 'Tu cuenta no tiene un correo asociado; no se puede crear el pedido.',
          }),
        ),
      ),
      switchMap((res) =>
        this.http.get<CartDTO>(this.apiUrl).pipe(
          tap((c) => this._cart.set(c)),
          map((c) => c.items.filter((i) => items.some((comprado) => comprado.sku === i.sku))),
          catchError(() => of(items)),
          switchMap((pendientes) => (pendientes.length ? this.clearItems(pendientes) : of(null))),
          map(() => res),
        ),
      ),
    );
  }

  private clearItems(items: CartItemDTO[]): Observable<unknown> {
    const deletes = items.map((i) =>
      this.http.delete<CartDTO>(`${this.apiUrl}/items/${encodeURIComponent(i.sku)}`).pipe(
        tap((c) => this._cart.set(c)),
        catchError(() => of(null)),
      ),
    );
    return concat(...deletes).pipe(last(undefined, null));
  }

  /** Limpia el espejo local (logout). */
  reset(): void {
    this._cart.set(CARRITO_VACIO);
    this.loaded.set(false);
  }
}

function isApiErr(e: unknown): e is ApiError {
  return !!e && typeof e === 'object' && 'kind' in e;
}

function localError(kind: ApiError['kind'], message: string): ApiError {
  return { kind, status: kind === 'business' ? 422 : 400, message, retryable: false };
}
