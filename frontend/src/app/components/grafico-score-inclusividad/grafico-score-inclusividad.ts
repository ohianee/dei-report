import { Component, Input, OnChanges, SimpleChanges, HostListener, ViewChild, OnDestroy, inject } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { RepoLenguajeInclusivo } from '../../compartido/informe-dei';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-grafico-score-inclusividad',
  imports: [BaseChartDirective, TranslatePipe],
  templateUrl: './grafico-score-inclusividad.html',
  styleUrl: './grafico-score-inclusividad.scss',
})
export class GraficoScoreInclusividad implements OnChanges, OnDestroy {
  private translateService = inject(TranslateService);
  private suscripcionIdioma?: Subscription;

  @Input() datos: RepoLenguajeInclusivo[] = [];
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: { beginAtZero: true, max: 100 }
    },
    plugins: {
      legend: { display: false }
    }
  };

  public barChartLabels: string[] = [];
  public barChartDatasets: any[] = [
    {
      data: [],
      label: ''
    }
  ];

  constructor() {
    this.suscripcionIdioma = this.translateService.onLangChange.subscribe(() => {
      this.actualizarTextos();
    });
    this.actualizarTextos();
  }

  private actualizarTextos() {
    this.barChartDatasets[0].label = this.translateService.instant('GRAFICOS_ACCESIBILIDAD.SCORE_LABEL');
    this.chart?.update();
  }

  ngOnDestroy(): void {
    this.suscripcionIdioma?.unsubscribe();
  }

  private getColorReal(variable: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const color = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    return color ? color : fallback;
  }

  private colorPorScore(score: number): string {
    if (score >= 90) return this.getColorReal('--c-navy', '#273469');
    if (score >= 70) return this.getColorReal('--c-purple-muted', '#8687b4');
    return this.getColorReal('--c-gray', '#95979f');
  }

  private aplicarColores() {
    if (this.barChartDatasets.length > 0 && this.datos) {
      const ordenado = [...this.datos].sort((a, b) => a.scoreInclusividad - b.scoreInclusividad);
      this.barChartDatasets[0].backgroundColor = ordenado.map(r => this.colorPorScore(r.scoreInclusividad));
      
      const textColor = this.getColorReal('--c-dark-gray', '#30343f');
      const gridColor = this.getColorReal('--c-lavender-light', '#efeaff');

      if (this.barChartOptions?.scales) {
        if (this.barChartOptions.scales['x']) {
          this.barChartOptions.scales['x'].ticks = { color: textColor };
          this.barChartOptions.scales['x'].grid = { color: gridColor };
        }
        if (this.barChartOptions.scales['y']) {
          this.barChartOptions.scales['y'].ticks = { color: textColor };
          this.barChartOptions.scales['y'].grid = { color: gridColor };
        }
      }

      this.chart?.update();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] && this.datos) {
      const ordenado = [...this.datos].sort((a, b) => a.scoreInclusividad - b.scoreInclusividad);
      this.barChartLabels = ordenado.map(r => r.repo);
      this.barChartDatasets[0].data = ordenado.map(r => r.scoreInclusividad);
      this.barChartDatasets[0].borderRadius = 8;
      this.barChartDatasets[0].borderWidth = 0;
      this.aplicarColores();
    }
  }

  @HostListener('document:tema-cambiado')
  onTemaCambiado() {
    setTimeout(() => {
      this.aplicarColores();
    }, 10);
  }
}