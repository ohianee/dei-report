import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { baseURL, chatURL } from '../compartido/baseurl';
import { ProcesaHTTPMsjService } from './processa-httpmsj';
import { RepoConfig } from '../compartido/repo-config';
import { InformeDEI, EstadoJob, AnalisisEnCursoError } from '../compartido/informe-dei';
import { ChatRequest } from '../compartido/chat';
import { Autenticar } from './autenticar';
import { SesionAnonima } from './sesion-anonima';

@Injectable({
  providedIn: 'root'
})
export class Analisis {
  constructor(
    private http: HttpClient, 
    private procesaHTTPMsj: ProcesaHTTPMsjService,
    private autenticar: Autenticar,
    private sesionAnonima: SesionAnonima
  ) {}

  lanzarAnalisis(config: RepoConfig): Observable<{job_id: string}> {
    return this.http.post<{job_id: string}>(`${baseURL}analizar`, config)
      .pipe(catchError(error => this.gestionErrorLanzamiento(error)));
  }

  private gestionErrorLanzamiento(error: HttpErrorResponse) {
    if (error.status === 409 && error.error?.detail?.job_id) {
      const errorTipado: AnalisisEnCursoError = {
        tipo: 'analisis_en_curso',
        jobIdExistente: error.error.detail.job_id,
        mensaje: error.error.detail.mensaje || 'Ya hay un análisis en curso para este objetivo.'
      };
      return throwError(() => errorTipado);
    }
    return this.procesaHTTPMsj.gestionError(error);
  }

  getEstado(jobId: string): Observable<EstadoJob> {
    return this.http.get<EstadoJob>(`${baseURL}analizar/${jobId}/estado`)
      .pipe(catchError(this.procesaHTTPMsj.gestionError));
  }

  getInforme(jobId: string): Observable<InformeDEI> {
    return this.http.get<InformeDEI>(`${baseURL}informe/${jobId}`)
      .pipe(catchError(this.procesaHTTPMsj.gestionError));
  }

  getHistorico(): Observable<any[]> {
    return this.http.get<any[]>(`${baseURL}historico`)
      .pipe(catchError(this.procesaHTTPMsj.gestionError));
  }

  borrarInforme(jobId: string): Observable<any> {
    return this.http.delete(`${baseURL}historico/${jobId}`)
      .pipe(catchError(this.procesaHTTPMsj.gestionError));
  }

  comprobarEstadoChat(): Observable<boolean> {
    return this.http.get(`${chatURL}chat/status`).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  enviarMensajeChatStream(jobId: string, request: ChatRequest): Observable<string> {
    return new Observable<string>(subscriber => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const usuario = this.autenticar.getUsuarioLogueado();
      if (usuario && usuario.user) {
        headers['X-Usuario'] = usuario.user;
      } else {
        const sesionId = this.sesionAnonima.obtenerId();
        if (sesionId) {
          headers['X-Session-Id'] = sesionId;
        }
      }

      const controller = new AbortController();

      fetch(`${chatURL}chat/${jobId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal
      }).then(async respuesta => {
        if (!respuesta.ok || !respuesta.body) {
          throw new Error(`Error HTTP ${respuesta.status}`);
        }
        const lector = respuesta.body.getReader();
        const decodificador = new TextDecoder('utf-8');

        while (true) {
          const { done, value } = await lector.read();
          if (done) break;
          const fragmento = decodificador.decode(value, { stream: true });
          if (fragmento) {
            subscriber.next(fragmento);
          }
        }
        subscriber.complete();
      }).catch(error => subscriber.error(error));

      return () => controller.abort();
    });
  }
}