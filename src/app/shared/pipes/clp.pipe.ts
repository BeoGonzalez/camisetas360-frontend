import { Pipe, PipeTransform } from '@angular/core';

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

/** Pesos chilenos sin decimales: 94990 → "$94.990". */
@Pipe({ name: 'clp', standalone: true })
export class ClpPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null || Number.isNaN(value) ? '' : CLP.format(value);
  }
}
