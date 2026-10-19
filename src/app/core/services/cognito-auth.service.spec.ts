import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CognitoAuthService, CognitoAuthResponse } from './cognito-auth.service';
import { environment } from '../../../environments/environment';

describe('CognitoAuthService', () => {
  let service: CognitoAuthService;
  let httpMock: HttpTestingController;

  const mockResponse: CognitoAuthResponse = {
    message: 'Autenticación exitosa con AWS Cognito',
    accessToken: 'mock-access-token',
    idToken: 'mock-id-token',
    refreshToken: 'mock-refresh-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: {
      username: 'usuario@camisetas360.com',
      email: 'usuario@camisetas360.com',
      name: 'Usuario Demo',
      sub: 'mock-sub-123',
      roles: ['CUSTOMER'],
    },
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CognitoAuthService],
    });
    service = TestBed.inject(CognitoAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.isLoggedIn()).toBe(false);
  });

  it('should login user and store session in state and localStorage', () => {
    service.login('usuario@camisetas360.com', 'Password123!').subscribe((res) => {
      expect(res).toEqual(mockResponse);
      expect(service.isLoggedIn()).toBe(true);
      expect(service.currentUser()?.email).toBe('usuario@camisetas360.com');
      expect(service.userInitials()).toBe('UD');
      expect(service.userRoles()).toContain('CUSTOMER');
      expect(service.isAdmin()).toBe(false);
    });

    const req = httpMock.expectOne(`${environment.apiGateway}${environment.endpoints.cognitoLogin}`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should register user and establish session', () => {
    service.register('nuevo@camisetas360.com', 'Password123!', 'Nuevo Usuario').subscribe((res) => {
      expect(service.isLoggedIn()).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiGateway}${environment.endpoints.cognitoRegister}`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should clear session on logout', () => {
    service.login('usuario@camisetas360.com', 'Password123!').subscribe();
    const req = httpMock.expectOne(`${environment.apiGateway}${environment.endpoints.cognitoLogin}`);
    req.flush(mockResponse);

    expect(service.isLoggedIn()).toBe(true);
    service.logout();
    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });
});

