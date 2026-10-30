import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { AccesibilidadDei } from './accesibilidad-dei';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

const CLAVE_STORAGE = 'dei_accesibilidad_prefs';

describe('AccesibilidadDei', () => {
  let component: AccesibilidadDei;
  let fixture: ComponentFixture<AccesibilidadDei>;

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  async function crear() {
    await TestBed.configureTestingModule({
      imports: [AccesibilidadDei],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccesibilidadDei);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('should create', async () => {
    await crear();
    expect(component).toBeTruthy();
  });

  it('empieza con las preferencias por defecto', async () => {
    await crear();
    expect(component.fuenteDislexia()).toBe(false);
    expect(component.negrita()).toBe(false);
    expect(component.escalaFuente()).toBe(100);
    expect(component.paleta()).toBe('normal');
    expect(component.tema()).toBe('sistema');
    expect(component.lecturaAutomatica()).toBe(false);
  });

  it('togglePanel alterna la visibilidad del panel', async () => {
    await crear();
    expect(component.panelAbierto()).toBe(false);
    component.togglePanel();
    expect(component.panelAbierto()).toBe(true);
  });

  it('toggleFuenteDislexia activa la señal y aplica la clase CSS', async () => {
    await crear();
    component.toggleFuenteDislexia();
    await fixture.whenStable();

    expect(component.fuenteDislexia()).toBe(true);
    expect(document.documentElement.classList.contains('dei-fuente-dislexia')).toBe(true);
  });

  it('toggleNegrita activa la señal y aplica la clase CSS', async () => {
    await crear();
    component.toggleNegrita();
    await fixture.whenStable();

    expect(component.negrita()).toBe(true);
    expect(document.documentElement.classList.contains('dei-negrita')).toBe(true);
  });

  it('aumentarFuente avanza por la escala sin superar el máximo', async () => {
    await crear();
    for (let i = 0; i < 10; i++) component.aumentarFuente();
    expect(component.escalaFuente()).toBe(160);
  });

  it('disminuirFuente retrocede por la escala sin bajar del mínimo', async () => {
    await crear();
    for (let i = 0; i < 10; i++) component.disminuirFuente();
    expect(component.escalaFuente()).toBe(100);
  });

  it('seleccionarPaleta cambia la paleta y aplica la clase correspondiente', async () => {
    await crear();
    component.seleccionarPaleta('tritan');
    await fixture.whenStable();

    expect(component.paleta()).toBe('tritan');
    expect(document.documentElement.classList.contains('dei-paleta-tritan')).toBe(true);
  });

  it('seleccionarTema actualiza la señal de tema', async () => {
    await crear();
    component.seleccionarTema('oscuro');
    await fixture.whenStable();

    expect(component.tema()).toBe('oscuro');
  });

  it('toggleLecturaAutomatica alterna el estado de lectura por voz', async () => {
    await crear();
    component.toggleLecturaAutomatica();
    await fixture.whenStable();

    expect(component.lecturaAutomatica()).toBe(true);
  });

  it('restablecer vuelve todas las preferencias a los valores por defecto', async () => {
    await crear();
    component.toggleFuenteDislexia();
    component.toggleNegrita();
    component.seleccionarPaleta('alto-contraste');
    component.seleccionarTema('oscuro');
    component.toggleLecturaAutomatica();
    component.aumentarFuente();

    component.restablecer();

    expect(component.fuenteDislexia()).toBe(false);
    expect(component.negrita()).toBe(false);
    expect(component.paleta()).toBe('normal');
    expect(component.escalaFuente()).toBe(100);
    expect(component.tema()).toBe('sistema');
    expect(component.lecturaAutomatica()).toBe(false);
  });

  it('persiste las preferencias en localStorage tras inicializar', async () => {
    await crear();
    component.toggleNegrita();
    component.seleccionarTema('claro');
    await fixture.whenStable();

    const guardado = JSON.parse(localStorage.getItem(CLAVE_STORAGE) || '{}');
    expect(guardado.negrita).toBe(true);
    expect(guardado.tema).toBe('claro');
  });

  it('carga las preferencias ya guardadas en localStorage al iniciar', async () => {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify({
      fuenteDislexia: true, negrita: false, escalaFuente: 125, paleta: 'protan-deutan', tema: 'oscuro', lecturaAutomatica: true
    }));

    await crear();

    expect(component.fuenteDislexia()).toBe(true);
    expect(component.escalaFuente()).toBe(125);
    expect(component.paleta()).toBe('protan-deutan');
    expect(component.tema()).toBe('oscuro');
    expect(component.lecturaAutomatica()).toBe(true);
  });
});