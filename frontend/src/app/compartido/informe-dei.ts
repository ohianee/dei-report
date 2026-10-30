export interface EstadoJob {
  job_id: string;
  estado: 'pendiente' | 'procesando' | 'completado' | 'error';
  progreso: number;
  mensaje: string;
}

export interface DiversidadAutor {
  author: string;
  n_comentarios: number;
  n_adjetivos: number;
  entropia: number;
  simpson: number;
}

export interface DiversidadRepo {
  repo: string;
  comentarios: number;
  adjetivos: number;
  adjetivos_unicos: number;
  entropia: number;
  simpson: number;
  ttr: number;
}

export interface HallazgoLenguaje {
  repo: string;
  path: string;
  identificador: string;
  termino: string;
  severidad: 'high' | 'medium' | 'low';
  alternativas: string;
  ocurrencias?: number;
}

export interface HallazgoComentario {
  repo: string;
  author: string;
  tipo: 'non_inclusive' | 'negative_tone' | 'toxicity';
  termino: string;
  categoria: string;
  severidad: 'high' | 'medium' | 'low';
  alternativas: string;
  contexto: string;
  score?: number;
}

export interface ClimaComunicacion {
  comentariosAnalizados: number;
  porcentajePositivos: number;
  porcentajeNegativos: number;
  porcentajeNeutros: number;
  comentariosToxicos: number;
  porcentajeToxicos: number;
}

export interface ResumenArchivoLenguaje {
  repo: string;
  path: string;
  n_identificadores: number;
  n_hallazgos: number;
}

export interface RepoLenguajeInclusivo {
  repo: string;
  archivosAnalizados: number;
  identificadoresAnalizados: number;
  hallazgos: number;
  densidadPor1000Ids: number;
  scoreInclusividad: number;
  hallazgosPorCategoria: { [categoria: string]: number };
  hallazgosPorSeveridad: { [severidad: string]: number };
}

export interface LenguajeInclusivoCodigo {
  scoreGlobal: number;
  identificadoresAnalizados: number;
  hallazgosPorCategoria: { [categoria: string]: number };
  terminosMasFrecuentes: { [termino: string]: number };
  resumenRepos: RepoLenguajeInclusivo[];
  resumenArchivos: ResumenArchivoLenguaje[];
  hallazgos: HallazgoLenguaje[];
}

export interface InformeDEI {
  job_id: string;
  metricasGlobales: {
    entropia_shannon: number;
    indice_simpson: number;
    ratio_unicos: number;
  };
  bigFive: { [rasgo: string]: number };
  tonoCodigo: { [categoria: string]: number };
  diversidadAutores: DiversidadAutor[];
  diversidadRepos: DiversidadRepo[];
  lenguajeInclusivoCodigo: LenguajeInclusivoCodigo;
  hallazgosComentarios: HallazgoComentario[];
  climaComunicacion: ClimaComunicacion;
}

export interface AnalisisEnCursoError {
  tipo: 'analisis_en_curso';
  jobIdExistente: string;
  mensaje: string;
}