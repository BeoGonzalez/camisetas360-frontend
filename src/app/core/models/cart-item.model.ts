/**
 * Modelo que representa un ítem dentro del carrito de compras.
 * Mantiene la referencia al producto y la cantidad seleccionada.
 */
export interface CartItem {
  /** Identificador del producto asociado */
  productId: string;

  name: string;
  price: number;

  /** Código SKU del producto */
  sku: string;

  /** Nombre del equipo */
  equipo: string;

  /** Cantidad seleccionada por el usuario */
  quantity: number;

  /** Precio unitario al momento de agregar */
  unitPrice: number;

  /** URL de la imagen del producto */
  imagenUrl: string;

  /** Talla seleccionada */
  talla: string;
}
