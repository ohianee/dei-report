import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const CLAVE_STORAGE = 'sesion_anonima_id';

@Injectable({
  providedIn: 'root'
})
export class SesionAnonima {
  private id: string | undefined;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  obtenerId(): string | undefined {
    if (!isPlatformBrowser(this.platformId)) {
      return undefined;
    }
    if (!this.id) {
      let guardado = localStorage.getItem(CLAVE_STORAGE);
      if (!guardado) {
        guardado = crypto.randomUUID();
        localStorage.setItem(CLAVE_STORAGE, guardado);
      }
      this.id = guardado;
    }
    return this.id;
  }
}