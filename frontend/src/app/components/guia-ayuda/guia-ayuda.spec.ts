import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { GuiaAyuda } from './guia-ayuda';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';
import { Idioma } from '../../services/idioma';

describe('GuiaAyuda', () => {
  let component: GuiaAyuda;
  let fixture: ComponentFixture<GuiaAyuda>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuiaAyuda],
      providers: [
        {
          provide: Idioma,
          useValue: {
            idiomaActual: () => IDIOMA_POR_DEFECTO,
          },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GuiaAyuda);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('expone la ruta del PDF de la guía en el idioma por defecto', () => {
    expect(component.rutaPdf()).toBe(`/guia-usuario-dei-report-${IDIOMA_POR_DEFECTO}.pdf`);
    expect(component.nombreDescarga()).toBe(`Guia-Usuario-DEI-Report-${IDIOMA_POR_DEFECTO}.pdf`);
  });

  it('expone 8 iconos de pasos y 8 preguntas frecuentes', () => {
    expect(component.pasosIconos.length).toBe(8);
    expect(component.preguntasIndex).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});