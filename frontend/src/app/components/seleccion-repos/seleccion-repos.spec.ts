import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { SeleccionRepos } from './seleccion-repos';
import { Analisis } from '../../services/analisis';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('SeleccionRepos', () => {
  let component: SeleccionRepos;
  let fixture: ComponentFixture<SeleccionRepos>;
  let analisisFake: { lanzarAnalisis: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    analisisFake = { lanzarAnalisis: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SeleccionRepos],
      providers: [
        provideRouter([]),
        { provide: Analisis, useValue: analisisFake },
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SeleccionRepos);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('el modo por defecto es organización y requiere el campo org', () => {
    expect(component.modo).toBe('organizacion');
    expect(component.repoForm.controls.org.hasValidator).toBeDefined();
    component.repoForm.controls.org.setValue('');
    expect(component.repoForm.invalid).toBe(true);
  });

  it('cambiar a modo lista añade automáticamente un repo y quita la validación de org', () => {
    component.repoForm.controls.modo.setValue('lista');
    expect(component.repos.length).toBe(1);
    component.repoForm.controls.org.setValue('');
    expect(component.repoForm.controls.org.valid).toBe(true);
  });

  it('addRepo/removeRepo añaden y quitan filas del FormArray', () => {
    component.repoForm.controls.modo.setValue('lista');
    expect(component.repos.length).toBe(1);

    component.addRepo();
    expect(component.repos.length).toBe(2);

    component.removeRepo(0);
    expect(component.repos.length).toBe(1);
  });

  it('onSubmit no llama al servicio si el formulario es inválido', () => {
    component.repoForm.controls.org.setValue('');
    component.onSubmit();
    expect(analisisFake.lanzarAnalisis).not.toHaveBeenCalled();
  });

  it('onSubmit en modo organización manda la config sin `repos`', () => {
    analisisFake.lanzarAnalisis.mockReturnValue(of({ job_id: 'job-1' }));
    component.repoForm.controls.org.setValue('acme');

    component.onSubmit();

    const configEnviada = analisisFake.lanzarAnalisis.mock.calls[0][0];
    expect(configEnviada.modo).toBe('organizacion');
    expect(configEnviada.org).toBe('acme');
    expect(configEnviada.repos).toBeUndefined();
    expect(router.navigate).toHaveBeenCalledWith(['/estado-analisis', 'job-1']);
  });

  it('onSubmit en modo lista manda la config sin `org`', () => {
    analisisFake.lanzarAnalisis.mockReturnValue(of({ job_id: 'job-2' }));
    component.repoForm.controls.modo.setValue('lista');
    component.repos.at(0).setValue({ owner: 'acme', repo: 'web' });

    component.onSubmit();

    const configEnviada = analisisFake.lanzarAnalisis.mock.calls[0][0];
    expect(configEnviada.modo).toBe('lista');
    expect(configEnviada.org).toBeUndefined();
    expect(configEnviada.repos).toEqual([{ owner: 'acme', repo: 'web' }]);
  });

  it('si ya hay un análisis en curso para el mismo objetivo, redirige a su estado', () => {
    analisisFake.lanzarAnalisis.mockReturnValue(throwError(() => ({
      tipo: 'analisis_en_curso', jobIdExistente: 'job-existente', mensaje: 'ya en curso',
    })));
    component.repoForm.controls.org.setValue('acme');

    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/estado-analisis', 'job-existente']);
    expect(component.cargando).toBe(true);
  });

  it('en un error genérico, muestra el mensaje y deja de cargar', () => {
    analisisFake.lanzarAnalisis.mockReturnValue(throwError(() => 'boom'));
    component.repoForm.controls.org.setValue('acme');

    component.onSubmit();

    expect(component.errorMsj).toBe('boom');
    expect(component.cargando).toBe(false);
  });
});
