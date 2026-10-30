import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { SesionAnonima } from './sesion-anonima';

const CLAVE_STORAGE = 'sesion_anonima_id';

describe('SesionAnonima', () => {
  afterEach(() => {
    localStorage.clear();
  });

  function crearServicio(platformId: 'browser' | 'server') {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platformId }],
    });
    return TestBed.inject(SesionAnonima);
  }

  it('should be created', () => {
    const service = crearServicio('browser');
    expect(service).toBeTruthy();
  });

  it('devuelve undefined en plataforma servidor (SSR)', () => {
    const service = crearServicio('server');
    expect(service.obtenerId()).toBeUndefined();
  });

  it('genera un id y lo persiste en localStorage en el navegador', () => {
    const service = crearServicio('browser');
    const id = service.obtenerId();

    expect(id).toBeTruthy();
    expect(localStorage.getItem(CLAVE_STORAGE)).toBe(id);
  });

  it('devuelve siempre el mismo id en llamadas sucesivas', () => {
    const service = crearServicio('browser');
    const primero = service.obtenerId();
    const segundo = service.obtenerId();

    expect(segundo).toBe(primero);
  });

  it('reutiliza el id ya guardado en localStorage en vez de crear uno nuevo', () => {
    localStorage.setItem(CLAVE_STORAGE, 'id-ya-existente');
    const service = crearServicio('browser');

    expect(service.obtenerId()).toBe('id-ya-existente');
  });
});
