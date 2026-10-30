import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { TablaLenguajeRepo } from './tabla-lenguaje-repo';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('TablaLenguajeRepo', () => {
  let component: TablaLenguajeRepo;
  let fixture: ComponentFixture<TablaLenguajeRepo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablaLenguajeRepo],
      providers: [
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TablaLenguajeRepo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnChanges vuelca los datos de entrada en el dataSource', () => {
    const datos = [{
      repo: 'acme/web', archivosAnalizados: 10, identificadoresAnalizados: 100,
      hallazgos: 5, densidadPor1000Ids: 50, scoreInclusividad: 85,
      hallazgosPorCategoria: {}, hallazgosPorSeveridad: {},
    }];
    component.datos = datos;

    component.ngOnChanges({ datos: new SimpleChange(undefined, datos, true) });

    expect(component.dataSource.data).toEqual(datos);
  });

  it('claseScore clasifica según el umbral de score', () => {
    expect(component.claseScore(95)).toBe('score-bien');
    expect(component.claseScore(90)).toBe('score-bien');
    expect(component.claseScore(80)).toBe('score-medio');
    expect(component.claseScore(70)).toBe('score-medio');
    expect(component.claseScore(50)).toBe('score-mal');
  });
});
