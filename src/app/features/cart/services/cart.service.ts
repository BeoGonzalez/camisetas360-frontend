import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CartItem } from '../../../core/models/cart-item.model';
import { Product } from '../../../core/models/product.model';

/**
 * Servicio de carrito de compras con estado reactivo basado en Angular Signals.
 *
 * Gestiona los ítems del carrito en memoria y expone señales computadas
 * para totales y conteo. El checkout se envía al microservicio de carrito.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  /** Estado interno del carrito */
  private readonly _items = signal<CartItem[]>([]);

  /** Señal pública de solo lectura con los ítems del carrito */
  readonly items = this._items.asReadonly();

  /** Cantidad total de ítems en el carrito */
  readonly itemCount = computed(() =>
    this._items().reduce((total, item) => total + item.quantity, 0)
  );

  /** Subtotal calculado del carrito */
  readonly total = computed(() =>
    this._items().reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    )
  );

  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.cart}`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Agrega un producto al carrito.
   * Si el producto ya existe con la misma talla, incrementa la cantidad.
   */
  addToCart(product: Product, talla: string, quantity: number = 1): void {
    const currentItems = this._items();
    const existingIndex = currentItems.findIndex(
      (item) => item.productId === product.id && item.talla === talla
    );

    if (existingIndex >= 0) {
      // Incrementar cantidad si ya existe
      const updatedItems = [...currentItems];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: updatedItems[existingIndex].quantity + quantity,
      };
      this._items.set(updatedItems);
    } else {
      // Agregar nuevo ítem
      const newItem: CartItem = {
        productId: product.id,
        sku: product.sku,
        equipo: product.equipo,
        quantity,
        unitPrice: product.precio,
        imagenUrl: product.imagenUrl,
        talla,
      };
      this._items.set([...currentItems, newItem]);
    }
  }

  /** Elimina un ítem del carrito por su productId y talla */
  removeFromCart(productId: string, talla: string): void {
    this._items.set(
      this._items().filter(
        (item) => !(item.productId === productId && item.talla === talla)
      )
    );
  }

  /** Actualiza la cantidad de un ítem específico */
  updateQuantity(productId: string, talla: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId, talla);
      return;
    }

    const updatedItems = this._items().map((item) =>
      item.productId === productId && item.talla === talla
        ? { ...item, quantity }
        : item
    );
    this._items.set(updatedItems);
  }

  /** Vacía completamente el carrito */
  clearCart(): void {
    this._items.set([]);
  }

  /**
   * Envía la orden de compra al microservicio de carrito.
   * POST /api/v1/carrito/checkout
   * El interceptor JWT inyecta automáticamente el Bearer Token.
   */
  checkout(): Observable<{ orderId: string; status: string }> {
    const orderRequest = { items: this._items() };
    return this.http.post<{ orderId: string; status: string }>(
      `${this.apiUrl}/checkout`,
      orderRequest
    );
  }
}
