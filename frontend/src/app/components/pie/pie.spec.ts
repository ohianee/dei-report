import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, provideTranslateLoader } from '@ngx-translate/core';
import { Pie } from './pie';
import { TraduccionLoader } from '../../services/traduccion-loader';
import { IDIOMA_POR_DEFECTO } from '../../compartido/idiomas-disponibles';

describe('Pie', () => {
  let component: Pie;
  let fixture: ComponentFixture<Pie>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pie],
      providers: [
        provideRouter([]),
        provideTranslateService({
          lang: IDIOMA_POR_DEFECTO,
          fallbackLang: IDIOMA_POR_DEFECTO,
          loader: provideTranslateLoader(TraduccionLoader),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Pie);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('expone los iconos usados en el template', () => {
    expect(component.faEnvelope).toBeDefined();
    expect(component.faCodeBranch).toBeDefined();
    expect(component.faChartPie).toBeDefined();
    expect(component.faGithub).toBeDefined();
    expect(component.faLinkedin).toBeDefined();
    expect(component.faTwitter).toBeDefined();
  });
});
