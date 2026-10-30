import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { InformeDei } from './informe-dei';
import { Analisis } from '../../services/analisis';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

// Este componente anida gráficos/tablas (Chart.js, etc.) que necesitarían
// `provideCharts` y un canvas real para renderizar; como el nivel de test
// acordado es de lógica de componente (no de renderizado profundo), se crea
// el componente sin `fixture.detectChanges()` y se invoca `ngOnInit()`
// directamente, evitando así compilar/renderizar el árbol de hijos.
describe('InformeDei', () => {
  let analisisFake: { getInforme: ReturnType<typeof vi.fn> };

  function crear(jobId: string | null) {
    TestBed.configureTestingModule({
      imports: [InformeDei],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
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
    const fixture = TestBed.createComponent(InformeDei);
    return fixture.componentInstance;
  }

  beforeEach(() => {
    analisisFake = { getInforme: vi.fn() };
  });

  it('should create', () => {
    const component = crear('job-1');
    expect(component).toBeTruthy();
  });

  it('sin job_id en la ruta, muestra error y no consulta el informe', () => {
    const component = crear(null);
    component.ngOnInit();

    expect(component.errorMsj()).toBeTruthy();
    expect(component.cargando()).toBe(false);
    expect(analisisFake.getInforme).not.toHaveBeenCalled();
  });

  it('con job_id, carga el informe y actualiza cargando/informe', () => {
    const informe = { job_id: 'job-1' } as any;
    analisisFake.getInforme.mockReturnValue(of(informe));
    const component = crear('job-1');

    component.ngOnInit();

    expect(component.jobId()).toBe('job-1');
    expect(analisisFake.getInforme).toHaveBeenCalledWith('job-1');
    expect(component.informe()).toBe(informe);
    expect(component.cargando()).toBe(false);
  });

  it('si falla la carga del informe, muestra el mensaje de error', () => {
    analisisFake.getInforme.mockReturnValue(throwError(() => ({ message: 'no encontrado' })));
    const component = crear('job-1');

    component.ngOnInit();

    expect(component.errorMsj()).toBe('no encontrado');
    expect(component.cargando()).toBe(false);
    expect(component.informe()).toBeNull();
  });
});
