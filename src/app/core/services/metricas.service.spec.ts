import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MsalService } from '@azure/msal-angular';

// Cliente STOMP simulado: captura la configuración y permite disparar callbacks.
const stomp = vi.hoisted(() => ({ last: null as any }));
vi.mock('@stomp/stompjs', () => {
  class Client {
    connected = false;
    connectHeaders: Record<string, string> = {};
    subscribe = vi.fn();
    activate = vi.fn();
    deactivate = vi.fn(() => Promise.resolve());
    constructor(public config: any) {
      Object.assign(this, config);
      stomp.last = this;
    }
  }
  return { Client, ReconnectionTimeMode: { LINEAR: 0, EXPONENTIAL: 1 } };
});

import { MetricasService } from './metricas.service';
import { CognitoAuthService } from './cognito-auth.service';
import { environment } from '../../../environments/environment';
import { MetricasSnapshot } from '../models/metricas.model';

const url = `${environment.apiGateway}/api/v1/analytics/metricas`;
const snap = (clics: number): MetricasSnapshot => ({
  generadoEn: '2026-11-10T10:00:00Z',
  clicsUltimoMinuto: clics,
  usuariosActivos: 3,
  serieClics: [],
  productosMasVistos: [],
  eventosPorTipo: {},
  alertas: [],
});

describe('MetricasService', () => {
  let service: MetricasService;
  let http: HttpTestingController;
  const acquireTokenSilent = vi.fn(() => Promise.resolve({ accessToken: 'tok-fresco' }));

  const env0 = { wsBase: environment.wsBase, telemetriaWsUrl: environment.telemetriaWsUrl };

  beforeEach(() => {
    vi.useFakeTimers();
    acquireTokenSilent.mockClear();
    // Por defecto: modo local (STOMP). Los tests de telemetría lo sobrescriben.
    environment.wsBase = 'ws://localhost:4200';
    environment.telemetriaWsUrl = '';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MsalService,
          useValue: {
            instance: { getActiveAccount: () => ({ username: 'admin' }), acquireTokenSilent },
          },
        },
        { provide: CognitoAuthService, useValue: { isLoggedIn: () => false } },
      ],
    });
    service = TestBed.inject(MetricasService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stop();
    http.verify();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.assign(environment, env0);
  });

  it('sin WebSocket configurado consulta GET /metricas cada 5 s', () => {
    environment.wsBase = '';
    service.start();
    http.expectOne(url).flush(snap(1));
    expect(service.fuente()).toBe('polling');
    vi.advanceTimersByTime(1);
    http.expectOne(url).flush(snap(2));
    vi.advanceTimersByTime(environment.ws.fallbackPollingMs);
    http.expectOne(url).flush(snap(3));
    expect(service.snapshot()?.clicsUltimoMinuto).toBe(3);
  });

  describe('telemetría API Gateway WebSocket (producción)', () => {
    class FakeWs {
      static all: FakeWs[] = [];
      onopen: (() => void) | null = null;
      onmessage: ((e: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      close = vi.fn();
      constructor(public url: string) {
        FakeWs.all.push(this);
      }
    }
    const last = () => FakeWs.all.at(-1)!;
    const flushPromises = async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    };

    beforeEach(() => {
      FakeWs.all = [];
      vi.stubGlobal('WebSocket', FakeWs);
      environment.telemetriaWsUrl = 'wss://telemetria.example/produccion';
    });

    it('conecta con ?token= (access token) y no usa STOMP', async () => {
      const antes = stomp.last;
      service.start();
      http.expectOne(url).flush(snap(1));
      await flushPromises();
      expect(last().url).toBe('wss://telemetria.example/produccion?token=tok-fresco');
      expect(stomp.last).toBe(antes);
      last().onopen!();
      expect(service.fuente()).toBe('websocket');
    });

    it('solo procesa productos.actualizados y reemplaza por sku', async () => {
      service.start();
      http.expectOne(url).flush(snap(1));
      await flushPromises();
      const p = (sku: string, vistas: number) => ({
        sku,
        nombre: sku,
        categoria: 'c',
        precio: 1,
        vistas,
        agregados: 0,
        actualizadoEn: '2026-11-13T10:00:00Z',
      });
      const send = (m: unknown) => last().onmessage!({ data: JSON.stringify(m) });
      const estado = () => service.productosEnVivo().map((x) => [x.sku, x.vistas]);
      send({ tipo: 'productos.actualizados', productos: [p('A', 1), p('B', 5)] });
      expect(estado()).toEqual([
        ['B', 5],
        ['A', 1],
      ]);

      // Otro tipo de mensaje, JSON inválido o sin `productos`: se ignoran sin tocar el estado.
      send({ tipo: 'otro', productos: [p('A', 999), p('Z', 50)] });
      send({ tipo: 'productos.actualizados' });
      last().onmessage!({ data: 'no-json' });
      expect(estado()).toEqual([
        ['B', 5],
        ['A', 1],
      ]);

      // Estado acumulado: reemplaza por sku (no suma) y conserva el resto.
      send({ tipo: 'productos.actualizados', productos: [p('A', 7)] });
      expect(estado()).toEqual([
        ['A', 7],
        ['B', 5],
      ]);
    });

    it('si se corta: polling y reconexión con token nuevo', async () => {
      service.start();
      http.expectOne(url).flush(snap(1));
      await flushPromises();
      const primero = last();
      primero.onopen!();
      primero.onclose!();
      expect(service.fuente()).toBe('polling');
      vi.advanceTimersByTime(1);
      http.expectOne(url).flush(snap(2));
      vi.advanceTimersByTime(2000);
      await flushPromises();
      expect(FakeWs.all.length).toBe(2);
      expect(acquireTokenSilent).toHaveBeenCalledTimes(2);
      last().onopen!();
      expect(service.fuente()).toBe('websocket');
    });

    it('renueva la conexión antes del límite de 2 h', async () => {
      service.start();
      http.expectOne(url).flush(snap(1));
      await flushPromises();
      const primero = last();
      primero.onopen!();
      vi.advanceTimersByTime(environment.ws.telemetriaRenovarMs);
      await flushPromises();
      expect(primero.close).toHaveBeenCalled();
      expect(FakeWs.all.length).toBe(2);
      expect(environment.ws.telemetriaRenovarMs).toBeLessThan(2 * 60 * 60 * 1000);
    });
  });

  it('carga inicial por GET y conecta STOMP a {WS_BASE}/ws/metricas', () => {
    service.start();
    http.expectOne(url).flush(snap(5));
    expect(service.snapshot()?.clicsUltimoMinuto).toBe(5);
    expect(stomp.last.config.brokerURL).toBe(`${environment.wsBase}/ws/metricas`);
    expect(stomp.last.activate).toHaveBeenCalled();
  });

  it('el token va en el frame CONNECT y se renueva antes de cada conexión', async () => {
    service.start();
    http.expectOne(url).flush(snap(1));
    await stomp.last.config.beforeConnect(stomp.last);
    expect(stomp.last.connectHeaders).toEqual({ Authorization: 'Bearer tok-fresco' });
    await stomp.last.config.beforeConnect(stomp.last);
    expect(acquireTokenSilent).toHaveBeenCalledTimes(2);
    expect(acquireTokenSilent.mock.calls[0]).toEqual([
      expect.objectContaining({ scopes: [`${environment.azure.apiScope}/Catalog.Read`] }),
    ]);
  });

  it('al conectar se suscribe SOLO a /topic/metricas y actualiza con cada mensaje', () => {
    service.start();
    http.expectOne(url).flush(snap(1));
    stomp.last.connected = true;
    stomp.last.config.onConnect();
    expect(service.fuente()).toBe('websocket');
    expect(stomp.last.subscribe).toHaveBeenCalledTimes(1);
    const [topic, handler] = stomp.last.subscribe.mock.calls[0];
    expect(topic).toBe('/topic/metricas');
    handler({ body: JSON.stringify(snap(42)) });
    expect(service.snapshot()?.clicsUltimoMinuto).toBe(42);
  });

  it('si el socket no conecta, cae a polling cada 5 s', () => {
    service.start();
    http.expectOne(url).flush(snap(1));
    vi.advanceTimersByTime(6000);
    expect(service.fuente()).toBe('polling');
    vi.advanceTimersByTime(1);
    http.expectOne(url).flush(snap(2));
    vi.advanceTimersByTime(environment.ws.fallbackPollingMs);
    http.expectOne(url).flush(snap(3));
    expect(service.snapshot()?.clicsUltimoMinuto).toBe(3);
  });

  it('al reconectar el socket se detiene el polling', () => {
    service.start();
    http.expectOne(url).flush(snap(1));
    stomp.last.config.onWebSocketClose();
    vi.advanceTimersByTime(0);
    http.expectOne(url).flush(snap(2));
    stomp.last.connected = true;
    stomp.last.config.onConnect();
    vi.advanceTimersByTime(20000);
    http.expectNone(url);
  });

  it('CONNECT rechazado por permisos -> error forbidden', () => {
    service.start();
    http.expectOne(url).flush(snap(1));
    stomp.last.config.onStompError({
      headers: { message: 'Permisos insuficientes para el dashboard' },
    });
    expect(service.error()?.kind).toBe('forbidden');
    vi.advanceTimersByTime(0);
    http.expectOne(url).flush(snap(1));
  });
});
