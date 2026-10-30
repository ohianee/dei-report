import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { HistoricoInformes } from './historico-informes';
import { Analisis } from '../../services/analisis';
import { Autenticar } from '../../services/autenticar';
import { DescargarInformeService } from '../../services/descargar-informe';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('HistoricoInformes', () => {
  let component: HistoricoInformes;
  let fixture: ComponentFixture<HistoricoInformes>;
  let analisisFake: { getHistorico: ReturnType<typeof vi.fn>; borrarInforme: ReturnType<typeof vi.fn> };
  let authFake: { getUsuarioLogueado: ReturnType<typeof vi.fn>; estaAutenticado: ReturnType<typeof vi.fn> };
  let descargarFake: { generarYDescargar: ReturnType<typeof vi.fn> };
  let router: Router;

  function crear() {
    fixture = TestBed.createComponent(HistoricoInformes);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  beforeEach(async () => {
    analisisFake = { getHistorico: vi.fn().mockReturnValue(of([])), borrarInforme: vi.fn().mockReturnValue(of({})) };
    authFake = { getUsuarioLogueado: vi.fn().mockReturnValue({ user: 'ana' }), estaAutenticado: vi.fn().mockReturnValue(true) };
    descargarFake = { generarYDescargar: vi.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [HistoricoInformes],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Analisis, useValue: analisisFake },
        { provide: Autenticar, useValue: authFake },
        { provide: DescargarInformeService, useValue: descargarFake },
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    crear();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga el nombre de usuario logueado y el histórico', () => {
    crear();
    fixture.detectChanges();

    expect(component.nombreUsuario()).toBe('ana');
    expect(component.esInvitado()).toBe(false);
    expect(analisisFake.getHistorico).toHaveBeenCalled();
  });

  it('para un invitado, esInvitado es true', () => {
    authFake.getUsuarioLogueado.mockReturnValue(undefined);
    authFake.estaAutenticado.mockReturnValue(false);
    crear();
    fixture.detectChanges();

    expect(component.esInvitado()).toBe(true);
    expect(component.nombreUsuario()).toBe('');
  });

  it('activa el polling automático si hay jobs en curso, y lo detiene cuando terminan', () => {
    vi.useFakeTimers();
    analisisFake.getHistorico
      .mockReturnValueOnce(of([{ job_id: 'j1', estado: 'procesando', fecha: '', objetivo: 'x' }]))
      .mockReturnValueOnce(of([{ job_id: 'j1', estado: 'completado', fecha: '', objetivo: 'x' }]));

    crear();
    fixture.detectChanges();

    expect(component.isPolling()).toBe(true);
    vi.advanceTimersByTime(5000);

    expect(component.dataSource.data[0].estado).toBe('completado');
    expect(component.isPolling()).toBe(false);
  });

  it('no activa el polling si no hay jobs en curso', () => {
    analisisFake.getHistorico.mockReturnValue(of([{ job_id: 'j1', estado: 'completado', fecha: '', objetivo: 'x' }]));
    crear();
    fixture.detectChanges();

    expect(component.isPolling()).toBe(false);
  });

  it('aplicarFiltro normaliza el texto y lo aplica al dataSource', () => {
    crear();
    fixture.detectChanges();
    const evento = { target: { value: '  Acme  ' } } as unknown as Event;

    component.aplicarFiltro(evento);

    expect(component.dataSource.filter).toBe('acme');
  });

  it('borrarInforme no borra si el usuario cancela la confirmación', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    crear();
    fixture.detectChanges();

    component.borrarInforme('j1');

    expect(analisisFake.borrarInforme).not.toHaveBeenCalled();
  });

  it('borrarInforme confirmado llama al servicio y actualiza la tabla', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    analisisFake.getHistorico.mockReturnValue(of([{ job_id: 'j1', estado: 'completado', fecha: '', objetivo: 'x' }]));
    crear();
    fixture.detectChanges();

    component.borrarInforme('j1');

    expect(analisisFake.borrarInforme).toHaveBeenCalledWith('j1');
    expect(component.dataSource.data.find(d => d.job_id === 'j1')).toBeUndefined();
  });

  it('verEstadoTrabajo navega a la pantalla de estado del análisis', () => {
    crear();
    fixture.detectChanges();

    component.verEstadoTrabajo('j1');

    expect(router.navigate).toHaveBeenCalledWith(['/estado-analisis', 'j1']);
  });

  it('descargarInforme delega en DescargarInformeService', async () => {
    crear();
    fixture.detectChanges();

    await component.descargarInforme('j1');

    expect(descargarFake.generarYDescargar).toHaveBeenCalledWith('j1');
  });
});
