import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Analisis } from '../../services/analisis';
import { Autenticar } from '../../services/autenticar';
import { AnalisisEnCursoError } from '../../compartido/informe-dei';
import { RepoConfig } from '../../compartido/repo-config';
import { RepoGithubDisponible, OrgGithubDisponible } from '../../compartido/usuario';
import { PerfilUsuario } from '../perfil-usuario/perfil-usuario';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-seleccion-repos',
  imports: [MatCardModule, MatRadioModule, MatFormFieldModule, MatIconModule, 
    ReactiveFormsModule, MatInputModule, MatButtonModule, MatTooltipModule,
    MatAutocompleteModule, TranslatePipe],
  templateUrl: './seleccion-repos.html',
  styleUrl: './seleccion-repos.scss',
})
export class SeleccionRepos implements OnInit {
  private fb = inject(FormBuilder);
  private analisisService = inject(Analisis);
  private authService = inject(Autenticar);
  private router = inject(Router);
  private dialogo = inject(MatDialog);
  
  cargando = false;
  errorMsj = '';
  githubConectado = signal(false);
  cargandoGithub = signal(false);
  reposPropios = signal<RepoGithubDisponible[]>([]);
  orgsPropias = signal<OrgGithubDisponible[]>([]);

  repoForm = this.fb.group({
    modo: ['organizacion', Validators.required],
    org: ['', Validators.required],
    repos: this.fb.array([])
  });

  constructor() {
    this.repoForm.controls.modo.valueChanges.subscribe(modo => {
        if (modo === 'lista') {
          this.repoForm.controls.org.clearValidators();
          if (this.repos.length === 0) {
            this.addRepo();
          }
        } else {
          this.repoForm.controls.org.setValidators([Validators.required]);
        }
        this.repoForm.controls.org.updateValueAndValidity();
      });
  }

  ngOnInit() {
    if (!this.authService.estaAutenticado()) return;
    this.cargandoGithub.set(true);
    this.authService.obtenerPerfil().subscribe({
      next: perfil => {
        this.githubConectado.set(perfil.github_conectado);
        if (!perfil.github_conectado) {
          this.cargandoGithub.set(false);
          return;
        }
        this.authService.listarReposGithub().subscribe({
          next: repos => this.reposPropios.set(repos),
          error: () => this.reposPropios.set([])
        });
        this.authService.listarOrgsGithub().subscribe({
          next: orgs => { this.orgsPropias.set(orgs); this.cargandoGithub.set(false); },
          error: () => this.cargandoGithub.set(false)
        });
      },
      error: () => this.cargandoGithub.set(false)
    });
  }

  get estaLogueado(): boolean { return this.authService.estaAutenticado(); }
  get modo() { return this.repoForm.controls.modo.value; }
  get repos(): FormArray { return this.repoForm.controls.repos; }

  addRepo() {
    this.repos.push(this.fb.group({
        owner: ['', Validators.required],
        repo: ['', Validators.required]
      })
    );
  }

  removeRepo(index: number) {
    this.repos.removeAt(index);
  }

  reposFiltrados(index: number): RepoGithubDisponible[] {
    const grupo = this.repos.at(index) as FormGroup;
    const owner = (grupo.get('owner')?.value || '').toLowerCase();
    const repo = (grupo.get('repo')?.value || '').toLowerCase();
    return this.reposPropios().filter(r =>
      r.owner.toLowerCase().includes(owner) && r.repo.toLowerCase().includes(repo)
    ).slice(0, 25);
  }

  seleccionarRepoPropio(index: number, seleccionado: RepoGithubDisponible) {
    const grupo = this.repos.at(index) as FormGroup;
    grupo.patchValue({ owner: seleccionado.owner, repo: seleccionado.repo });
  }

  abrirPerfilParaVincular() {
    if (this.dialogo.openDialogs.length > 0) return;
    this.dialogo.open(PerfilUsuario, {
      width: '550px',
      panelClass: 'custom-dialog-container',
      disableClose: false
    });
  }

  orgsFiltradas(): OrgGithubDisponible[] {
    const texto = (this.repoForm.controls.org.value || '').toLowerCase();
    return this.orgsPropias().filter(o => o.login.toLowerCase().includes(texto)).slice(0, 25);
  }

  onSubmit() {
    if (this.repoForm.invalid) return;
    this.cargando = true;
    this.errorMsj = '';
    const config = {...this.repoForm.value} as RepoConfig;

    if (config.modo === 'organizacion') delete config.repos;
    if (config.modo === 'lista') delete config.org;

    this.analisisService.lanzarAnalisis(config).subscribe({
        next: ({ job_id }) => {
          this.router.navigate(['/estado-analisis', job_id]);
        },
        error: (err: AnalisisEnCursoError | string) => {
          if (typeof err === 'object' && err.tipo === 'analisis_en_curso') {
            this.router.navigate(['/estado-analisis', err.jobIdExistente]);
            return;
          }
          this.errorMsj = err as string;
          this.cargando = false;
        }
      });
  }
}