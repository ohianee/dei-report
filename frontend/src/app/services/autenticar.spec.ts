import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Autenticar } from './autenticar';
import { baseURL } from '../compartido/baseurl';

describe('Autenticar', () => {
  let service: Autenticar;
  let httpMock: HttpTestingController;

  function crearServicio(platformId: 'browser' | 'server' = 'browser') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });
    service = TestBed.inject(Autenticar);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    httpMock.verify();
  });

  it('should be created', () => {
    crearServicio();
    expect(service).toBeTruthy();
  });

  it('no hay usuario logueado por defecto', () => {
    crearServicio();
    expect(service.estaAutenticado()).toBe(false);
    expect(service.getUsuarioLogueado()).toBeUndefined();
  });

  it('carga el usuario ya guardado en sessionStorage al construirse', () => {
    sessionStorage.setItem('usuario', JSON.stringify({ user: 'ana', nocerrar: false }));
    crearServicio();

    expect(service.getUsuarioLogueado()?.user).toBe('ana');
    expect(service.estaAutenticado()).toBe(true);
  });

  it('carga el usuario de localStorage si no hay nada en sessionStorage', () => {
    localStorage.setItem('usuario', JSON.stringify({ user: 'bob', nocerrar: true }));
    crearServicio();

    expect(service.getUsuarioLogueado()?.user).toBe('bob');
  });

  it('login: hace POST a /login y guarda la sesión en sessionStorage cuando nocerrar=false', () => {
    crearServicio();
    const credenciales = { user: 'ana', contrasenya: '1234', nocerrar: false };

    let recibido: any;
    service.login(credenciales).subscribe((u) => (recibido = u));

    const peticion = httpMock.expectOne(`${baseURL}login`);
    expect(peticion.request.method).toBe('POST');
    peticion.flush({ user: 'ana', nocerrar: false });

    expect(recibido).toEqual({ user: 'ana', nocerrar: false });
    expect(service.getUsuarioLogueado()?.user).toBe('ana');
    expect(sessionStorage.getItem('usuario')).toContain('ana');
    expect(localStorage.getItem('usuario')).toBeNull();
  });

  it('login: guarda la sesión en localStorage cuando nocerrar=true', () => {
    crearServicio();
    service.login({ user: 'ana', contrasenya: '1234', nocerrar: true }).subscribe();

    httpMock.expectOne(`${baseURL}login`).flush({ user: 'ana', nocerrar: true });

    expect(localStorage.getItem('usuario')).toContain('ana');
    expect(sessionStorage.getItem('usuario')).toBeNull();
  });

  it('registro: hace POST a /registro', () => {
    crearServicio();
    let respuesta: any;
    service.registro({ user: 'nuevo', contrasenya: '1234' }).subscribe((r) => (respuesta = r));

    const peticion = httpMock.expectOne(`${baseURL}registro`);
    expect(peticion.request.method).toBe('POST');
    peticion.flush({ msj: 'Usuario creado con éxito' });

    expect(respuesta).toEqual({ msj: 'Usuario creado con éxito' });
  });

  it('cerrarSesion limpia el estado y el almacenamiento', () => {
    crearServicio();
    service.login({ user: 'ana', contrasenya: '1234', nocerrar: true }).subscribe();
    httpMock.expectOne(`${baseURL}login`).flush({ user: 'ana', nocerrar: true });

    service.cerrarSesion();

    expect(service.getUsuarioLogueado()).toBeUndefined();
    expect(localStorage.getItem('usuario')).toBeNull();
    expect(sessionStorage.getItem('usuario')).toBeNull();
  });

  it('obtenerPerfil hace GET a /usuario', () => {
    crearServicio();
    let perfil: any;
    service.obtenerPerfil().subscribe((p) => (perfil = p));

    const peticion = httpMock.expectOne(`${baseURL}usuario`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ user: 'ana', n_informes: 3 });

    expect(perfil).toEqual({ user: 'ana', n_informes: 3 });
  });

  it('actualizarPassword hace PUT a /usuario', () => {
    crearServicio();
    service.actualizarPassword({ contrasenya_actual: 'a', contrasenya_nueva: 'b' }).subscribe();

    const peticion = httpMock.expectOne(`${baseURL}usuario`);
    expect(peticion.request.method).toBe('PUT');
    peticion.flush({ msj: 'ok' });
  });

  it('borrarCuenta hace DELETE a /usuario con las credenciales en el body', () => {
    crearServicio();
    const credenciales = { user: 'ana', contrasenya: '1234' };
    service.borrarCuenta(credenciales).subscribe();

    const peticion = httpMock.expectOne(`${baseURL}usuario`);
    expect(peticion.request.method).toBe('DELETE');
    expect(peticion.request.body).toEqual(credenciales);
    peticion.flush({ mensaje: 'ok' });
  });
});
