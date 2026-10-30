import { Component, OnInit, OnDestroy, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Analisis } from '../../services/analisis';
import { Subscription, timer, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { EstadoJob } from '../../compartido/informe-dei';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { DecimalPipe, UpperCasePipe} from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-estado-analisis',
  imports: [MatCardModule, MatProgressSpinnerModule, UpperCasePipe, DecimalPipe,
    MatProgressBarModule, MatIconModule, MatButtonModule, RouterLink, TranslatePipe],
  templateUrl: './estado-analisis.html',
  styleUrl: './estado-analisis.scss',
})
export class EstadoAnalisis implements OnInit, OnDestroy {
  jobId!: string;
  estadoActual = signal<EstadoJob | null>(null);
  errorMsj = signal<string>('');
  isPolling = signal<boolean>(true);
  pollingSuscripcion!: Subscription;
  tiempoTranscurrido = signal<number>(0);
  tiempoSuscripcion!: Subscription;
  progresoMostrado = signal<number>(0);
  progresoAnimacionSuscripcion!: Subscription;

  private progresoReal = 0;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private analisisService = inject(Analisis);
  private platformId = inject(PLATFORM_ID);
  private translate = inject(TranslateService);
  private timestampInicio: number = 0;

  tiempoFormateado = computed(() => {
    const total = this.tiempoTranscurrido();
    const min = Math.floor(total / 60).toString().padStart(2, '0');
    const sec = (total % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  });

  ngOnInit(): void {
    this.jobId = this.route.snapshot.paramMap.get('job_id') || '';

    if (!this.jobId) {
      this.errorMsj.set(this.translate.instant('ESTADO_ANALISIS.SIN_JOB_ID'));
      this.isPolling.set(false);
      return;
    }
    
    this.iniciarContador();
    this.iniciarPolling();
    this.iniciarAnimacionProgreso();
  }

  iniciarPolling() {
    this.pollingSuscripcion = timer(0, 3000)
      .pipe(
        takeWhile(() => this.isPolling()),
        switchMap(() => this.analisisService.getEstado(this.jobId))
      )
      .subscribe({
        next: (res) => {
          this.estadoActual.set(res);
          this.progresoReal = res.progreso;

          if (res.estado === 'completado') {
            this.progresoMostrado.set(100);
            this.finalizarProceso();
            this.router.navigate(['/informe', this.jobId]);
          } else if (res.estado === 'error') {
            this.errorMsj.set(res.mensaje || this.translate.instant('ESTADO_ANALISIS.ERROR_SERVIDOR'));
            this.finalizarProceso();
          }
        },
        error: (err) => {
          this.errorMsj.set(err.message || this.translate.instant('ESTADO_ANALISIS.ERROR_CONEXION'));
          this.finalizarProceso();
        }
      });
  }

  iniciarContador() {
    if (isPlatformBrowser(this.platformId)) {
      const storageKey = `timer_${this.jobId}`;
      const guardado = sessionStorage.getItem(storageKey);

      if (guardado) {
        this.timestampInicio = parseInt(guardado, 10);
      } else {
        this.timestampInicio = Date.now();
        sessionStorage.setItem(storageKey, this.timestampInicio.toString());
      }

      this.tiempoSuscripcion = interval(1000).subscribe(() => {
        const segundosReales = Math.floor((Date.now() - this.timestampInicio) / 1000);
        this.tiempoTranscurrido.set(segundosReales);
      });
    }
  }

  finalizarProceso() {
    this.isPolling.set(false);
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(`timer_${this.jobId}`);
    }
  }

  iniciarAnimacionProgreso() {
    this.progresoAnimacionSuscripcion = interval(150)
      .pipe(takeWhile(() => this.isPolling()))
      .subscribe(() => {
        const techo = Math.min(this.progresoReal + 2, 99); 
        const actual = this.progresoMostrado();

        if (actual < techo) {
          const paso = Math.max((techo - actual) * 0.05, 0.1);
          this.progresoMostrado.set(Math.min(actual + paso, techo));
        } else if (actual < this.progresoReal) {
          this.progresoMostrado.set(this.progresoReal);
        }
      });
  }

  ngOnDestroy(): void {
    if (this.pollingSuscripcion) this.pollingSuscripcion.unsubscribe();
    if (this.tiempoSuscripcion) this.tiempoSuscripcion.unsubscribe();
    if (this.progresoAnimacionSuscripcion) this.progresoAnimacionSuscripcion.unsubscribe();
  }

  getMensajeTraducido(mensajeBackend: string): string {
    if (!mensajeBackend) return '';
    const partes = mensajeBackend.split('|');
    const codigo = `BACKEND_MSG.${partes[0]}`;
    
    if (partes[0] === 'DOWNLOADING_START') {
      return this.translate.instant(codigo, { total: partes[1] });
    } else if (partes[0] === 'DOWNLOADING_PROGRESS') {
      return this.translate.instant(codigo, { repo: partes[1], current: partes[2], total: partes[3] });
    } else if (partes[0] === 'ERROR') {
      return this.translate.instant(codigo, { msj: partes.slice(1).join('|') });
    }
    return this.translate.instant(codigo);
  }
}