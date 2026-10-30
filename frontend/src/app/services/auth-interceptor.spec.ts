import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthInterceptor } from './auth-interceptor';
import { Autenticar } from './autenticar';
import { SesionAnonima } from './sesion-anonima';

describe('AuthInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let autenticarFake: { getUsuarioLogueado: () => any };
  let sesionAnonimaFake: { obtenerId: () => string | undefined };

  function configurar(usuario: any, sesionId: string | undefined) {
    autenticarFake = { getUsuarioLogueado: () => usuario };
    sesionAnonimaFake = { obtenerId: () => sesionId };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([AuthInterceptor])),
        provideHttpClientTesting(),
        { provide: Autenticar, useValue: autenticarFake },
        { provide: SesionAnonima, useValue: sesionAnonimaFake },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock?.verify();
  });

  it('should be defined', () => {
    expect(AuthInterceptor).toBeDefined();
  });

  it('añade la cabecera X-Usuario cuando hay un usuario logueado', () => {
    configurar({ user: 'ana' }, undefined);

    http.get('/api/recurso').subscribe();
    const peticion = httpMock.expectOne('/api/recurso');

    expect(peticion.request.headers.get('X-Usuario')).toBe('ana');
    expect(peticion.request.headers.has('X-Session-Id')).toBe(false);
    peticion.flush({});
  });

  it('añade la cabecera X-Session-Id cuando no hay usuario logueado pero sí sesión anónima', () => {
    configurar(undefined, 'sesion-123');

    http.get('/api/recurso').subscribe();
    const peticion = httpMock.expectOne('/api/recurso');

    expect(peticion.request.headers.get('X-Session-Id')).toBe('sesion-123');
    expect(peticion.request.headers.has('X-Usuario')).toBe(false);
    peticion.flush({});
  });

  it('prioriza el usuario logueado sobre la sesión anónima', () => {
    configurar({ user: 'ana' }, 'sesion-123');

    http.get('/api/recurso').subscribe();
    const peticion = httpMock.expectOne('/api/recurso');

    expect(peticion.request.headers.get('X-Usuario')).toBe('ana');
    expect(peticion.request.headers.has('X-Session-Id')).toBe(false);
    peticion.flush({});
  });

  it('no añade ninguna cabecera si no hay usuario ni sesión anónima', () => {
    configurar(undefined, undefined);

    http.get('/api/recurso').subscribe();
    const peticion = httpMock.expectOne('/api/recurso');

    expect(peticion.request.headers.has('X-Usuario')).toBe(false);
    expect(peticion.request.headers.has('X-Session-Id')).toBe(false);
    peticion.flush({});
  });
});
