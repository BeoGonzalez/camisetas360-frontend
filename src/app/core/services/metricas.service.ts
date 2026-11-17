import { Injectable, NgZone, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';
import { Client, IMessage, ReconnectionTimeMode } from '@stomp/stompjs';
import { Observable, Subscription, catchError, switchMap, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FuenteMetricas,
  MensajeTelemetria,
  MetricasSnapshot,
  ProductoTelemetria,
} from '../models/metricas.model';
import { ApiError, toApiError } from '../http/api-error';
import { CognitoAuthService } from './cognito-auth.service';

/** Si el socket no conecta en este tiempo, se activa el polling de respaldo. */
const WS_CONNECT_TIMEOUT_MS = 6000;
/** Backoff de reconexión de la telemetría. */
const TELEMETRIA_RECONEXION_MIN_MS = 2000;
const TELEMETRIA_RECONEXION_MAX_MS = 30000;

/**
 * Dashboard de métricas (ADMIN o CATALOG_MANAGER + Catalog.Read).
 *
 * - Carga inicial: GET {API_BASE}/api/v1/analytics/metricas.
 * - Local (environment.wsBase): STOMP sobre {WS_BASE}/ws/metricas, SUBSCRIBE /topic/metricas
 *   (snapshot cada 2 s). Handshake público: el token va en el frame CONNECT. Token nuevo antes de
 *   cada (re)conexión; reconexión con backoff exponencial.
 * - Producción (environment.telemetriaWsUrl): API Gateway WebSocket con `?token=`; solo procesa
 *   `productos.actualizados` y reemplaza cada producto por sku. La conexión dura máx. 2 h: se
 *   renueva antes con un token nuevo y se reconecta con backoff si se corta.
 * - Sin socket configurado (o mientras no conecta): polling a GET /metricas cada 5 s.
 */
@Injectable({ providedIn: 'root' })
export class MetricasService {
  private readonly http = inject(HttpClient);
  private readonly msal = inject(MsalService);
  private readonly cognito = inject(CognitoAuthService);
  private readonly zone = inject(NgZone);
  private readonly apiUrl = `${environment.apiGateway}${environment.endpoints.analytics}`;

  readonly snapshot = signal<MetricasSnapshot | null>(null);
  readonly fuente = signal<FuenteMetricas>('sin-datos');
  readonly error = signal<ApiError | null>(null);
  /** Productos de la telemetría (estado acumulado, ordenado por vistas). */
  readonly productosEnVivo = signal<ProductoTelemetria[]>([]);

  private active = false;
  private client: Client | null = null;
  private telemetria: WebSocket | null = null;
  private telemetriaIntentos = 0;
  private telemetriaTimer: ReturnType<typeof setTimeout> | null = null;
  private polling: Subscription | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  /** GET /analytics/metricas */
  getSnapshot(): Observable<MetricasSnapshot> {
    return this.http
      .get<MetricasSnapshot>(`${this.apiUrl}/metricas`)
      .pipe(catchError((e) => throwError(() => toApiError(e))));
  }

  start(): void {
    this.stop();
    this.active = true;
    this.fuente.set('conectando');
    this.error.set(null);
    this.getSnapshot().subscribe({
      next: (s) => this.snapshot.set(s),
      error: (e: ApiError) => this.error.set(e),
    });
    if (environment.telemetriaWsUrl) {
      void this.connectTelemetria();
    } else if (environment.wsBase) {
      this.connectSocket();
    } else {
      this.startPolling();
      return;
    }
    this.connectTimer = setTimeout(() => {
      if (this.fuente() !== 'websocket') this.startPolling();
    }, WS_CONNECT_TIMEOUT_MS);
  }

  stop(): void {
    this.active = false;
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = null;
    this.stopPolling();
    void this.client?.deactivate();
    this.client = null;
    this.closeTelemetria();
    this.fuente.set('sin-datos');
  }

  // ---------- Telemetría (API Gateway WebSocket) ----------

  private async connectTelemetria(): Promise<void> {
    const token = await this.freshToken();
    if (!this.active) return;
    if (!token) {
      this.zone.run(() => this.startPolling());
      return;
    }
    const ws = new WebSocket(`${environment.telemetriaWsUrl}?token=${encodeURIComponent(token)}`);
    this.telemetria = ws;
    ws.onopen = () =>
      this.zone.run(() => {
        if (this.telemetria !== ws) return;
        this.telemetriaIntentos = 0;
        this.fuente.set('websocket');
        this.stopPolling();
        // Límite de 2 h de API Gateway: se reconecta antes con un token nuevo.
        this.programarTelemetria(environment.ws.telemetriaRenovarMs);
      });
    ws.onmessage = (ev: MessageEvent) => this.zone.run(() => this.onTelemetria(ev.data));
    ws.onclose = () =>
      this.zone.run(() => {
        if (this.telemetria !== ws || !this.active) return;
        this.telemetria = null;
        this.startPolling();
        const espera = Math.min(
          TELEMETRIA_RECONEXION_MAX_MS,
          TELEMETRIA_RECONEXION_MIN_MS * 2 ** this.telemetriaIntentos++,
        );
        this.programarTelemetria(espera);
      });
  }

  /** Cierra el socket actual (si lo hay) y abre uno nuevo, con token renovado, tras `ms`. */
  private programarTelemetria(ms: number): void {
    if (this.telemetriaTimer) clearTimeout(this.telemetriaTimer);
    this.telemetriaTimer = setTimeout(() => {
      this.telemetriaTimer = null;
      if (!this.active) return;
      const anterior = this.telemetria;
      this.telemetria = null;
      anterior?.close();
      void this.connectTelemetria();
    }, ms);
  }

  private closeTelemetria(): void {
    if (this.telemetriaTimer) clearTimeout(this.telemetriaTimer);
    this.telemetriaTimer = null;
    const ws = this.telemetria;
    this.telemetria = null;
    ws?.close();
    this.telemetriaIntentos = 0;
  }

  private onTelemetria(raw: unknown): void {
    let msg: Partial<MensajeTelemetria>;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg?.tipo !== 'productos.actualizados' || !Array.isArray(msg.productos)) return;
    const porSku = new Map(this.productosEnVivo().map((p) => [p.sku, p]));
    for (const p of msg.productos) {
      if (p && typeof p.sku === 'string') porSku.set(p.sku, p);
    }
    this.productosEnVivo.set([...porSku.values()].sort((a, b) => b.vistas - a.vistas));
  }

  // ---------- STOMP (local) ----------

  private connectSocket(): void {
    const client = new Client({
      brokerURL: `${environment.wsBase}${environment.ws.metricasPath}`,
      reconnectDelay: 2000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      maxReconnectDelay: 30000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      // Renueva el token antes de cada intento (incluidas las reconexiones).
      beforeConnect: async (c) => {
        const token = await this.freshToken();
        c.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      },
      onConnect: () =>
        this.zone.run(() => {
          this.fuente.set('websocket');
          this.error.set(null);
          this.stopPolling();
          client.subscribe(environment.ws.metricasTopic, (msg) => this.onMessage(msg));
        }),
      onStompError: (frame) =>
        this.zone.run(() => {
          // El backend rechaza CONNECT sin rol/scope: no es un error transitorio.
          const msg = frame.headers['message'] ?? '';
          if (/permisos|token/i.test(msg)) {
            this.error.set({
              kind: 'forbidden',
              status: 403,
              message: 'Tu sesión no tiene permiso para el dashboard en tiempo real.',
              retryable: false,
            });
          }
          this.startPolling();
        }),
      onWebSocketClose: () => this.zone.run(() => this.startPolling()),
    });
    this.client = client;
    client.activate();
  }

  private onMessage(msg: IMessage): void {
    try {
      const s = JSON.parse(msg.body) as MetricasSnapshot;
      this.zone.run(() => this.snapshot.set(s));
    } catch {
      // snapshot malformado: se ignora y se espera el siguiente
    }
  }

  private startPolling(): void {
    if (this.polling || !this.active) return;
    if (!this.client?.connected) this.fuente.set('polling');
    this.polling = timer(0, environment.ws.fallbackPollingMs)
      .pipe(
        switchMap(() =>
          this.getSnapshot().pipe(
            catchError((e: ApiError) => {
              this.error.set(e);
              return [];
            }),
          ),
        ),
      )
      .subscribe((s) => {
        this.snapshot.set(s);
        if (this.error()?.kind !== 'forbidden') this.error.set(null);
      });
  }

  private stopPolling(): void {
    this.polling?.unsubscribe();
    this.polling = null;
  }

  private async freshToken(): Promise<string | null> {
    if (this.cognito.isLoggedIn()) return this.cognito.accessToken();
    const account = this.msal.instance.getActiveAccount();
    if (!account) return null;
    try {
      const r = await this.msal.instance.acquireTokenSilent({
        scopes: [`${environment.azure.apiScope}/Catalog.Read`],
        account,
      });
      return r.accessToken;
    } catch {
      return null;
    }
  }
}
