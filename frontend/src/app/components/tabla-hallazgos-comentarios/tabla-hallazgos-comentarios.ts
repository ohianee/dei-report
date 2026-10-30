import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { HallazgoComentario } from '../../compartido/informe-dei';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-tabla-hallazgos-comentarios',
  imports: [MatPaginatorModule, MatCardModule, MatInputModule, CommonModule,
    MatTableModule, MatFormFieldModule, MatIconModule, MatSortModule, 
    MatChipsModule, TranslatePipe],
  templateUrl: './tabla-hallazgos-comentarios.html',
  styleUrl: './tabla-hallazgos-comentarios.scss',
})
export class TablaHallazgosComentarios implements OnChanges {
  @Input() datos: HallazgoComentario[] = [];

  columnasMostrar: string[] = ['repo', 'author', 'tipo', 'termino', 'severidad', 'contexto'];
  dataSource = new MatTableDataSource<HallazgoComentario>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] && this.datos) {
      this.dataSource.data = this.datos;
      setTimeout(() => {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      });
    }
  }

  aplicarFiltro(event: Event) {
    const valor = (event.target as HTMLInputElement).value;
    this.dataSource.filter = valor.trim().toLowerCase();
  }

  claseSeveridad(severidad: string): string {
    if (severidad === 'high') return 'sev-alta';
    if (severidad === 'medium') return 'sev-media';
    return 'sev-baja';
  }

  claveSeveridad(severidad: string): string {
    return 'SEVERIDAD.' + severidad.toUpperCase();
  }

  claveTipo(tipo: string): string {
    return 'TIPO_HALLAZGO.' + tipo.toUpperCase();
  }

  esAlternativaTraducible(tipo: string): boolean {
    return tipo !== 'non_inclusive';
  }

  claveSugerencia(alternativas: string): string {
    return 'SUGERENCIA_HALLAZGO.' + alternativas.toUpperCase();
  }
}