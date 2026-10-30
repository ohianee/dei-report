import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Analisis } from './analisis';
import { baseURL, chatURL } from '../compartido/baseurl';

describe('Analisis', () => {
  let service: Analisis;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Analisis);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('lanzarAnalisis hace POST a /analizar con la config', () => {
    const config = { modo: 'lista' as const, repos: [{ owner: 'acme', repo: 'web' }] };
    let respuesta: any;
    service.lanzarAnalisis(config).subscribe((r) => (respuesta = r));

    const peticion = httpMock.expectOne(`${baseURL}analizar`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(config);
    peticion.flush({ job_id: 'job-1' });

    expect(respuesta).toEqual({ job_id: 'job-1' });
  });

  it('lanzarAnalisis convierte un 409 en un AnalisisEnCursoError tipado', () => {
    let errorRecibido: any;
    service.lanzarAnalisis({ modo: 'organizacion', org: 'acme' }).subscribe({
      error: (e) => (errorRecibido = e),
    });

    httpMock.expectOne(`${baseURL}analizar`).flush(
      { detail: { job_id: 'job-existente', mensaje: 'Ya en curso' } },
      { status: 409, statusText: 'Conflict' }
    );

    expect(errorRecibido).toEqual({
      tipo: 'analisis_en_curso',
      jobIdExistente: 'job-existente',
      mensaje: 'Ya en curso',
    });
  });

  it('lanzarAnalisis con otros errores delega en ProcesaHTTPMsjService', () => {
    let errorRecibido: any;
    service.lanzarAnalisis({ modo: 'organizacion', org: 'acme' }).subscribe({
      error: (e) => (errorRecibido = e),
    });

    httpMock.expectOne(`${baseURL}analizar`).flush(
      'algo fue mal', { status: 400, statusText: 'Bad Request' }
    );

    expect(typeof errorRecibido).toBe('string');
    expect(errorRecibido).toContain('400');
  });

  it('getEstado hace GET a /analizar/{jobId}/estado', () => {
    service.getEstado('job-1').subscribe();
    const peticion = httpMock.expectOne(`${baseURL}analizar/job-1/estado`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ job_id: 'job-1', estado: 'procesando', progreso: 10, mensaje: 'x' });
  });

  it('getInforme hace GET a /informe/{jobId}', () => {
    service.getInforme('job-1').subscribe();
    const peticion = httpMock.expectOne(`${baseURL}informe/job-1`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({});
  });

  it('getHistorico hace GET a /historico', () => {
    let resultado: any;
    service.getHistorico().subscribe((r) => (resultado = r));
    httpMock.expectOne(`${baseURL}historico`).flush([{ job_id: 'j1' }]);
    expect(resultado).toEqual([{ job_id: 'j1' }]);
  });

  it('borrarInforme hace DELETE a /historico/{jobId}', () => {
    service.borrarInforme('job-1').subscribe();
    const peticion = httpMock.expectOne(`${baseURL}historico/job-1`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush({});
  });

  it('enviarMensajeChatStream hace POST a /chat/{jobId} usando fetch y procesa el stream', async () => {
    const request = { mensaje: 'hola', historial: [] };
    const mockResponse = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hola '));
        controller.enqueue(new TextEncoder().encode('humano'));
        controller.close();
      }
    }));
    
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(mockResponse);
    const fragmentosRecibidos: string[] = [];
    
    await new Promise<void>((resolve) => {
      service.enviarMensajeChatStream('job-1', request).subscribe({
        next: (fragmento) => fragmentosRecibidos.push(fragmento),
        complete: () => resolve()
      });
    });

    expect(fetchSpy).toHaveBeenCalled();
    const fetchCallUrl = fetchSpy.mock.calls[0][0] as string;
    const fetchCallOptions = fetchSpy.mock.calls[0][1];
    expect(fetchCallUrl).toContain('chat/job-1');
    expect(fetchCallOptions?.method).toBe('POST');
    expect(fetchCallOptions?.body).toEqual(JSON.stringify(request));
    expect(fragmentosRecibidos).toEqual(['hola ', 'humano']);
    fetchSpy.mockRestore();
  });
});
