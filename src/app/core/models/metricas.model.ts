/** GET /api/v1/analytics/metricas y STOMP /topic/metricas (un snapshot cada 2 s). */
export type TipoAlertaMetricas = 'FRAUDE' | 'NAVEGACION_ANOMALA' | 'PICO_TRAFICO';

export interface MetricasSnapshot {
  generadoEn: string;
  clicsUltimoMinuto: number;
  usuariosActivos: number;
  serieClics: { minuto: string; clics: number }[];
  productosMasVistos: { sku: string; nombre: string; vistas: number }[];
  eventosPorTipo: {
    PRODUCTO_VISTO?: number;
    ITEM_AGREGADO?: number;
    ITEM_ELIMINADO?: number;
    ENVIO_ACTUALIZADO?: number;
  };
  alertas: { tipo: TipoAlertaMetricas; mensaje: string; ocurridoEn: string }[];
}

/** Origen de los datos del dashboard. */
export type FuenteMetricas = 'conectando' | 'websocket' | 'polling' | 'sin-datos';

/**
 * Telemetría de API Gateway WebSocket (producción). Estado acumulado por producto: cada
 * mensaje reemplaza el producto por `sku` (no es un delta).
 */
export interface ProductoTelemetria {
  sku: string;
  nombre: string;
  categoria: string;
  precio: number;
  vistas: number;
  agregados: number;
  actualizadoEn: string;
}

export interface MensajeTelemetria {
  tipo: 'productos.actualizados';
  productos: ProductoTelemetria[];
}
