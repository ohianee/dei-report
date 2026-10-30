import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { Cabecera } from './cabecera';
import { Autenticar } from '../../services/autenticar';
import { Idioma } from '../../services/idioma';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO, IDIOMAS_DISPONIBLES } from '../../compartido/idiomas-disponibles';

describe('Cabecera', () => {
  let component: Cabecera;
  let fixture: ComponentFixture<Cabecera>;
  let authFake: { usuarioLogueado: ReturnType<typeof signal>; cerrarSesion: ReturnType<typeof vi.fn> };
  let idiomaFake: { cambiarIdioma: ReturnType<typeof vi.fn>; idiomasDisponibles: any; idiomaActual: ReturnType<typeof signal> };
  let dialogFake: { open: ReturnType<typeof vi.fn>; openDialogs: any[] };
  let router: Router;

  beforeEach(async () => {
    authFake = { usuarioLogueado: signal(undefined), cerrarSesion: vi.fn() };
    idiomaFake = {
      cambiarIdioma: vi.fn(),
      idiomasDisponibles: IDIOMAS_DISPONIBLES,
      idiomaActual: signal(IDIOMA_POR_DEFECTO),
    };
    dialogFake = { open: vi.fn(), openDialogs: [] };

    await TestBed.configureTestingModule({
      imports: [Cabecera],
      providers: [
        provideRouter([]),
        { provide: 'baseURL', useValue: 'http://localhost:8000/' },
        { provide: Autenticar, useValue: authFake },
        { provide: Idioma, useValue: idiomaFake },
        { provide: MatDialog, useValue: dialogFake },
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Cabecera);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('usuario refleja el usuario logueado del servicio de autenticación', () => {
    expect(component.usuario).toBeUndefined();
    authFake.usuarioLogueado.set({ user: 'ana', contrasenya: '' });
    expect(component.usuario?.user).toBe('ana');
  });

  it('abrirFormularioLogin abre el diálogo de login', () => {
    component.abrirFormularioLogin();
    expect(dialogFake.open).toHaveBeenCalled();
  });

  it('abrirFormularioLogin no abre un segundo diálogo si ya hay uno abierto', () => {
    dialogFake.openDialogs = [{}];
    component.abrirFormularioLogin();
    expect(dialogFake.open).not.toHaveBeenCalled();
  });

  it('abrirGuiaAyuda abre el diálogo de guía', () => {
    component.abrirGuiaAyuda();
    expect(dialogFake.open).toHaveBeenCalled();
  });

  it('abrirPerfil abre el diálogo de perfil', () => {
    component.abrirPerfil();
    expect(dialogFake.open).toHaveBeenCalled();
  });

  it('cambiarIdioma delega en el servicio de idioma', () => {
    component.cambiarIdioma('fr');
    expect(idiomaFake.cambiarIdioma).toHaveBeenCalledWith('fr');
  });

  it('logout cierra sesión y navega a /inicio', () => {
    component.logout();
    expect(authFake.cerrarSesion).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/inicio']);
  });

  it('toggleMenu alterna el estado y cerrarMenu lo cierra', () => {
    expect(component.menuAbierto).toBe(false);
    component.toggleMenu();
    expect(component.menuAbierto).toBe(true);
    component.cerrarMenu();
    expect(component.menuAbierto).toBe(false);
  });
});
