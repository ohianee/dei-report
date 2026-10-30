import { Component, OnInit, PLATFORM_ID, inject, signal, effect } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PreferenciasAccesibilidad, PaletaDaltonismo, TemaAccesibilidad } from '../../compartido/accesibilidad'
import { Chart } from 'chart.js';
import { TranslatePipe } from '@ngx-translate/core';

const CLAVE_STORAGE = 'dei_accesibilidad_prefs';
const ESCALAS = [100, 112, 125, 140, 160];
const PREFERENCIAS_POR_DEFECTO: PreferenciasAccesibilidad = {
  fuenteDislexia: false,
  negrita: false,
  escalaFuente: 100,
  paleta: 'normal',
  tema: 'sistema',
  lecturaAutomatica: false,
};

@Component({
  selector: 'app-accesibilidad-dei',
  imports: [MatIconModule, MatButtonModule, MatTooltipModule, TranslatePipe],
  templateUrl: './accesibilidad-dei.html',
  styleUrl: './accesibilidad-dei.scss',
})
export class AccesibilidadDei implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private documento = inject(DOCUMENT);

  panelAbierto = signal<boolean>(false);
  fuenteDislexia = signal<boolean>(PREFERENCIAS_POR_DEFECTO.fuenteDislexia);
  negrita = signal<boolean>(PREFERENCIAS_POR_DEFECTO.negrita);
  escalaFuente = signal<number>(PREFERENCIAS_POR_DEFECTO.escalaFuente);
  paleta = signal<PaletaDaltonismo>(PREFERENCIAS_POR_DEFECTO.paleta);
  tema = signal<TemaAccesibilidad>(PREFERENCIAS_POR_DEFECTO.tema);
  lecturaAutomatica = signal<boolean>(PREFERENCIAS_POR_DEFECTO.lecturaAutomatica);
  paletasDisponibles: { valor: PaletaDaltonismo; etiqueta: string; muestra: string[] }[] = [
    { valor: 'normal', etiqueta: 'ACCESIBILIDAD.PALETA_NORMAL', muestra: ['#273469', '#e4d9ff', '#8687b4'] },
    { valor: 'protan-deutan', etiqueta: 'ACCESIBILIDAD.PALETA_PROTAN', muestra: ['#0072B2', '#E69F00', '#333333'] },
    { valor: 'tritan', etiqueta: 'ACCESIBILIDAD.PALETA_TRITAN', muestra: ['#B2182B', '#1B7837', '#333333'] },
    { valor: 'alto-contraste', etiqueta: 'ACCESIBILIDAD.PALETA_ALTO_CONTRASTE', muestra: ['#000000', '#FFFFFF', '#FFD400'] },
  ];

  private inicializado = false;

  constructor() {
    effect(() => {
      const prefs: PreferenciasAccesibilidad = {
        fuenteDislexia: this.fuenteDislexia(),
        negrita: this.negrita(),
        escalaFuente: this.escalaFuente(),
        paleta: this.paleta(),
        tema: this.tema(),
        lecturaAutomatica: this.lecturaAutomatica(),
      };

      this.aplicarPreferencias(prefs);

      if (this.inicializado && isPlatformBrowser(this.platformId)) {
        localStorage.setItem(CLAVE_STORAGE, JSON.stringify(prefs));
      }
    });

    if (isPlatformBrowser(this.platformId)) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.tema() === 'sistema') {
          this.aplicarPreferencias({...PREFERENCIAS_POR_DEFECTO, tema: 'sistema'});
        }
      });
      
      this.documento.body.addEventListener('click', (e) => this.manejarLecturaVoz(e));
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.cargarPreferenciasGuardadas();
    }
    this.inicializado = true;
  }

  private cargarPreferenciasGuardadas() {
    try {
      const guardado = localStorage.getItem(CLAVE_STORAGE);
      if (!guardado) return;

      const prefs: Partial<PreferenciasAccesibilidad> = JSON.parse(guardado);
      if (typeof prefs.fuenteDislexia === 'boolean') this.fuenteDislexia.set(prefs.fuenteDislexia);
      if (typeof prefs.negrita === 'boolean') this.negrita.set(prefs.negrita);
      if (typeof prefs.escalaFuente === 'number' && ESCALAS.includes(prefs.escalaFuente)) {
        this.escalaFuente.set(prefs.escalaFuente);
      }
      if (prefs.paleta) this.paleta.set(prefs.paleta);
      if (prefs.tema) this.tema.set(prefs.tema);
      if (typeof prefs.lecturaAutomatica === 'boolean') this.lecturaAutomatica.set(prefs.lecturaAutomatica);
    } catch {
      // Si el JSON guardado está corrupto, simplemente se ignora y se continúa
    }
  }

  private aplicarPreferencias(prefs: PreferenciasAccesibilidad) {
    const html = this.documento.documentElement;
    html.classList.toggle('dei-fuente-dislexia', prefs.fuenteDislexia);
    html.classList.toggle('dei-negrita', prefs.negrita);

    if (isPlatformBrowser(this.platformId)) {
      Chart.defaults.font.family = prefs.fuenteDislexia 
        ? "'OpenDyslexic', 'Comic Sans MS', sans-serif" 
        : "'Inter', 'Roboto', sans-serif";
      
      Chart.defaults.font.weight = prefs.negrita ? 'bold' : 'normal';
      Chart.defaults.font.size = 12 * (prefs.escalaFuente / 100);
      
      this.documento.dispatchEvent(new Event('tema-cambiado'));
    }

    html.classList.remove(
      'dei-paleta-protan-deutan',
      'dei-paleta-tritan',
      'dei-paleta-alto-contraste'
    );
    if (prefs.paleta !== 'normal') {
      html.classList.add(`dei-paleta-${prefs.paleta}`);
    }

    html.style.setProperty('--dei-escala-fuente', `${prefs.escalaFuente}%`);

    let prefiereOscuro = false;
    if (isPlatformBrowser(this.platformId)) {
      prefiereOscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    const esOscuro = prefs.tema === 'oscuro' || (prefs.tema === 'sistema' && prefiereOscuro);
    html.classList.toggle('dei-tema-oscuro', esOscuro);
  }
  
  togglePanel() {
    this.panelAbierto.update(v => !v);
  }

  toggleFuenteDislexia() {
    this.fuenteDislexia.update(v => !v);
  }

  toggleNegrita() {
    this.negrita.update(v => !v);
  }

  seleccionarPaleta(valor: PaletaDaltonismo) {
    this.paleta.set(valor);
  }

  aumentarFuente() {
    const idx = ESCALAS.indexOf(this.escalaFuente());
    if (idx < ESCALAS.length - 1) {
      this.escalaFuente.set(ESCALAS[idx + 1]);
    }
  }

  disminuirFuente() {
    const idx = ESCALAS.indexOf(this.escalaFuente());
    if (idx > 0) {
      this.escalaFuente.set(ESCALAS[idx - 1]);
    }
  }

  seleccionarTema(nuevoTema: TemaAccesibilidad) { this.tema.set(nuevoTema); }
  toggleLecturaAutomatica() { this.lecturaAutomatica.update(v => !v); }

  private manejarLecturaVoz(e: MouseEvent) {
    if (!this.lecturaAutomatica()) return;

    const target = e.target as HTMLElement;
    if (target.closest('.dei-panel')) return; 
    
    const texto = target.innerText || target.getAttribute('aria-label') || target.title;
    if (texto && texto.trim() !== '') {
      window.speechSynthesis.cancel();
      const locucion = new SpeechSynthesisUtterance(texto);
      locucion.lang = document.documentElement.lang || 'es-ES'; 
      window.speechSynthesis.speak(locucion);
    }
  }

  restablecer() {
    this.fuenteDislexia.set(PREFERENCIAS_POR_DEFECTO.fuenteDislexia);
    this.negrita.set(PREFERENCIAS_POR_DEFECTO.negrita);
    this.escalaFuente.set(PREFERENCIAS_POR_DEFECTO.escalaFuente);
    this.paleta.set(PREFERENCIAS_POR_DEFECTO.paleta);
    this.tema.set(PREFERENCIAS_POR_DEFECTO.tema);
    this.lecturaAutomatica.set(PREFERENCIAS_POR_DEFECTO.lecturaAutomatica);
  }
}