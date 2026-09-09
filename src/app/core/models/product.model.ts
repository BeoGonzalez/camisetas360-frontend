export interface ProductDTO {
  id: string;
  nombre: string;
  precio: number;
  descripcion: string;
  stock: number;
  imagen: string;
}

export interface Product {
  id: string;
  sku: string;
  equipo: string;
  liga: string;
  temporada: string;
  precio: number;
  stock: number;
  imagenUrl: string;
  tallas: string[];
}
