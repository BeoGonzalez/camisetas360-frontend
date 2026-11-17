import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BloqueoPagoService } from './bloqueo-pago.service';

describe('BloqueoPagoService', () => {
  let service: BloqueoPagoService;
  // Relativo al reloj real: liberar() filtra los vencidos con Date.now().
  const T0 = Date.now();
  const MIN = 60_000;

  beforeEach(() => {
    localStorage.clear();
    service = TestBed.inject(BloqueoPagoService);
  });
  afterEach(() => localStorage.clear());

  it('registra el bloqueo por compra y lo informa hasta que vence', () => {
    expect(service.registrar('orden-1', 30 * 60, T0)).toBe(T0 + 30 * MIN);
    expect(service.bloqueadoHasta('orden-1', T0 + 29 * MIN)).toBe(T0 + 30 * MIN);
    expect(service.bloqueadoHasta('orden-2', T0)).toBeNull(); // otra compra no queda bloqueada
    expect(service.bloqueadoHasta('orden-1', T0 + 30 * MIN)).toBeNull();
  });

  it('limpia del storage los bloqueos vencidos', () => {
    service.registrar('orden-1', 60, T0);
    service.bloqueadoHasta('orden-1', T0 + 2 * MIN);
    expect(localStorage.getItem('c360_bloqueos_pago')).toBeNull();
  });

  it('un 429 posterior más corto no acorta un bloqueo vigente', () => {
    service.registrar('orden-1', 30 * 60, T0);
    expect(service.registrar('orden-1', 60, T0 + MIN)).toBe(T0 + 30 * MIN);
  });

  it('ignora un storage corrupto o con valores que no son números', () => {
    localStorage.setItem('c360_bloqueos_pago', '{no-json');
    expect(service.bloqueadoHasta('orden-1', T0)).toBeNull();
    localStorage.setItem('c360_bloqueos_pago', JSON.stringify({ 'orden-1': 'mañana' }));
    expect(service.bloqueadoHasta('orden-1', T0)).toBeNull();
  });

  it('liberar quita solo esa compra', () => {
    service.registrar('orden-1', 600, T0);
    service.registrar('orden-2', 600, T0);
    service.liberar('orden-1');
    expect(service.bloqueadoHasta('orden-1', T0)).toBeNull();
    expect(service.bloqueadoHasta('orden-2', T0)).toBe(T0 + 10 * MIN);
  });
});
