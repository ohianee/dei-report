import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Analisis } from '../../services/analisis';
import { InformeDEI } from '../../compartido/informe-dei';
import { GraficoRadarBig5 } from '../grafico-radar-big5/grafico-radar-big5';
import { GraficoTonoCodigo } from '../grafico-tono-codigo/grafico-tono-codigo';
import { TablaDiversidadAutor } from '../tabla-diversidad-autor/tabla-diversidad-autor';
import { TablaDiversidadRepo } from '../tabla-diversidad-repo/tabla-diversidad-repo';
import { GraficoScoreInclusividad } from '../grafico-score-inclusividad/grafico-score-inclusividad';
import { TablaLenguajeRepo } from '../tabla-lenguaje-repo/tabla-lenguaje-repo';
import { TablaHallazgosLenguaje } from '../tabla-hallazgos-lenguaje/tabla-hallazgos-lenguaje';
import { TablaHallazgosComentarios } from '../tabla-hallazgos-comentarios/tabla-hallazgos-comentarios';
import { GraficoClimaComunicacion } from '../grafico-clima-comunicacion/grafico-clima-comunicacion';
import { ChatbotDei } from '../chatbot-dei/chatbot-dei';

@Component({
  selector: 'app-informe-dei',
  imports: [MatCardModule, MatProgressSpinnerModule, MatButtonModule, RouterLink,
    MatIconModule, MatTabsModule, DecimalPipe, PercentPipe, TranslatePipe, GraficoRadarBig5, GraficoTonoCodigo, TablaDiversidadAutor,
    TablaDiversidadRepo, GraficoScoreInclusividad, TablaLenguajeRepo, TablaHallazgosLenguaje, TablaHallazgosComentarios,
    GraficoClimaComunicacion, ChatbotDei],
  templateUrl: './informe-dei.html',
  styleUrl: './informe-dei.scss',
})
export class InformeDei implements OnInit {
  private route = inject(ActivatedRoute);
  private analisisService = inject(Analisis);
  private platformId = inject(PLATFORM_ID);
  private translate = inject(TranslateService);

  jobId = signal('');
  informe = signal<InformeDEI | null>(null);
  errorMsj = signal('');
  cargando = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('job_id');
    if (!id) {
      this.errorMsj.set(this.translate.instant('ESTADO_ANALISIS.SIN_JOB_ID'));
      this.cargando.set(false);
      return;
    }
    this.jobId.set(id);
    
    if (isPlatformBrowser(this.platformId)) {
      this.cargarInforme();
    }
  }

  cargarInforme(): void {
    this.analisisService.getInforme(this.jobId()).subscribe({
        next: (data) => {
          this.informe.set(data);
          this.cargando.set(false);
        },
        error: (err) => {
          this.errorMsj.set(err.message ?? this.translate.instant('ESTADO_ANALISIS.ERROR_TITULO'));
          this.cargando.set(false);
        }
      });
  }
}