import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { of, throwError } from 'rxjs';
import { provideTranslateService, provideTranslateLoader, TranslateService } from '@ngx-translate/core';
import jsPDF from 'jspdf';
import { DescargarInformeService } from './descargar-informe';
import { Analisis } from '../services/analisis';
import { TraduccionLoader } from './traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../compartido/idiomas-disponibles';

const saveSpy = vi.fn(function (this: any) { return this; });
(jsPDF as any).API.save = saveSpy;

const INFORME_MINIMO: any = {
  job_id: 'job-1',
  metricasGlobales: { entropia_shannon: 1, indice_simpson: 0.5, ratio_unicos: 0.2 },
  bigFive: {},
  tonoCodigo: {},
  diversidadAutores: [],
  diversidadRepos: [],
  lenguajeInclusivoCodigo: {
    scoreGlobal: 90, identificadoresAnalizados: 10, hallazgosPorCategoria: {},
    terminosMasFrecuentes: {}, resumenRepos: [], resumenArchivos: [], hallazgos: [],
  },
  hallazgosComentarios: [],
  climaComunicacion: {
    comentariosAnalizados: 0, porcentajePositivos: 0, porcentajeNegativos: 0,
    porcentajeNeutros: 0, comentariosToxicos: 0, porcentajeToxicos: 0,
  },
};

describe('DescargarInformeService', () => {
  let analisisFake: { getInforme: ReturnType<typeof vi.fn> };

  function crearServicio(platformId: 'browser' | 'server') {
    analisisFake = { getInforme: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platformId },
        { provide: Analisis, useValue: analisisFake },
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    });
    return TestBed.inject(DescargarInformeService);
  }

  beforeEach(() => {
    saveSpy.mockClear();
  });

  it('should be created', () => {
    const service = crearServicio('browser');
    expect(service).toBeTruthy();
  });

  it('en SSR (servidor) no consulta el informe ni genera el PDF', async () => {
    const service = crearServicio('server');
    await service.generarYDescargar('job-1');

    expect(analisisFake.getInforme).not.toHaveBeenCalled();
  });

  it('en navegador pide el informe y guarda el PDF con el nombre esperado', async () => {
    const service = crearServicio('browser');
    analisisFake.getInforme.mockReturnValue(of(INFORME_MINIMO));

    await service.generarYDescargar('job-12345678');

    expect(analisisFake.getInforme).toHaveBeenCalledWith('job-12345678');
    expect(saveSpy).toHaveBeenCalledWith('DEI-Report-job-1234.pdf');
  });

  it('si falla la descarga del informe, muestra una alerta y no llama a doc.save', async () => {
    const service = crearServicio('browser');
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    analisisFake.getInforme.mockReturnValue(throwError(() => new Error('fallo de red')));

    await service.generarYDescargar('job-1');

    expect(alertSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
