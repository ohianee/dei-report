import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { TablaHallazgosComentarios } from './tabla-hallazgos-comentarios';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('TablaHallazgosComentarios', () => {
  let component: TablaHallazgosComentarios;
  let fixture: ComponentFixture<TablaHallazgosComentarios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablaHallazgosComentarios],
      providers: [
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TablaHallazgosComentarios);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnChanges vuelca los datos de entrada en el dataSource', () => {
    const datos = [{
      repo: 'acme/web', author: 'ana', tipo: 'non_inclusive' as const, termino: 'whitelist',
      categoria: 'racial_historical', severidad: 'high' as const, alternativas: 'allowlist',
      contexto: 'usar whitelist aquí',
    }];
    component.datos = datos;

    component.ngOnChanges({ datos: new SimpleChange(undefined, datos, true) });

    expect(component.dataSource.data).toEqual(datos);
  });

  it('claseSeveridad mapea los 3 niveles', () => {
    expect(component.claseSeveridad('high')).toBe('sev-alta');
    expect(component.claseSeveridad('medium')).toBe('sev-media');
    expect(component.claseSeveridad('low')).toBe('sev-baja');
  });

  it('claveSeveridad y claveTipo generan las claves i18n esperadas', () => {
    expect(component.claveSeveridad('high')).toBe('SEVERIDAD.HIGH');
    expect(component.claveTipo('toxicity')).toBe('TIPO_HALLAZGO.TOXICITY');
  });

  it('esAlternativaTraducible es false solo para non_inclusive', () => {
    expect(component.esAlternativaTraducible('non_inclusive')).toBe(false);
    expect(component.esAlternativaTraducible('negative_tone')).toBe(true);
    expect(component.esAlternativaTraducible('toxicity')).toBe(true);
  });

  it('claveSugerencia genera la clave i18n de la sugerencia', () => {
    expect(component.claveSugerencia('review_toxic_tone')).toBe('SUGERENCIA_HALLAZGO.REVIEW_TOXIC_TONE');
  });
});
