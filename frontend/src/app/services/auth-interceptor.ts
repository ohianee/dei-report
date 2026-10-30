import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Autenticar } from './autenticar';
import { SesionAnonima } from './sesion-anonima';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(Autenticar);
  const sesionAnonimaService = inject(SesionAnonima);
  const usuario = authService.getUsuarioLogueado();
  const headers: Record<string, string> = {};

  if (usuario && usuario.user) {
    headers['X-Usuario'] = usuario.user;
  } else {
    const sesionId = sesionAnonimaService.obtenerId();
    if (sesionId) {
      headers['X-Session-Id'] = sesionId;
    }
  }

  if (Object.keys(headers).length === 0) {
    return next(req);
  }

  return next(req.clone({ setHeaders: headers }));
};