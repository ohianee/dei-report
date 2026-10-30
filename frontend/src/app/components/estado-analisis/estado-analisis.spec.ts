import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { EstadoAnalisis } from './estado-analisis';
import { Analisis } from '../../services/analisis';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('EstadoAnalisis', () => {
  let component: EstadoAnalisis;
  let fixture: ComponentFixture<EstadoAnalisis>;
  let analisisFake: { getEstado: ReturnType<typeof vi.fn> };
  let router: Router;

  function crear(jobId: string | null) {
    TestBed.configureTestingModule({
      imports: [EstadoAnalisis],
      providers: [
        provideRouter([]),
        { provide: Analisis, useValue: analisisFake },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(jobId ? { job_id: jobId } : {}) } },
        },
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    });

    fixture = TestBed.createComponent(EstadoAnalisis);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  beforeEach(() => {
    analisisFake = { getEstado: vi.fn() };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    analisisFake.getEstado.mockReturnValue(of({ job_id: 'j1', estado: 'procesando', progreso: 0, mensaje: '' }));
    crear('j1');
    expect(component).toBeTruthy();
  });

  it('sin job_id en la ruta, muestra error y no lanza el polling', () => {
    crear(null);
    fixture.detectChanges();

    expect(component.errorMsj()).toBeTruthy();
    expect(component.isPolling()).toBe(false);
    expect(analisisFake.getEstado).not.toHaveBeenCalled();
  });

  it('actualiza el estado con la respuesta del polling', () => {
    analisisFake.getEstado.mockReturnValue(of({ job_id: 'j1', estado: 'procesando', progreso: 42, mensaje: 'x' }));
    crear('j1');
    fixture.detectChanges();
    vi.advanceTimersByTime(0);

    expect(component.estadoActual()?.progreso).toBe(42);
    expect(analisisFake.getEstado).toHaveBeenCalledWith('j1');
  });

  it('cuando el análisis se completa, navega al informe y detiene el polling', () => {
    analisisFake.getEstado.mockReturnValue(of({ job_id: 'j1', estado: 'completado', progreso: 100, mensaje: 'x' }));
    crear('j1');
    fixture.detectChanges();
    vi.advanceTimersByTime(0);

    expect(router.navigate).toHaveBeenCalledWith(['/informe', 'j1']);
    expect(component.isPolling()).toBe(false);
  });

  it('cuando el análisis falla, muestra el mensaje de error y detiene el polling', () => {
    analisisFake.getEstado.mockReturnValue(of({ job_id: 'j1', estado: 'error', progreso: 0, mensaje: 'ERROR|boom' }));
    crear('j1');
    fixture.detectChanges();
    vi.advanceTimersByTime(0);

    expect(component.errorMsj()).toBeTruthy();
    expect(component.isPolling()).toBe(false);
  });

  it('si la petición de estado falla, muestra un mensaje de error', () => {
    analisisFake.getEstado.mockReturnValue(throwError(() => ({ message: 'sin conexión' })));
    crear('j1');
    fixture.detectChanges();
    vi.advanceTimersByTime(0);

    expect(component.errorMsj()).toBe('sin conexión');
    expect(component.isPolling()).toBe(false);
  });

  it('getMensajeTraducido interpola el total en DOWNLOADING_START', () => {
    analisisFake.getEstado.mockReturnValue(of({ job_id: 'j1', estado: 'procesando', progreso: 0, mensaje: '' }));
    crear('j1');
    fixture.detectChanges();

    const traducido = component.getMensajeTraducido('DOWNLOADING_START|5');
    expect(traducido).toBeTruthy();
  });

  it('getMensajeTraducido devuelve vacío si no hay mensaje del backend', () => {
    analisisFake.getEstado.mockReturnValue(of({ job_id: 'j1', estado: 'procesando', progreso: 0, mensaje: '' }));
    crear('j1');
    fixture.detectChanges();

    expect(component.getMensajeTraducido('')).toBe('');
  });
});
