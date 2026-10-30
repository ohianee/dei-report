import { Injectable, Inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { IDIOMAS_DISPONIBLES, IDIOMA_POR_DEFECTO } from '../compartido/idiomas-disponibles';

const CLAVE_IDIOMA = 'dei_idioma';
const CODIGOS_SOPORTADOS = IDIOMAS_DISPONIBLES.map(i => i.codigo);

@Injectable({
  providedIn: 'root'
})
export class Idioma {
  idiomaActual = signal<string>(IDIOMA_POR_DEFECTO);
  idiomasDisponibles = IDIOMAS_DISPONIBLES;

  constructor(
    private translateService: TranslateService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.translateService.addLangs(CODIGOS_SOPORTADOS);
    this.translateService.setFallbackLang(IDIOMA_POR_DEFECTO);

    const idiomaInicial = this.determinarIdiomaInicial();
    this.idiomaActual.set(idiomaInicial);
    this.translateService.use(idiomaInicial);
    
    this.actualizarAtributoLangHtml(idiomaInicial); 
  }

  cambiarIdioma(lang: string): void {
    if (!CODIGOS_SOPORTADOS.includes(lang)) return;

    this.idiomaActual.set(lang);
    this.translateService.use(lang);
    this.actualizarAtributoLangHtml(lang);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(CLAVE_IDIOMA, lang);
    }
  }

  private actualizarAtributoLangHtml(lang: string): void {
    if (isPlatformBrowser(this.platformId)) {
      this.document.documentElement.lang = lang;
    }
  }

  private determinarIdiomaInicial(): string {
    if (isPlatformBrowser(this.platformId)) {
      const guardado = localStorage.getItem(CLAVE_IDIOMA);
      if (guardado && CODIGOS_SOPORTADOS.includes(guardado)) {
        return guardado;
      }

      const idiomaNavegador = (navigator.language || '').split('-')[0];
      if (idiomaNavegador && CODIGOS_SOPORTADOS.includes(idiomaNavegador)) {
        return idiomaNavegador;
      }
    }
    return IDIOMA_POR_DEFECTO;
  }
}