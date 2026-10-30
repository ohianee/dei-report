import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule } from '@angular/material/sort';
import { DecimalPipe } from '@angular/common';
import { RepoLenguajeInclusivo } from '../../compartido/informe-dei';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-tabla-lenguaje-repo',
  imports: [MatCardModule, MatPaginatorModule, MatTableModule, DecimalPipe,
    MatIconModule, MatSortModule, MatChipsModule, TranslatePipe],
  templateUrl: './tabla-lenguaje-repo.html',
  styleUrl: './tabla-lenguaje-repo.scss',
})
export class TablaLenguajeRepo implements OnChanges {
  @Input() datos: RepoLenguajeInclusivo[] = [];

  columnasMostrar: string[] = ['repo', 'archivosAnalizados', 'hallazgos', 'densidadPor1000Ids', 'scoreInclusividad'];
  dataSource = new MatTableDataSource<RepoLenguajeInclusivo>();

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

  claseScore(score: number): string {
    if (score >= 90) return 'score-bien';
    if (score >= 70) return 'score-medio';
    return 'score-mal';
  }
}
