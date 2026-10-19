import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { NotificationCenterComponent } from './notification-center.component';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../auth/services/auth.service';

describe('NotificationCenterComponent', () => {
  let authServiceMock: any;
  let notificationServiceMock: any;

  beforeEach(() => {
    authServiceMock = {
      isLoggedIn: signal(true),
      isAdmin: signal(false),
      userEmail: signal('comprador@camisetas360.com'),
      activeUser: signal('Comprador Demo'),
      userInitials: signal('CD'),
    };

    notificationServiceMock = {
      sending: signal(false),
      lastError: signal(null),
      lastSuccess: signal(null),
      sendEmail: () => of({ status: 'SENT', to: 'test@example.com' }),
      clearState: () => {},
    };

    TestBed.configureTestingModule({
      imports: [NotificationCenterComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock },
      ],
    });
  });

  it('debe crearse correctamente', () => {
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('debe mostrar la información del canal de notificaciones y el correo del usuario', () => {
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Centro de Notificaciones');
    expect(text).toContain('Canal de Notificaciones Operativo');
    expect(text).toContain('comprador@camisetas360.com');
    expect(text).toContain('order.created');
  });

  it('debe emitir el evento close al hacer clic en el botón cerrar', () => {
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    fixture.detectChanges();

    let closed = false;
    fixture.componentInstance.close.subscribe(() => {
      closed = true;
    });

    const closeBtn = fixture.nativeElement.querySelector('button[aria-label="Cerrar panel"]');
    closeBtn.click();

    expect(closed).toBe(true);
  });

  it('debe mostrar la pestaña de despacho administrativo si el usuario es ADMIN', () => {
    authServiceMock.isAdmin.set(true);
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Despachar Correo');
    expect(text).toContain('ADMIN');
  });
});

