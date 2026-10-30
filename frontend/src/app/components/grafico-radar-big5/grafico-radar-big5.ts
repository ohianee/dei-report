import { Component, Input, OnChanges, OnDestroy, SimpleChanges, HostListener, ViewChild, inject } from '@angular/core';
import { ChartConfiguration, Chart } from 'chart.js';
import { KeyValuePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-grafico-radar-big5',
  imports: [BaseChartDirective, KeyValuePipe, TranslatePipe],
  templateUrl: './grafico-radar-big5.html',
  styleUrl: './grafico-radar-big5.scss',
})
export class GraficoRadarBig5 implements OnChanges, OnDestroy {
  private translateService = inject(TranslateService);
  private suscripcionIdioma?: Subscription;

  @Input() datos!: { [rasgo: string]: number };
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  public radarChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: { beginAtZero: true }
    }
  };

  public radarChartLabels: string[] = [];
  public radarChartDatasets: any[] = [
    {
      data: [],
      label: 'Apariciones en texto'
    }
  ];

  private getColorReal(variable: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const color = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    return color ? color : fallback;
  }

  private aplicarColores() {
    if (this.radarChartDatasets.length > 0) {
      const bg = this.getColorReal('--c-radar-bg', 'rgba(134, 135, 180, 0.3)');
      const navy = this.getColorReal('--c-navy', '#273469');
      const navyDarkest = this.getColorReal('--c-navy-darkest', '#1e2749');
      const white = this.getColorReal('--c-white', '#ffffff'); 
      const textColor = this.getColorReal('--c-dark-gray', '#30343f');
      const gridColor = this.getColorReal('--c-lavender-light', '#efeaff');
      const fontFamily = Chart.defaults.font.family;
      const fontSize = Chart.defaults.font.size;
      const fontWeight = Chart.defaults.font.weight;

      this.radarChartDatasets[0].backgroundColor = bg;
      this.radarChartDatasets[0].borderColor = navy;
      this.radarChartDatasets[0].pointBackgroundColor = navyDarkest;
      this.radarChartDatasets[0].pointBorderColor = white;
      this.radarChartDatasets[0].pointHoverBackgroundColor = white;
      this.radarChartDatasets[0].pointHoverBorderColor = navy;

      if (this.radarChartOptions?.scales?.['r']) {
        const escalaR = this.radarChartOptions.scales['r'] as any;

        escalaR.ticks = { 
          ...escalaR.ticks, 
          color: textColor, 
          backdropColor: 'transparent',
          font: { family: fontFamily, size: fontSize, weight: fontWeight }
        };
        escalaR.pointLabels = { 
          ...escalaR.pointLabels, 
          color: textColor,
          font: { family: fontFamily, size: fontSize, weight: fontWeight }
        };
        escalaR.grid = { 
          ...escalaR.grid, 
          color: gridColor 
        };
        escalaR.angleLines = { 
          ...escalaR.angleLines, 
          color: gridColor 
        };
      }

      this.chart?.update();
    }
  }

  claveRasgo(rasgo: string): string {
    return 'BIG_FIVE.' + rasgo.toUpperCase();
  }

  private actualizarEtiquetasTraducidas() {
    if (!this.datos) return;
    this.radarChartLabels = Object.keys(this.datos).map(
      rasgo => this.translateService.instant(this.claveRasgo(rasgo))
    );
    this.radarChartDatasets[0].label = this.translateService.instant('GRAFICOS_ACCESIBILIDAD.APARICIONES');
    this.chart?.update();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] && this.datos) {
      this.radarChartDatasets[0].data = Object.values(this.datos);
      this.actualizarEtiquetasTraducidas();
      this.aplicarColores();
    }
  }

  constructor() {
    this.suscripcionIdioma = this.translateService.onLangChange.subscribe(() => {
      this.actualizarEtiquetasTraducidas();
    });
  }

  ngOnDestroy(): void {
    this.suscripcionIdioma?.unsubscribe();
  }

  @HostListener('document:tema-cambiado')
  onTemaCambiado() {
    setTimeout(() => {
      this.aplicarColores();
    }, 10);
  }
}