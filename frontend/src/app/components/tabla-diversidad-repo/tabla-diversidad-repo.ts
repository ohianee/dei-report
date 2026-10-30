import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule } from '@angular/material/sort';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { DiversidadRepo } from '../../compartido/informe-dei';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-tabla-diversidad-repo',
  imports: [MatCardModule, MatPaginatorModule, MatTableModule, DecimalPipe, 
    PercentPipe, MatIconModule, MatSortModule, TranslatePipe],
  templateUrl: './tabla-diversidad-repo.html',
  styleUrl: './tabla-diversidad-repo.scss',
})
export class TablaDiversidadRepo  implements OnChanges {
  @Input() datos: DiversidadRepo[] = [];
  
  columnasMostrar: string[] = ['repo', 'comentarios', 'adjetivos', 'entropia', 'ttr'];
  dataSource = new MatTableDataSource<DiversidadRepo>();

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
}
