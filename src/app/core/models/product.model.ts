/** Tipo de camiseta (enum KitType del ms catalog). */
export type KitType = 'LOCAL' | 'VISITANTE' | 'ALTERNATIVA';

export const KIT_TYPES: readonly KitType[] = ['LOCAL', 'VISITANTE', 'ALTERNATIVA'];

export const KIT_TYPE_LABEL: Record<KitType, string> = {
  LOCAL: 'Local',
  VISITANTE: 'Visitante',
  ALTERNATIVA: 'Alternativa',
};

/** Contrato de GET /api/v1/catalog/products (ProductDTO del backend). */
export interface Product {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string | null;
  league?: string | null;
  /** Equipo; null en productos que no son de un club. */
  team?: string | null;
  kitType?: KitType | null;
  /**
   * Versión de la foto (epoch ms del último cambio); null = sin foto.
   * La foto se lee en GET /products/{sku}/imagen?v={imageVersion}.
   */
  imageVersion?: number | null;
}
export type ProductDTO = Product;

/** Campos editables (PUT /products/{sku}). El SKU no se puede cambiar. */
export interface ProductUpdateRequest {
  name: string;
  team: string;
  kitType: KitType;
  category: string;
  league: string | null;
  price: number;
  stock: number;
  description: string | null;
}

/** POST /products. */
export interface ProductCreateRequest extends ProductUpdateRequest {
  sku: string;
}
