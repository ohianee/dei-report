import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { GraficoTonoCodigo } from './grafico-tono-codigo';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('GraficoTonoCodigo', () => {
  let component: GraficoTonoCodigo;
  let fixture: ComponentFixture<GraficoTonoCodigo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoTonoCodigo],
      providers: [
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GraficoTonoCodigo);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnChanges vuelca los valores de entrada y fija el estilo de barra', () => {
    const datos = { Quality_Positive: 4, Complexity: 2 };
    component.datos = datos;

    component.ngOnChanges({ datos: new SimpleChange(undefined, datos, true) });

    expect(component.barChartDatasets[0].data).toEqual([4, 2]);
    expect(component.barChartDatasets[0].borderRadius).toBe(8);
    expect(component.barChartLabels.length).toBe(2);
  });

  it('claveCategoria genera la clave i18n en mayúsculas', () => {
    expect(component.claveCategoria('Quality_Positive')).toBe('TONO_CODIGO_CATEGORIA.QUALITY_POSITIVE');
  });

  it('onTemaCambiado no lanza error aunque no haya chart adjunto', () => {
    component.datos = { Complexity: 1 };
    component.ngOnChanges({ datos: new SimpleChange(undefined, component.datos, true) });
    expect(() => component.onTemaCambiado()).not.toThrow();
  });
});
