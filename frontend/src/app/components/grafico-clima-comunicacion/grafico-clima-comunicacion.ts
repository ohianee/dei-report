import { Component, Input, OnChanges, SimpleChanges, HostListener, ViewChild, OnDestroy, inject } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ClimaComunicacion } from '../../compartido/informe-dei';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-grafico-clima-comunicacion',
  imports: [BaseChartDirective, TranslatePipe],
  templateUrl: './grafico-clima-comunicacion.html',
  styleUrl: './grafico-clima-comunicacion.scss',
})
export class GraficoClimaComunicacion implements OnChanges, OnDestroy {
  private translateService = inject(TranslateService);
  private suscripcionIdioma?: Subscription;

  @Input() datos!: ClimaComunicacion;
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  public doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
    },
  };

  public doughnutChartLabels: string[] = [];
  public doughnutChartDatasets: any[] = [
    {
      data: [],
      backgroundColor: [],
      hoverBackgroundColor: [],
      borderWidth: 0,
    },
  ];

  constructor() {
    this.suscripcionIdioma = this.translateService.onLangChange.subscribe(() => {
      this.actualizarTextos();
    });
    this.actualizarTextos();
  }

  private actualizarTextos() {
    this.doughnutChartLabels = [
      this.translateService.instant('GRAFICOS_ACCESIBILIDAD.POSITIVO'),
      this.translateService.instant('GRAFICOS_ACCESIBILIDAD.NEGATIVO'),
      this.translateService.instant('GRAFICOS_ACCESIBILIDAD.NEUTRO')
    ];
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

  private aplicarColores() {
    if (this.doughnutChartDatasets.length > 0) {
      const positivo = this.getColorReal('--c-positivo', '#273469');
      const negativo = this.getColorReal('--c-negativo', '#8687b4');
      const neutro = this.getColorReal('--c-neutro', '#e4d9ff');
      const textColor = this.getColorReal('--c-dark-gray', '#30343f');
      const borderColor = this.getColorReal('--c-white', '#ffffff');

      this.doughnutChartDatasets[0].backgroundColor = [positivo, negativo, neutro];
      this.doughnutChartDatasets[0].hoverBackgroundColor = [positivo, negativo, neutro];
      this.doughnutChartDatasets[0].borderColor = borderColor;
      this.doughnutChartDatasets[0].borderWidth = 2;

      if (this.doughnutChartOptions?.plugins?.legend?.labels) {
        this.doughnutChartOptions.plugins.legend.labels.color = textColor;
      }
      this.chart?.update();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] && this.datos) {
      this.doughnutChartDatasets[0].data = [
        this.datos.porcentajePositivos,
        this.datos.porcentajeNegativos,
        this.datos.porcentajeNeutros,
      ];
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