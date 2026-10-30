import { Component, computed, inject } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { Idioma } from '../../services/idioma';

@Component({
  selector: 'app-guia-ayuda',
  imports: [MatDialogModule, MatTabsModule, MatExpansionModule, MatIconModule, 
    MatButtonModule, TranslatePipe, MatTooltipModule],
  templateUrl: './guia-ayuda.html',
  styleUrl: './guia-ayuda.scss',
})
export class GuiaAyuda {
  private idioma = inject(Idioma);

  rutaPdf = computed(() => `/guia-usuario-dei-report-${this.idioma.idiomaActual()}.pdf`);
  nombreDescarga = computed(() => `Guia-Usuario-DEI-Report-${this.idioma.idiomaActual()}.pdf`);
  pasosIconos = ['login', 'settings_suggest', 'hourglass_top', 'insights', 
    'download', 'history', 'accessibility_new', 'smart_toy'];
  preguntasIndex = [1, 2, 3, 4, 5, 6, 7, 8];
}