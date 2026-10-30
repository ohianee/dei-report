import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { TablaDiversidadAutor } from './tabla-diversidad-autor';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('TablaDiversidadAutor', () => {
  let component: TablaDiversidadAutor;
  let fixture: ComponentFixture<TablaDiversidadAutor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablaDiversidadAutor],
      providers: [
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TablaDiversidadAutor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnChanges vuelca los datos de entrada en el dataSource', () => {
    const datos = [{ author: 'ana', n_comentarios: 3, n_adjetivos: 5, entropia: 1.2, simpson: 0.4 }];
    component.datos = datos;

    component.ngOnChanges({ datos: new SimpleChange(undefined, datos, true) });

    expect(component.dataSource.data).toEqual(datos);
  });

  it('aplicarFiltro normaliza el texto y lo aplica al dataSource', () => {
    const evento = { target: { value: '  Ana  ' } } as unknown as Event;
    component.aplicarFiltro(evento);
    expect(component.dataSource.filter).toBe('ana');
  });
});
