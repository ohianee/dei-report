import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { TablaHallazgosLenguaje } from './tabla-hallazgos-lenguaje';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('TablaHallazgosLenguaje', () => {
  let component: TablaHallazgosLenguaje;
  let fixture: ComponentFixture<TablaHallazgosLenguaje>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablaHallazgosLenguaje],
      providers: [
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TablaHallazgosLenguaje);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnChanges vuelca los datos de entrada en el dataSource', () => {
    const datos = [{
      repo: 'acme/web', path: 'a.py', identificador: 'whitelist_ips', termino: 'whitelist',
      severidad: 'high' as const, alternativas: 'allowlist, permitlist', ocurrencias: 3,
    }];
    component.datos = datos;

    component.ngOnChanges({ datos: new SimpleChange(undefined, datos, true) });

    expect(component.dataSource.data).toEqual(datos);
  });

  it('aplicarFiltro normaliza el texto y lo aplica al dataSource', () => {
    const evento = { target: { value: '  Whitelist  ' } } as unknown as Event;
    component.aplicarFiltro(evento);
    expect(component.dataSource.filter).toBe('whitelist');
  });

  it('claseSeveridad y claveSeveridad mapean los 3 niveles', () => {
    expect(component.claseSeveridad('high')).toBe('sev-alta');
    expect(component.claseSeveridad('medium')).toBe('sev-media');
    expect(component.claseSeveridad('low')).toBe('sev-baja');
    expect(component.claveSeveridad('low')).toBe('SEVERIDAD.LOW');
  });
});
