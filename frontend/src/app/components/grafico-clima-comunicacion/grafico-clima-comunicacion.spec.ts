import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { GraficoClimaComunicacion } from './grafico-clima-comunicacion';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('GraficoClimaComunicacion', () => {
  let component: GraficoClimaComunicacion;
  let fixture: ComponentFixture<GraficoClimaComunicacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoClimaComunicacion],
      providers: [
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GraficoClimaComunicacion);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('el constructor ya rellena las 3 etiquetas traducidas', () => {
    expect(component.doughnutChartLabels.length).toBe(3);
  });

  it('ngOnChanges vuelca los porcentajes en el dataset', () => {
    const datos = {
      comentariosAnalizados: 100, porcentajePositivos: 60, porcentajeNegativos: 25,
      porcentajeNeutros: 15, comentariosToxicos: 2, porcentajeToxicos: 2,
    };
    component.datos = datos;

    component.ngOnChanges({ datos: new SimpleChange(undefined, datos, true) });

    expect(component.doughnutChartDatasets[0].data).toEqual([60, 25, 15]);
  });

  it('aplica 3 colores (positivo/negativo/neutro) al dataset', () => {
    const datos = {
      comentariosAnalizados: 10, porcentajePositivos: 50, porcentajeNegativos: 30,
      porcentajeNeutros: 20, comentariosToxicos: 0, porcentajeToxicos: 0,
    };
    component.datos = datos;

    component.ngOnChanges({ datos: new SimpleChange(undefined, datos, true) });

    expect(component.doughnutChartDatasets[0].backgroundColor.length).toBe(3);
  });

  it('onTemaCambiado no lanza error aunque no haya chart adjunto', () => {
    expect(() => component.onTemaCambiado()).not.toThrow();
  });
});
