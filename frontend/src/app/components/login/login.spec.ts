import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { Login } from './login';
import { Autenticar } from '../../services/autenticar';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let autenticarFake: { login: ReturnType<typeof vi.fn> };
  let dialogRefFake: { close: ReturnType<typeof vi.fn> };
  let dialogOpenSpy: ReturnType<typeof vi.spyOn>;
  let router: Router;

  beforeEach(async () => {
    autenticarFake = { login: vi.fn() };
    dialogRefFake = { close: vi.fn() };
    // MatDialogModule (importado por el propio componente standalone) vuelve
    // a registrar MatDialog en el injector del componente, por lo que un
    // `{ provide: MatDialog, useValue: ... }` en TestBed queda tapado; se
    // espía el método real en el prototype en su lugar.
    dialogOpenSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({} as any);

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: Autenticar, useValue: autenticarFake },
        { provide: MatDialogRef, useValue: dialogRefFake },
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  });

  afterEach(() => {
    dialogOpenSpy.mockRestore();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('no llama al servicio si el formulario está vacío/inválido', () => {
    component.onSubmit();
    expect(autenticarFake.login).not.toHaveBeenCalled();
  });

  it('en éxito, hace login, cierra el diálogo y navega a /inicio', () => {
    autenticarFake.login.mockReturnValue(of({ user: 'ana', nocerrar: false }));
    component.formularioLogin.setValue({ nombre: 'ana', password: '1234', nocerrar: false });

    component.onSubmit();

    expect(autenticarFake.login).toHaveBeenCalledWith({ user: 'ana', contrasenya: '1234', nocerrar: false });
    expect(dialogRefFake.close).toHaveBeenCalledWith({ user: 'ana', nocerrar: false });
    expect(router.navigate).toHaveBeenCalledWith(['/inicio']);
  });

  it('en error, resetea la contraseña y muestra un mensaje de error', () => {
    autenticarFake.login.mockReturnValue(throwError(() => '401 - Unauthorized'));
    component.formularioLogin.setValue({ nombre: 'ana', password: 'malapass', nocerrar: false });

    component.onSubmit();

    expect(component.formularioLogin.value.password).toBeFalsy();
    expect(component.errorMensaje).toBeTruthy();
    expect(dialogRefFake.close).not.toHaveBeenCalled();
  });

  it('abrirRegistro cierra este diálogo y abre el de registro', () => {
    component.abrirRegistro();

    expect(dialogRefFake.close).toHaveBeenCalled();
    expect(dialogOpenSpy).toHaveBeenCalled();
  });
});
