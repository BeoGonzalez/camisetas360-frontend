/** Contrato del endpoint público GET /api/v1/catalog/products. */
export interface Product {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
}
export type ProductDTO = Product;
