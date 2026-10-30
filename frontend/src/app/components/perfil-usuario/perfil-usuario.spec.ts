import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { PerfilUsuario } from './perfil-usuario';
import { Autenticar } from '../../services/autenticar';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('PerfilUsuario', () => {
  let component: PerfilUsuario;
  let fixture: ComponentFixture<PerfilUsuario>;
  let authFake: {
    obtenerPerfil: ReturnType<typeof vi.fn>;
    actualizarPassword: ReturnType<typeof vi.fn>;
    borrarCuenta: ReturnType<typeof vi.fn>;
    cerrarSesion: ReturnType<typeof vi.fn>;
  };
  let dialogRefFake: { close: ReturnType<typeof vi.fn> };
  let router: Router;

  function crear() {
    fixture = TestBed.createComponent(PerfilUsuario);
    component = fixture.componentInstance;
  }

  beforeEach(async () => {
    authFake = {
      obtenerPerfil: vi.fn().mockReturnValue(of({ user: 'ana', n_informes: 2 })),
      actualizarPassword: vi.fn(),
      borrarCuenta: vi.fn(),
      cerrarSesion: vi.fn(),
    };
    dialogRefFake = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PerfilUsuario],
      providers: [
        provideRouter([]),
        { provide: Autenticar, useValue: authFake },
        { provide: MatDialogRef, useValue: dialogRefFake },
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('should create', () => {
    crear();
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga el perfil del usuario', async () => {
    crear();
    await fixture.whenStable();

    expect(component.perfil).toEqual({ user: 'ana', n_informes: 2 });
  });

  it('si falla la carga del perfil, cierra el diálogo', async () => {
    authFake.obtenerPerfil.mockReturnValue(throwError(() => new Error('401')));
    crear();
    await fixture.whenStable();

    expect(dialogRefFake.close).toHaveBeenCalled();
  });

  it('cambiarPassword no llama al servicio si el formulario es inválido', () => {
    crear();
    component.cambiarPassword();
    expect(authFake.actualizarPassword).not.toHaveBeenCalled();
  });

  it('cambiarPassword en éxito muestra mensaje de éxito y resetea el formulario', () => {
    crear();
    authFake.actualizarPassword.mockReturnValue(of({ msj: 'ok' }));
    component.formPassword.setValue({ passActual: 'vieja1', passNueva: 'nueva1', passRepite: 'nueva1' });

    component.cambiarPassword();

    expect(authFake.actualizarPassword).toHaveBeenCalledWith({
      contrasenya_actual: 'vieja1',
      contrasenya_nueva: 'nueva1',
    });
    expect(component.mensajeExito).toBeTruthy();
    expect(component.mensajeError).toBeNull();
  });

  it('cambiarPassword en error muestra mensaje de error', () => {
    crear();
    authFake.actualizarPassword.mockReturnValue(throwError(() => new Error('401')));
    component.formPassword.setValue({ passActual: 'vieja1', passNueva: 'nueva1', passRepite: 'nueva1' });

    component.cambiarPassword();

    expect(component.mensajeError).toBeTruthy();
  });

  it('el formulario de contraseña es inválido si las nuevas no coinciden', () => {
    crear();
    component.formPassword.setValue({ passActual: 'vieja1', passNueva: 'nueva1', passRepite: 'otra1' });
    expect(component.formPassword.hasError('noCoinciden')).toBe(true);
  });

  it('borrarCuenta no hace nada si el usuario cancela la confirmación', async () => {
    crear();
    await fixture.whenStable();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.formBorrar.setValue({ passwordConfirm: '1234' });

    component.borrarCuenta();

    expect(authFake.borrarCuenta).not.toHaveBeenCalled();
  });

  it('borrarCuenta en éxito cierra sesión, cierra el diálogo y navega', async () => {
    crear();
    await fixture.whenStable();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    authFake.borrarCuenta.mockReturnValue(of({ mensaje: 'ok' }));
    component.formBorrar.setValue({ passwordConfirm: '1234' });

    component.borrarCuenta();

    expect(authFake.borrarCuenta).toHaveBeenCalledWith({ user: 'ana', contrasenya: '1234', nocerrar: false });
    expect(authFake.cerrarSesion).toHaveBeenCalled();
    expect(dialogRefFake.close).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/inicio']);
  });

  it('borrarCuenta en error muestra un mensaje de error', async () => {
    crear();
    await fixture.whenStable();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    authFake.borrarCuenta.mockReturnValue(throwError(() => new Error('401')));
    component.formBorrar.setValue({ passwordConfirm: 'mala' });

    component.borrarCuenta();

    expect(component.errorBorrado).toBeTruthy();
  });
});
