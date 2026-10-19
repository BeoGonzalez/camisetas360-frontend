import { Product } from './product.model';

/**
 * Elemento individual recomendado generado por el modelo de IA (Mistral AI)
 */
export interface RecommendedItem {
  name: string;
  reason: string;
  // Campos enriquecidos con datos reales del catálogo si hay coincidencia
  matchedProduct?: Product;
}

/**
 * Estructura de recomendación procesada por el microservicio Recommendation
 */
export interface Recommendation {
  id?: number;
  orderId?: number;
  customerEmail?: string;
  explanation: string;
  recommendations: RecommendedItem[];
  createdAt?: string;
  isFallback?: boolean;
}

/**
 * Estado del pipeline asíncrono de recomendación
 */
export type RecommendationStatus = 'IDLE' | 'PROCESSING' | 'COMPLETED' | 'UNAVAILABLE';

