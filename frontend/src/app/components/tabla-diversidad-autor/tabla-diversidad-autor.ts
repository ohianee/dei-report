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
import { DecimalPipe } from '@angular/common';
import { DiversidadAutor } from '../../compartido/informe-dei';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-tabla-diversidad-autor',
  imports: [MatPaginatorModule, MatCardModule, MatInputModule, 
    MatTableModule, DecimalPipe, MatFormFieldModule, MatIconModule, 
    MatSortModule, TranslatePipe],
  templateUrl: './tabla-diversidad-autor.html',
  styleUrl: './tabla-diversidad-autor.scss',
})
export class TablaDiversidadAutor implements OnChanges {
  @Input() datos: DiversidadAutor[] = [];
  
  columnasMostrar: string[] = ['author', 'n_comentarios', 'n_adjetivos', 'entropia', 'simpson'];
  dataSource = new MatTableDataSource<DiversidadAutor>();

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
}