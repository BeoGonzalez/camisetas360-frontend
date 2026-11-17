import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { MetricasDashboardComponent } from './metricas-dashboard.component';
import { MetricasService } from '../../core/services/metricas.service';
import { AuthService } from '../../core/services/auth.service';
import {
  FuenteMetricas,
  MetricasSnapshot,
  ProductoTelemetria,
} from '../../core/models/metricas.model';

const snap: MetricasSnapshot = {
  generadoEn: '2026-11-10T10:00:00Z',
  clicsUltimoMinuto: 37,
  usuariosActivos: 5,
  serieClics: [
    { minuto: '2026-11-10T09:58:00Z', clics: 3 },
    { minuto: '2026-11-10T09:59:00Z', clics: 9 },
    { minuto: '2026-11-10T10:00:00Z', clics: 0 },
  ],
  productosMasVistos: [{ sku: 'CAM-1', nombre: 'Titular', vistas: 12 }],
  eventosPorTipo: { PRODUCTO_VISTO: 40, ITEM_AGREGADO: 9 },
  alertas: [
    { tipo: 'FRAUDE', mensaje: 'Tarjeta ****4444 bloqueada', ocurridoEn: '2026-11-10T09:59:00Z' },
  ],
};

describe('MetricasDashboardComponent', () => {
  const service = {
    snapshot: signal<MetricasSnapshot | null>(null),
    fuente: signal<FuenteMetricas>('conectando'),
    error: signal(null),
    productosEnVivo: signal<ProductoTelemetria[]>([]),
    start: vi.fn(),
    stop: vi.fn(),
  };

  beforeEach(() => {
    service.snapshot.set(null);
    service.productosEnVivo.set([]);
    service.start.mockClear();
    service.stop.mockClear();
    TestBed.configureTestingModule({
      imports: [MetricasDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: MetricasService, useValue: service },
        { provide: AuthService, useValue: { isAdmin: () => true } },
      ],
    });
  });

  it('inicia la suscripción al montar y la detiene al destruir', () => {
    const f = TestBed.createComponent(MetricasDashboardComponent);
    f.detectChanges();
    expect(service.start).toHaveBeenCalled();
    f.destroy();
    expect(service.stop).toHaveBeenCalled();
  });

  it('muestra KPIs, serie, top productos y alertas', () => {
    const f = TestBed.createComponent(MetricasDashboardComponent);
    service.snapshot.set(snap);
    service.fuente.set('websocket');
    f.detectChanges();
    const text = f.nativeElement.textContent;
    expect(text).toContain('37');
    expect(text).toContain('Conectado en tiempo real');
    expect(text).toContain('Titular');
    expect(text).toContain('Tarjeta ****4444 bloqueada');
    // barra con 0 clics no dibuja path
    expect(f.componentInstance.barras().filter((b) => b.path).length).toBe(2);
  });

  it('ofrece vista de tabla accesible para la serie', () => {
    const f = TestBed.createComponent(MetricasDashboardComponent);
    service.snapshot.set(snap);
    f.detectChanges();
    f.componentInstance.showTable.set(true);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('indica cuando opera en modo polling', () => {
    const f = TestBed.createComponent(MetricasDashboardComponent);
    service.snapshot.set(snap);
    service.fuente.set('polling');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Sin tiempo real: actualizando cada 5 s');
  });

  it('muestra la tabla de productos en vivo de la telemetría', () => {
    const f = TestBed.createComponent(MetricasDashboardComponent);
    service.snapshot.set(snap);
    service.productosEnVivo.set([
      {
        sku: 'CAM-9',
        nombre: 'Retro',
        categoria: 'Fútbol',
        precio: 25990,
        vistas: 14,
        agregados: 3,
        actualizadoEn: '2026-11-13T10:00:00Z',
      },
    ]);
    f.detectChanges();
    const text = f.nativeElement.textContent;
    expect(text).toContain('Productos en vivo');
    expect(text).toContain('Retro');
  });
});
