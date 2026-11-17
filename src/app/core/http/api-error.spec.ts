import { describe, it, expect } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { kindFromStatus, toApiError } from './api-error';

describe('api-error', () => {
  it.each([
    [0, 'network'],
    [400, 'validation'],
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [422, 'business'],
    [429, 'rate_limited'],
    [500, 'server'],
    [503, 'unavailable'],
    [418, 'unknown'],
  ])('status %i -> %s', (status, kind) => {
    expect(kindFromStatus(status)).toBe(kind);
  });

  it('nunca muestra el detalle crudo del ProblemDetail (queda en detail)', () => {
    const e = toApiError(
      new HttpErrorResponse({
        status: 400,
        error: { title: 'Bad Request', detail: 'cantidad: must be less than or equal to 99' },
      }),
    );
    expect(e.kind).toBe('validation');
    expect(e.message).toBe('Los datos enviados no son válidos. Revisa el formulario.');
    expect(e.detail).toBe('cantidad: must be less than or equal to 99');
    expect(e.retryable).toBe(false);
  });

  it('429 -> pago bloqueado por seguridad', () => {
    const e = toApiError(new HttpErrorResponse({ status: 429 }));
    expect(e.message).toBe('Pago bloqueado por seguridad, intenta más tarde.');
    expect(e.retryable).toBe(false);
  });

  it('503 -> servicio no disponible, reintentable', () => {
    const e = toApiError(new HttpErrorResponse({ status: 503 }));
    expect(e.message).toContain('Servicio no disponible');
    expect(e.retryable).toBe(true);
  });

  it('5xx y red son reintentables con mensaje genérico', () => {
    const e = toApiError(
      new HttpErrorResponse({ status: 502, error: { message: 'stack interna' } }),
    );
    expect(e.retryable).toBe(true);
    expect(e.message).not.toContain('stack');
  });

  it('permite sobreescribir el mensaje por tipo', () => {
    const e = toApiError(new HttpErrorResponse({ status: 404 }), { not_found: 'No existe X' });
    expect(e.message).toBe('No existe X');
  });

  it('errores no HTTP -> unknown', () => {
    expect(toApiError(new Error('x')).kind).toBe('unknown');
  });
});
