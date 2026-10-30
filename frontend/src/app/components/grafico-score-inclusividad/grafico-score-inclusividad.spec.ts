import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { GraficoScoreInclusividad } from './grafico-score-inclusividad';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('GraficoScoreInclusividad', () => {
  let component: GraficoScoreInclusividad;
  let fixture: ComponentFixture<GraficoScoreInclusividad>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoScoreInclusividad],
      providers: [
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GraficoScoreInclusividad);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnChanges ordena los repos de menor a mayor score', () => {
    const datos = [
      { repo: 'b', scoreInclusividad: 90 } as any,
      { repo: 'a', scoreInclusividad: 40 } as any,
    ];
    component.datos = datos;

    component.ngOnChanges({ datos: new SimpleChange(undefined, datos, true) });

    expect(component.barChartLabels).toEqual(['a', 'b']);
    expect(component.barChartDatasets[0].data).toEqual([40, 90]);
  });

  it('asigna un color por cada barra según su score', () => {
    const datos = [
      { repo: 'alto', scoreInclusividad: 95 } as any,
      { repo: 'medio', scoreInclusividad: 75 } as any,
      { repo: 'bajo', scoreInclusividad: 30 } as any,
    ];
    component.datos = datos;

    component.ngOnChanges({ datos: new SimpleChange(undefined, datos, true) });

    expect(component.barChartDatasets[0].backgroundColor.length).toBe(3);
  });
});
