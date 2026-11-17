import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CheckoutResponse } from '../models/cart.model';
import { OrderResponse } from '../models/order-response.model';
import { CartService } from './cart.service';
import { OrdersService } from './orders.service';

export type EstadoSeguimiento = 'BUSCANDO' | 'ENCONTRADO' | 'NO_ENCONTRADO' | 'ERROR';

/**
 * Compra registrada en este navegador tras un checkout 202.
 * Solo contiene identificadores y montos (nunca datos de tarjeta ni tokens).
 */
export interface CompraRegistrada {
  requestId: string;
  /** totalAmount del 202 (items, sin envío). */
  totalAmount: number;
  /** Lo que se cobra en pagos: total del carrito mostrado al cliente (incluye envío). */
  montoPago: number;
  createdAt: string;
  estado: EstadoSeguimiento;
  orderId?: number;
}

const STORAGE_KEY = 'c360_compras';
const MAX_REGISTROS = 20;

/**
 * Orquesta checkout -> polling de orders -> datos para pagar.
 *
 * SUPUESTO (brecha #2): pagos exige `ordenId` UUID; orders usa `orderId` Long y el backend no
 * guarda el requestId en el pedido. Se paga con el `requestId` del checkout
 * (environment.pagos.ordenIdFuente) y la relación requestId <-> orderId se conoce solo en el
 * navegador que hizo el checkout, por correlación del polling. `ordenIdParaPago` es el único
 * punto que decide el identificador.
 */
@Injectable({ providedIn: 'root' })
export class CheckoutTrackerService {
  private readonly cart = inject(CartService);
  private readonly orders = inject(OrdersService);

  readonly compras = signal<CompraRegistrada[]>(this.read());
  /** requestIds con polling en curso (evita duplicarlo al navegar). */
  private readonly activos = new Set<string>();

  /** Identificador que se envía como `ordenId` a pagos. */
  static ordenIdParaPago(c: Pick<CompraRegistrada, 'requestId'>): string {
    // environment.pagos.ordenIdFuente === 'checkoutRequestId' (única fuente UUID disponible hoy).
    // Si el backend expone un UUID de pedido, este es el único lugar a cambiar.
    const fuente: 'checkoutRequestId' = environment.pagos.ordenIdFuente; // falla al compilar si cambia
    void fuente;
    return c.requestId;
  }

  porRequestId(requestId: string): CompraRegistrada | undefined {
    return this.compras().find((c) => c.requestId === requestId);
  }

  porOrderId(orderId: number): CompraRegistrada | undefined {
    return this.compras().find((c) => c.orderId === orderId);
  }

  /**
   * Toma la línea base de pedidos, hace checkout (202) y deja corriendo el polling.
   * Emite la compra registrada en cuanto el backend acepta el checkout.
   */
  checkout(): Observable<CompraRegistrada> {
    const montoPago = this.cart.cart().total;
    return this.orders.getOrders().pipe(
      map((list) => new Set(list.map((o) => o.orderId))),
      catchError(() => of(new Set<number>())),
      switchMap((knownIds) => this.cart.checkout().pipe(map((res) => ({ res, knownIds })))),
      map(({ res, knownIds }) => {
        const compra = this.registrar(res, montoPago);
        this.track(compra, knownIds);
        return compra;
      }),
    );
  }

  /** Reanuda el seguimiento (p. ej. tras recargar la página). */
  retomar(requestId: string): void {
    const c = this.porRequestId(requestId);
    if (c && c.estado !== 'ENCONTRADO' && !this.activos.has(requestId)) {
      this.update(requestId, { estado: 'BUSCANDO' });
      this.track(c, new Set());
    }
  }

  private track(c: CompraRegistrada, knownIds: ReadonlySet<number>): void {
    if (this.activos.has(c.requestId)) return;
    this.activos.add(c.requestId);
    this.orders
      .waitForNewOrder({ knownIds, since: c.createdAt, totalAmount: c.totalAmount })
      .pipe(
        tap((o: OrderResponse | null) =>
          this.update(
            c.requestId,
            o ? { estado: 'ENCONTRADO', orderId: o.orderId } : { estado: 'NO_ENCONTRADO' },
          ),
        ),
        catchError(() => {
          this.update(c.requestId, { estado: 'ERROR' });
          return of(null);
        }),
        finalize(() => this.activos.delete(c.requestId)),
      )
      .subscribe();
  }

  private registrar(res: CheckoutResponse, montoPago: number): CompraRegistrada {
    const compra: CompraRegistrada = {
      requestId: res.requestId,
      totalAmount: res.totalAmount,
      montoPago: montoPago > 0 ? montoPago : res.totalAmount,
      createdAt: new Date().toISOString(),
      estado: 'BUSCANDO',
    };
    this.save([compra, ...this.compras().filter((x) => x.requestId !== compra.requestId)]);
    return compra;
  }

  private update(requestId: string, patch: Partial<CompraRegistrada>): void {
    this.save(this.compras().map((c) => (c.requestId === requestId ? { ...c, ...patch } : c)));
  }

  private save(list: CompraRegistrada[]): void {
    const trimmed = list.slice(0, MAX_REGISTROS);
    this.compras.set(trimmed);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // almacenamiento no disponible: el seguimiento queda solo en memoria
    }
  }

  private read(): CompraRegistrada[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
