import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { Idioma } from './idioma';
import { TraduccionLoader } from '../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../compartido/idiomas-disponibles';

const CLAVE_IDIOMA = 'dei_idioma';

describe('Idioma', () => {
  let navigatorLanguageSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    localStorage.clear();
    navigatorLanguageSpy?.mockRestore();
  });

  function crearServicio(platformId: 'browser' | 'server') {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platformId },
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    });
    return TestBed.inject(Idioma);
  }

  it('should be created', () => {
    const service = crearServicio('browser');
    expect(service).toBeTruthy();
  });

  it('expone los 5 idiomas soportados', () => {
    const service = crearServicio('browser');
    expect(service.idiomasDisponibles.map(i => i.codigo)).toEqual(['es', 'en', 'fr', 'de', 'pt']);
  });

  it('usa el idioma por defecto cuando no hay nada guardado ni coincide el navegador', () => {
    navigatorLanguageSpy = vi.spyOn(navigator, 'language', 'get').mockReturnValue('zz-ZZ');
    const service = crearServicio('browser');
    expect(service.idiomaActual()).toBe(IDIOMA_POR_DEFECTO);
  });

  it('usa el idioma del navegador cuando no hay nada guardado y sí está soportado', () => {
    navigatorLanguageSpy = vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');
    const service = crearServicio('browser');
    expect(service.idiomaActual()).toBe('fr');
  });

  it('usa el idioma guardado en localStorage si es uno soportado', () => {
    navigatorLanguageSpy = vi.spyOn(navigator, 'language', 'get').mockReturnValue('zz-ZZ');
    localStorage.setItem(CLAVE_IDIOMA, 'en');
    const service = crearServicio('browser');
    expect(service.idiomaActual()).toBe('en');
  });

  it('ignora un idioma guardado no soportado', () => {
    navigatorLanguageSpy = vi.spyOn(navigator, 'language', 'get').mockReturnValue('zz-ZZ');
    localStorage.setItem(CLAVE_IDIOMA, 'zz');
    const service = crearServicio('browser');
    expect(service.idiomaActual()).toBe(IDIOMA_POR_DEFECTO);
  });

  it('en SSR (servidor) siempre usa el idioma por defecto, ignorando localStorage', () => {
    localStorage.setItem(CLAVE_IDIOMA, 'en');
    const service = crearServicio('server');
    expect(service.idiomaActual()).toBe(IDIOMA_POR_DEFECTO);
  });

  it('cambiarIdioma actualiza la señal y guarda en localStorage', () => {
    const service = crearServicio('browser');
    service.cambiarIdioma('fr');

    expect(service.idiomaActual()).toBe('fr');
    expect(localStorage.getItem(CLAVE_IDIOMA)).toBe('fr');
  });

  it('cambiarIdioma ignora un código de idioma no soportado', () => {
    const service = crearServicio('browser');
    service.cambiarIdioma('de');
    service.cambiarIdioma('zz');

    expect(service.idiomaActual()).toBe('de');
  });
});
