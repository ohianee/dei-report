import { Injectable } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { TRADUCCIONES_POR_IDIOMA, IDIOMA_POR_DEFECTO } from '../compartido/idiomas-disponibles'

@Injectable({ providedIn: 'root' })
export class TraduccionLoader implements TranslateLoader {

  getTranslation(lang: string): Observable<TranslationObject> {
    const traducciones = 
      TRADUCCIONES_POR_IDIOMA[lang] ??
      TRADUCCIONES_POR_IDIOMA[IDIOMA_POR_DEFECTO];

    return of(traducciones as TranslationObject);
  }
}