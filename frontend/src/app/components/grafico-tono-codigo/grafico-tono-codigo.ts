import { Component, Input, OnChanges, OnDestroy, SimpleChanges, HostListener, ViewChild, inject } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { KeyValuePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-grafico-tono-codigo',
  imports: [BaseChartDirective, KeyValuePipe, TranslatePipe],
  templateUrl: './grafico-tono-codigo.html',
  styleUrl: './grafico-tono-codigo.scss',
})
export class GraficoTonoCodigo implements OnChanges, OnDestroy {
  private translateService = inject(TranslateService);
  private suscripcionIdioma?: Subscription;

  @Input() datos!: { [categoria: string]: number };
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true }
    },
    plugins: {
      legend: { display: false }
    }
  };

  public barChartLabels: string[] = [];
  public barChartDatasets: any[] = [
    {
      data: [],
      label: 'Apariciones'
    }
  ];

  private getColorReal(variable: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const color = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    return color ? color : fallback;
  }

  private aplicarColores() {
    if (this.barChartDatasets.length > 0) {
      const purple = this.getColorReal('--c-purple-muted', '#8687b4');
      const navy = this.getColorReal('--c-navy', '#273469');
      const textColor = this.getColorReal('--c-dark-gray', '#30343f');
      const gridColor = this.getColorReal('--c-lavender-light', '#efeaff');

      this.barChartDatasets[0].backgroundColor = purple;
      this.barChartDatasets[0].hoverBackgroundColor = navy;

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

  claveCategoria(categoria: string): string {
    return 'TONO_CODIGO_CATEGORIA.' + categoria.toUpperCase();
  }

  private actualizarEtiquetasTraducidas() {
    if (!this.datos) return;
    this.barChartLabels = Object.keys(this.datos).map(
      categoria => this.translateService.instant(this.claveCategoria(categoria))
    );
    this.barChartDatasets[0].label = this.translateService.instant('GRAFICOS_ACCESIBILIDAD.APARICIONES');
    this.chart?.update();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] && this.datos) {
      this.barChartDatasets[0].data = Object.values(this.datos);
      this.barChartDatasets[0].borderRadius = 8;
      this.barChartDatasets[0].borderWidth = 0;
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