import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { Registro } from './registro';
import { Autenticar } from '../../services/autenticar';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('Registro', () => {
  let component: Registro;
  let fixture: ComponentFixture<Registro>;
  let autenticarFake: { registro: ReturnType<typeof vi.fn>; login: ReturnType<typeof vi.fn> };
  let dialogRefFake: { close: ReturnType<typeof vi.fn> };
  let dialogOpenSpy: ReturnType<typeof vi.spyOn>;
  let router: Router;

  beforeEach(async () => {
    autenticarFake = { registro: vi.fn(), login: vi.fn() };
    dialogRefFake = { close: vi.fn() };
    // MatDialogModule (importado por el propio componente standalone) vuelve
    // a registrar MatDialog en el injector del componente, por lo que un
    // `{ provide: MatDialog, useValue: ... }` en TestBed queda tapado; se
    // espía el método real en el prototype en su lugar.
    dialogOpenSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({} as any);

    await TestBed.configureTestingModule({
      imports: [Registro],
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

    fixture = TestBed.createComponent(Registro);
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

  it('el formulario es inválido si las contraseñas no coinciden', () => {
    component.formularioRegistro.setValue({ nombre: 'ana', password: '1234', passwordRepetir: 'otra' });
    expect(component.formularioRegistro.hasError('noCoinciden')).toBe(true);
  });

  it('el formulario es inválido si el nombre tiene menos de 3 caracteres', () => {
    component.formularioRegistro.setValue({ nombre: 'an', password: '1234', passwordRepetir: '1234' });
    expect(component.formularioRegistro.invalid).toBe(true);
  });

  it('no llama al servicio si el formulario es inválido', () => {
    component.onSubmit();
    expect(autenticarFake.registro).not.toHaveBeenCalled();
  });

  it('en éxito, registra, hace login automático, cierra el diálogo y navega', () => {
    autenticarFake.registro.mockReturnValue(of({ msj: 'Usuario creado con éxito' }));
    autenticarFake.login.mockReturnValue(of({ user: 'ana', nocerrar: false }));
    component.formularioRegistro.setValue({ nombre: 'ana', password: '1234', passwordRepetir: '1234' });

    component.onSubmit();

    expect(autenticarFake.registro).toHaveBeenCalledWith({ user: 'ana', contrasenya: '1234', nocerrar: false });
    expect(autenticarFake.login).toHaveBeenCalled();
    expect(dialogRefFake.close).toHaveBeenCalledWith({ user: 'ana', nocerrar: false });
    expect(router.navigate).toHaveBeenCalledWith(['/inicio']);
    expect(component.enviando).toBe(false);
  });

  it('si el usuario ya existe, muestra el mensaje de error correspondiente', () => {
    autenticarFake.registro.mockReturnValue(throwError(() => '400 - ya existe'));
    component.formularioRegistro.setValue({ nombre: 'ana', password: '1234', passwordRepetir: '1234' });

    component.onSubmit();

    expect(component.errorMensaje).toBeTruthy();
    expect(component.enviando).toBe(false);
    expect(autenticarFake.login).not.toHaveBeenCalled();
  });

  it('abrirLogin cierra este diálogo y abre el de login', () => {
    component.abrirLogin();

    expect(dialogRefFake.close).toHaveBeenCalled();
    expect(dialogOpenSpy).toHaveBeenCalled();
  });
});
