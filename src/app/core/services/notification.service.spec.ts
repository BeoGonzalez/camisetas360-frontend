import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';
import { SendEmailRequest } from '../models/notification.model';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpTesting: HttpTestingController;

  const url = `${environment.apiGateway}${environment.endpoints.notifications}/email`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(NotificationService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debe enviar un correo administrativo exitosamente (POST 200)', () => {
    const request: SendEmailRequest = {
      to: 'cliente@ejemplo.com',
      subject: 'Confirmación de Pedido',
      body: 'Tu orden ha sido procesada con éxito.',
    };

    const mockResponse = {
      status: 'SENT',
      to: 'cliente@ejemplo.com',
    };

    service.sendEmail(request).subscribe((res) => {
      expect(res).toEqual(mockResponse);
      expect(service.lastSuccess()).toEqual(mockResponse);
      expect(service.sending()).toBe(false);
      expect(service.lastError()).toBeNull();
    });

    expect(service.sending()).toBe(true);

    const req = httpTesting.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(mockResponse);
  });

  it('debe manejar error 403 Forbidden cuando el usuario carece de ROLE_ADMIN o SCOPE_Notifications.Send', () => {
    const request: SendEmailRequest = {
      to: 'cliente@ejemplo.com',
      subject: 'Prueba',
      body: 'Contenido',
    };

    service.sendEmail(request).subscribe({
      next: () => {
        expect('No debió tener éxito').toBe('Fallo esperado con 403');
      },
      error: (err) => {
        expect(err.message).toContain('Acceso denegado');
        expect(service.lastError()).toContain('Acceso denegado');
        expect(service.sending()).toBe(false);
      },
    });

    const req = httpTesting.expectOne(url);
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });
  });

  it('debe manejar error 400 Bad Request cuando la carga útil es inválida', () => {
    const request: SendEmailRequest = {
      to: '',
      subject: '',
      body: '',
    };

    service.sendEmail(request).subscribe({
      next: () => {
        expect('No debió tener éxito').toBe('Fallo esperado con 400');
      },
      error: (err) => {
        expect(err.message).toContain('Datos de solicitud inválidos');
        expect(service.lastError()).toContain('Datos de solicitud inválidos');
      },
    });

    const req = httpTesting.expectOne(url);
    req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });
  });

  it('debe proveer la información del canal de notificaciones automáticas vía RabbitMQ', () => {
    const info = service.getDeliveryChannelInfo('usuario@camisetas360.com');
    expect(info.recipient).toBe('usuario@camisetas360.com');
    expect(info.channel).toBe('EMAIL');
    expect(info.isAutomated).toBe(true);
    expect(info.description).toContain('RabbitMQ');
  });
});
