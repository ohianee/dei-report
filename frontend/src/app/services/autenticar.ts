import { Injectable, Inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Usuario, UsuarioActualizar,  UsuarioPerfil, RepoGithubDisponible, OrgGithubDisponible } from '../compartido/usuario';
import { baseURL } from '../compartido/baseurl';
import { ProcesaHTTPMsjService } from './processa-httpmsj';

@Injectable({
  providedIn: 'root'
})
export class Autenticar {
  usuarioLogueado = signal<Usuario | undefined>(undefined);

  constructor(
    private http: HttpClient,
    private procesaHTTPMsjService: ProcesaHTTPMsjService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { 
    this.cargarUsuarioDeStorage();

    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('storage', evento => {
        if (evento.key === 'usuario') {
          this.usuarioLogueado.set(evento.newValue ? JSON.parse(evento.newValue) : undefined);
        }
        if (evento.key === 'pedir_sesion') {
          const userSession = sessionStorage.getItem('usuario');
          if (userSession) {
            localStorage.setItem('transferir_sesion', userSession);
            localStorage.removeItem('transferir_sesion');
          }
        }

        if (evento.key === 'transferir_sesion' && evento.newValue) {
          const userSession = evento.newValue;
          sessionStorage.setItem('usuario', userSession);
          this.usuarioLogueado.set(JSON.parse(userSession));
        }
        
        if (evento.key === 'cerrar_sesion_global') {
          sessionStorage.removeItem('usuario');
          this.usuarioLogueado.set(undefined);
        }
      });

      if (!this.usuarioLogueado()) {
        localStorage.setItem('pedir_sesion', Date.now().toString());
        localStorage.removeItem('pedir_sesion');
      }
    }
  }

  login(usuario: Usuario): Observable<Usuario> {
    return this.http.post<Usuario>(baseURL + 'login', usuario).pipe(
      map(usuarioDevuelto => {
        this.guardarSesion(usuarioDevuelto);
        return usuarioDevuelto;
      }),
      catchError(error => {
        return this.procesaHTTPMsjService.gestionError(error);
      })
    );
  }

  registro(usuario: Usuario): Observable<{ msj: string }> {
    return this.http.post<{ msj: string }>(baseURL + 'registro', usuario).pipe(
      catchError(error => {
        return this.procesaHTTPMsjService.gestionError(error);
      })
    );
  }

  cerrarSesion(): void {
    this.usuarioLogueado.set(undefined);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('usuario');
      sessionStorage.removeItem('usuario');
      localStorage.setItem('cerrar_sesion_global', Date.now().toString());
      localStorage.removeItem('cerrar_sesion_global');
    }
  }

  getUsuarioLogueado(): Usuario | undefined {
    return this.usuarioLogueado();
  }

  estaAutenticado(): boolean {
    return this.usuarioLogueado() !== undefined;
  }

  private guardarSesion(usuario: Usuario): void {
    this.usuarioLogueado.set(usuario);
    if (isPlatformBrowser(this.platformId)) {
      const data = JSON.stringify(usuario);
      if (usuario.nocerrar) {
        localStorage.setItem('usuario', data);
      } else {
        sessionStorage.setItem('usuario', data);
      }
    }
  }

  private cargarUsuarioDeStorage(): void {
    if (isPlatformBrowser(this.platformId)) {
      let uStorage = sessionStorage.getItem('usuario');
      if (!uStorage) {
        uStorage = localStorage.getItem('usuario');
      }
      if (uStorage) {
        this.usuarioLogueado.set(JSON.parse(uStorage));
      }
    }
  }

  obtenerPerfil(): Observable<UsuarioPerfil> {
    return this.http.get<UsuarioPerfil>(baseURL + 'usuario').pipe(
      catchError(error => {
        return this.procesaHTTPMsjService.gestionError(error);
      })
    );
  }

  actualizarPassword(datos: UsuarioActualizar): Observable<{ msj: string }> {
    return this.http.put<{ msj: string }>(baseURL + 'usuario', datos).pipe(
      catchError(error => {
        return this.procesaHTTPMsjService.gestionError(error);
      })
    );
  }

  conectarGithub(): void {
    const usuario = this.getUsuarioLogueado();
    if (!isPlatformBrowser(this.platformId) || !usuario) return;
    window.location.href = `${baseURL}auth/github/login?x_usuario=${encodeURIComponent(usuario.user)}`;
  }

  desconectarGithub(): Observable<{ msj: string }> {
    return this.http.delete<{ msj: string }>(baseURL + 'auth/github').pipe(
      catchError(error => {
        return this.procesaHTTPMsjService.gestionError(error);
      })
    );
  }

  listarReposGithub(): Observable<RepoGithubDisponible[]> {
    return this.http.get<RepoGithubDisponible[]>(baseURL + 'github/repos').pipe(
      catchError(error => this.procesaHTTPMsjService.gestionError(error))
    );
  }

  listarOrgsGithub(): Observable<OrgGithubDisponible[]> {
    return this.http.get<OrgGithubDisponible[]>(baseURL + 'github/orgs').pipe(
      catchError(error => this.procesaHTTPMsjService.gestionError(error))
    );
  }

  borrarCuenta(credenciales: Usuario): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(baseURL + 'usuario', { body: credenciales }).pipe(
      catchError(error => {
        return this.procesaHTTPMsjService.gestionError(error);
      })
    );
  }
}