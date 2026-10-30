import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { HallazgoLenguaje } from '../../compartido/informe-dei';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-tabla-hallazgos-lenguaje',
  imports: [MatPaginatorModule, MatCardModule, MatInputModule,
    MatTableModule, MatFormFieldModule, MatIconModule, MatSortModule, 
    MatChipsModule, TranslatePipe],
  templateUrl: './tabla-hallazgos-lenguaje.html',
  styleUrl: './tabla-hallazgos-lenguaje.scss',
})
export class TablaHallazgosLenguaje implements OnChanges {
  @Input() datos: HallazgoLenguaje[] = [];

  columnasMostrar: string[] = ['repo', 'path', 'identificador', 'termino', 'ocurrencias', 'severidad', 'alternativas'];
  dataSource = new MatTableDataSource<HallazgoLenguaje>();

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
}