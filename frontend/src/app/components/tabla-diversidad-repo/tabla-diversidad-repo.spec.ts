import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { TablaDiversidadRepo } from './tabla-diversidad-repo';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('TablaDiversidadRepo', () => {
  let component: TablaDiversidadRepo;
  let fixture: ComponentFixture<TablaDiversidadRepo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablaDiversidadRepo],
      providers: [
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TablaDiversidadRepo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnChanges vuelca los datos de entrada en el dataSource', () => {
    const datos = [{ repo: 'acme/web', comentarios: 10, adjetivos: 20, adjetivos_unicos: 8, entropia: 1.5, simpson: 0.6, ttr: 0.4 }];
    component.datos = datos;

    component.ngOnChanges({ datos: new SimpleChange(undefined, datos, true) });

    expect(component.dataSource.data).toEqual(datos);
  });

  it('no toca el dataSource si datos no ha cambiado', () => {
    component.ngOnChanges({});
    expect(component.dataSource.data).toEqual([]);
  });
});
