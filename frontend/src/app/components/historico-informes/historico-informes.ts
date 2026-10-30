import { Component, ViewChild, OnInit, AfterViewInit, inject, signal, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { timer, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { RouterLink, Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Analisis } from '../../services/analisis';
import { Autenticar } from '../../services/autenticar';
import { HistorialItem } from '../../compartido/historial';
import { DescargarInformeService } from '../../services/descargar-informe';

@Component({
  selector: 'app-historico-informes',
  imports: [RouterLink, MatCardModule, MatIconModule, MatFormFieldModule, 
    MatInputModule, MatTableModule, MatPaginatorModule, MatSortModule, MatButtonModule, 
    MatTooltipModule, CommonModule, TranslatePipe],
  templateUrl: './historico-informes.html',
  styleUrl: './historico-informes.scss',
})
export class HistoricoInformes implements OnInit, AfterViewInit, OnDestroy {
  columnasMostrar: string[] = ['fecha', 'job_id', 'objetivo', 'estado', 'acciones'];
  dataSource = new MatTableDataSource<HistorialItem>();
  nombreUsuario = signal<string>('');
  esInvitado = signal<boolean>(true);
  isBrowser = signal<boolean>(false);
  isPolling = signal<boolean>(false);
  pollingSuscripcion?: Subscription;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private analisisService = inject(Analisis);
  private autenticarService = inject(Autenticar);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private descargarInformeService = inject(DescargarInformeService); 
  
  ngOnInit(): void {
    this.isBrowser.set(isPlatformBrowser(this.platformId));
    if (this.isBrowser()) {
      const usuario = this.autenticarService.getUsuarioLogueado();
      this.nombreUsuario.set(usuario?.user || '');
      this.esInvitado.set(!this.autenticarService.estaAutenticado());
      this.cargarHistorico();
    }
  }

  trackByJobId(index: number, item: HistorialItem): string {
    return item.job_id;
  }

  cargarHistorico() {
    this.analisisService.getHistorico().subscribe({
      next: (datos) => {
        this.dataSource.data = datos;
        this.evaluarPolling(datos);
      },
      error: (err) => console.error("Error cargando histórico:", err)
    });
  }

  evaluarPolling(datos: HistorialItem[]) {
    const hayTrabajosActivos = datos.some(d => d.estado === 'procesando' || d.estado === 'pendiente');
    if (hayTrabajosActivos && !this.isPolling()) {
      this.isPolling.set(true);
      this.pollingSuscripcion = timer(5000, 5000).pipe(
        takeWhile(() => this.isPolling()),
        switchMap(() => this.analisisService.getHistorico())
      ).subscribe({
        next: (nuevosDatos) => {
          this.dataSource.data = nuevosDatos;
          if (!nuevosDatos.some(d => d.estado === 'procesando' || d.estado === 'pendiente')) {
            this.isPolling.set(false);
          }
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.isPolling.set(false);
    if (this.pollingSuscripcion) {
      this.pollingSuscripcion.unsubscribe();
    }
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  aplicarFiltro(event: Event) {
    const valor = (event.target as HTMLInputElement).value;
    this.dataSource.filter = valor.trim().toLowerCase();
  }

  borrarInforme(jobId: string, event?: Event) {
    event?.stopPropagation();
    const confirmacion = confirm(this.translate.instant('HISTORICO.CONFIRMAR_BORRADO'));
    if (confirmacion) {
      this.analisisService.borrarInforme(jobId).subscribe({
        next: () => {
          const datosActualizados = this.dataSource.data.filter(item => item.job_id !== jobId);
          this.dataSource.data = datosActualizados;
          console.log(`Informe ${jobId} eliminado con éxito.`);
        },
        error: (err) => {
          console.error("Error al intentar borrar el informe:", err);
          alert(this.translate.instant('HISTORICO.ERROR_BORRADO'));
        }
      });
    }
  }

  verEstadoTrabajo(jobId: string) {
    this.router.navigate(['/estado-analisis', jobId]);
  }

  async descargarInforme(jobId: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    await this.descargarInformeService.generarYDescargar(jobId);
  }
}