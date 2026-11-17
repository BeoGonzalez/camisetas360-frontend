import { Injectable } from '@angular/core';

const STORAGE_KEY = 'c360_bloqueos_pago';

/**
 * Recuerda, por compra (ordenId), hasta cuándo está bloqueado el pago tras un 429 antifraude,
 * para que recargar la página no permita reintentar antes de tiempo.
 *
 * Solo guarda `{ ordenId: epochMs }`: nunca datos de tarjeta. La autoridad es el backend (que
 * bloquea la TARJETA); esto es UX para que el usuario sepa cuánto esperar.
 */
@Injectable({ providedIn: 'root' })
export class BloqueoPagoService {
  /** Registra el bloqueo y devuelve la hora (epoch ms) en que termina. */
  registrar(ordenId: string, segundos: number, ahora = Date.now()): number {
    const hasta = ahora + Math.max(1, segundos) * 1000;
    const mapa = this.leer(ahora);
    mapa[ordenId] = Math.max(mapa[ordenId] ?? 0, hasta);
    this.escribir(mapa);
    return mapa[ordenId];
  }

  /** Fin del bloqueo vigente de la compra (epoch ms), o null si no hay. Limpia los vencidos. */
  bloqueadoHasta(ordenId: string, ahora = Date.now()): number | null {
    const mapa = this.leer(ahora);
    this.escribir(mapa);
    return mapa[ordenId] ?? null;
  }

  liberar(ordenId: string): void {
    const mapa = this.leer();
    delete mapa[ordenId];
    this.escribir(mapa);
  }

  private leer(ahora = Date.now()): Record<string, number> {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      const mapa: Record<string, number> = {};
      if (raw && typeof raw === 'object') {
        for (const [id, hasta] of Object.entries(raw)) {
          if (typeof hasta === 'number' && hasta > ahora) mapa[id] = hasta;
        }
      }
      return mapa;
    } catch {
      return {};
    }
  }

  private escribir(mapa: Record<string, number>): void {
    try {
      if (Object.keys(mapa).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage no disponible: el bloqueo queda solo en memoria (el backend sigue bloqueando)
    }
  }
}
