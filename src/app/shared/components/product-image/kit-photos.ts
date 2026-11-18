import { InjectionToken } from '@angular/core';
import { KitType } from '../../../core/models/product.model';
import { claveEquipo } from '../../utils/team-colors';

/**
 * Fotos estáticas de las camisetas 2026/27 en `public/camisetas/`, nombradas
 * `{clave del equipo}-{local|visitante|alternativa}.avif` (clave = `claveEquipo`).
 *
 * Se muestran cuando el producto no tiene foto en el backend (`imageVersion` null). Una foto
 * subida desde /admin/productos siempre tiene prioridad.
 *
 * Para agregar un equipo: copia sus 3 archivos a `public/camisetas/` y suma su clave aquí.
 */
export const EQUIPOS_CON_FOTOS: readonly string[] = [
  'arsenal',
  'aston-villa',
  'bournemouth',
  'brentford',
  'brighton',
  'chelsea',
  'coventry',
  'crystal-palace',
  'everton',
  'fulham',
  'hull',
  'ipswich',
  'leeds',
  'liverpool',
  'manchester-city',
  'manchester-united',
  'newcastle',
  'nottingham-forest',
  'sunderland',
  'tottenham',
];

const ARCHIVO_TIPO: Record<KitType, string> = {
  LOCAL: 'local',
  VISITANTE: 'visitante',
  ALTERNATIVA: 'alternativa',
};

export type BuscarFotoCamiseta = (
  team: string | null | undefined,
  kitType: KitType | null | undefined,
) => string | null;

/** URL de la foto estática de la camiseta, o null si no hay (equipo o tipo sin foto). */
export const KIT_PHOTO = new InjectionToken<BuscarFotoCamiseta>('KIT_PHOTO', {
  providedIn: 'root',
  factory: () => {
    const equipos = new Set(EQUIPOS_CON_FOTOS);
    return (team, kitType) => {
      const clave = claveEquipo(team);
      return clave && kitType && equipos.has(clave)
        ? `camisetas/${clave}-${ARCHIVO_TIPO[kitType]}.avif`
        : null;
    };
  },
});
