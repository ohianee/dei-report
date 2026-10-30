export interface Usuario {
  id?: number;
  user: string;
  contrasenya: string;
  nocerrar?: boolean; 
}

export interface UsuarioPerfil {
  user: string;
  n_informes: number;
  github_conectado: boolean;
  github_login?: string;
}

export interface UsuarioActualizar {
  contrasenya_actual: string;
  contrasenya_nueva: string;
}

export interface RepoGithubDisponible {
  owner: string;
  repo: string;
  privado: boolean;
  descripcion?: string;
}

export interface OrgGithubDisponible {
  login: string;
  descripcion?: string;
}