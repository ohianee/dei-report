import { TestBed } from '@angular/core/testing';
import { ProcesaHTTPMsjService } from './processa-httpmsj';

describe('ProcesaHTTPMsjService', () => {
  let service: ProcesaHTTPMsjService;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProcesaHTTPMsjService);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('usa el mensaje del ErrorEvent cuando el error es de red/cliente', () => {
    const errorEvent = new ErrorEvent('offline', { message: 'La conexión ha fallado' });
    let errorRecibido: any;

    service.gestionError({ error: errorEvent }).subscribe({ error: (e) => (errorRecibido = e) });

    expect(errorRecibido).toBe('La conexión ha fallado');
  });

  it('compone status, statusText y cuerpo cuando el error viene del servidor', () => {
    let errorRecibido: any;

    service.gestionError({ status: 404, statusText: 'Not Found', error: 'No encontrado' })
      .subscribe({ error: (e) => (errorRecibido = e) });

    expect(errorRecibido).toBe('404 - Not Found No encontrado');
  });

  it('funciona sin statusText', () => {
    let errorRecibido: any;

    service.gestionError({ status: 500, error: 'boom' })
      .subscribe({ error: (e) => (errorRecibido = e) });

    expect(errorRecibido).toBe('500 -  boom');
  });

  it('registra el error en consola', () => {
    service.gestionError({ status: 400, statusText: 'Bad Request', error: 'malo' })
      .subscribe({ error: () => {} });

    expect(consoleErrorSpy).toHaveBeenCalledWith('400 - Bad Request malo');
  });
});
