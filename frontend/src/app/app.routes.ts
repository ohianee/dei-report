import { Routes } from '@angular/router';
import { Inicio } from './components/inicio/inicio';
import { SeleccionRepos } from './components/seleccion-repos/seleccion-repos';
import { EstadoAnalisis } from './components/estado-analisis/estado-analisis';
import { InformeDei } from './components/informe-dei/informe-dei';
import { HistoricoInformes } from './components/historico-informes/historico-informes';

export const routes: Routes = [
  { path: 'inicio',  component: Inicio},
  { path: 'nuevo-analisis', component: SeleccionRepos },
  { path: 'estado-analisis/:job_id', component: EstadoAnalisis },
  { path: 'informe/:job_id', component: InformeDei },
  { path: 'historico', component: HistoricoInformes },
  { path: '', redirectTo: '/inicio', pathMatch: 'full' },
  { path: '**', redirectTo: '/inicio' }
];