/** GET /api/v1/analytics/recomendaciones */
export interface RecomendacionItem {
  sku: string;
  nombre: string;
  categoria: string;
  precio: number;
  /** 0..1 */
  score: number;
  motivo: string;
}

export interface RecomendacionesResponse {
  items: RecomendacionItem[];
  /** categoría -> afinidad (0..1) */
  perfil: Record<string, number>;
  generadoEn: string | null;
}

/** GET /api/v1/recomendaciones (microservicio recomendaciones). */
export type FuenteRecomendacion = 'MODELO' | 'PESOS' | 'POPULARES';

export interface RecomendacionModeloItem {
  posicion: number;
  sku: string;
  puntaje: number;
  score: number;
  nombre: string;
  categoria: string;
  precio: number;
}

export interface RecomendacionesModeloResponse {
  fuente: FuenteRecomendacion;
  versionModelo: string | null;
  items: RecomendacionModeloItem[];
}
