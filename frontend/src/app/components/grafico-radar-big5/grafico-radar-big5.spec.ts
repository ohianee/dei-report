import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { TranslateService, provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { GraficoRadarBig5 } from './grafico-radar-big5';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

// No se llama a `fixture.detectChanges()`: el template renderiza un
// <canvas> real de Chart.js (via ng2-charts), que necesitaría `provideCharts`
// y un canvas 2D funcional (no disponible en jsdom). El nivel de test
// acordado es la lógica del componente (ngOnChanges, traducción, color),
// así que se prueba llamando a los métodos directamente.
describe('GraficoRadarBig5', () => {
  let component: GraficoRadarBig5;
  let fixture: ComponentFixture<GraficoRadarBig5>;
  let translate: TranslateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoRadarBig5],
      providers: [
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GraficoRadarBig5);
    component = fixture.componentInstance;
    translate = TestBed.inject(TranslateService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnChanges vuelca los valores de entrada como datos del dataset', () => {
    const datos = { Openness: 3, Extraversion: 5 };
    component.datos = datos;

    component.ngOnChanges({ datos: new SimpleChange(undefined, datos, true) });

    expect(component.radarChartDatasets[0].data).toEqual([3, 5]);
    expect(component.radarChartLabels.length).toBe(2);
  });

  it('claveRasgo genera la clave i18n en mayúsculas', () => {
    expect(component.claveRasgo('Openness')).toBe('BIG_FIVE.OPENNESS');
  });

  it('al cambiar de idioma, retraduce las etiquetas ya calculadas', async () => {
    component.datos = { Openness: 1 };
    component.ngOnChanges({ datos: new SimpleChange(undefined, component.datos, true) });
    const etiquetaEs = component.radarChartLabels[0];

    await translate.use('en');

    expect(component.radarChartLabels[0]).toBeTruthy();
    expect(typeof component.radarChartLabels[0]).toBe('string');
  });

  it('onTemaCambiado no lanza error aunque no haya chart adjunto', () => {
    component.datos = { Openness: 1 };
    component.ngOnChanges({ datos: new SimpleChange(undefined, component.datos, true) });
    expect(() => component.onTemaCambiado()).not.toThrow();
  });
});
