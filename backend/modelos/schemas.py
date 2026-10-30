"""
Esquemas Pydantic (request/response) de la API.
Se agrupan por dominio: configuración y estado del análisis, contenido del
informe DEI, y usuario. Todos los campos documentados aquí aparecen tal cual
en `/docs` (OpenAPI), generado automáticamente por FastAPI.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
from typing import List

class RepoItem(BaseModel):
    """Un repositorio de GitHub identificado por su propietario y nombre."""
    owner: str = Field(..., description="Usuario u organización propietaria del repositorio en GitHub.")
    repo: str = Field(..., description="Nombre del repositorio.")

class RepoConfig(BaseModel):
    """Objetivo de un análisis: una lista de repos concretos o una organización entera."""
    modo: Literal['lista', 'organizacion'] = Field(..., description="'lista' analiza los repos indicados en `repos`; 'organizacion' analiza todos los repos públicos de `org`.")
    repos: Optional[List[RepoItem]] = Field(None, description="Repositorios a analizar. Requerido si `modo='lista'`.")
    org: Optional[str] = Field(None, description="Organización de GitHub a analizar. Requerido si `modo='organizacion'`.")

class EstadoJob(BaseModel):
    """Progreso de un análisis en segundo plano."""
    job_id: str
    estado: Literal['pendiente', 'procesando', 'completado', 'error'] = Field(..., description="Estado actual del análisis.")
    progreso: int = Field(..., ge=0, le=100, description="Porcentaje de avance (0-100).")
    mensaje: str = Field(..., description="Descripción legible de la fase actual, o del error si `estado='error'`.")

class DiversidadAutor(BaseModel):
    """Métricas de diversidad léxica de los comentarios de un autor concreto."""
    author: str
    n_comentarios: int
    n_adjetivos: int
    entropia: float
    simpson: float

class DiversidadRepo(BaseModel):
    """Métricas de diversidad léxica de los comentarios de un repositorio."""
    repo: str
    comentarios: int
    adjetivos: int
    adjetivos_unicos: int
    entropia: float
    simpson: float
    ttr: float

class MetricasGlobales(BaseModel):
    """Métricas de diversidad léxica agregadas de todos los comentarios analizados."""
    entropia_shannon: float
    indice_simpson: float
    ratio_unicos: float

class HallazgoLenguaje(BaseModel):
    """Un identificador del código (variable, función, clase...) con lenguaje no inclusivo."""
    repo: str
    path: str = Field(..., description="Ruta del archivo (o resumen de rutas si aparece en varios).")
    identificador: str
    termino: str = Field(..., description="Término no inclusivo detectado dentro del identificador.")
    severidad: Literal['high', 'medium', 'low'] = Field(..., description="Código de severidad; el frontend lo traduce vía i18n.")
    alternativas: str = Field(..., description="Alternativas inclusivas sugeridas.")
    ocurrencias: int

class HallazgoComentario(BaseModel):
    """Un comentario (issue/PR) marcado por lenguaje no inclusivo, tono negativo o toxicidad."""
    repo: str
    author: str
    tipo: Literal['non_inclusive', 'negative_tone', 'toxicity'] = Field(..., description="Código de tipo de hallazgo; el frontend lo traduce vía i18n.")
    termino: str
    categoria: str = Field(..., description="Código de categoría (p.ej. 'ableism', 'gender', 'toxicity_model'); el frontend lo traduce vía i18n.")
    severidad: Literal['high', 'medium', 'low'] = Field(..., description="Código de severidad; el frontend lo traduce vía i18n.")
    alternativas: str = Field(..., description="Para 'non_inclusive': lista de alternativas en inglés (no se traduce). Para 'negative_tone'/'toxicity': código de sugerencia que el frontend traduce vía i18n.")
    contexto: str = Field(..., description="Fragmento del comentario original donde aparece el hallazgo.")
    score: Optional[float] = Field(None, description="Score del modelo de toxicidad (0-1), solo presente cuando tipo='toxicity'.")

class ResumenArchivoLenguaje(BaseModel):
    """Resumen de hallazgos de lenguaje no inclusivo de un archivo de código concreto."""
    repo: str
    path: str
    n_identificadores: int
    n_hallazgos: int

class RepoLenguajeInclusivo(BaseModel):
    """Resumen del análisis de lenguaje inclusivo en el código de un repositorio."""
    repo: str
    archivosAnalizados: int
    identificadoresAnalizados: int
    hallazgos: int
    densidadPor1000Ids: float = Field(..., description="Hallazgos por cada 1000 identificadores analizados.")
    scoreInclusividad: float = Field(..., description="Puntuación de 0 a 100; a mayor puntuación, más inclusivo.")
    hallazgosPorCategoria: Dict[str, int]
    hallazgosPorSeveridad: Dict[str, int]

class LenguajeInclusivoCodigo(BaseModel):
    """Resultado completo del análisis de lenguaje inclusivo sobre el código fuente."""
    scoreGlobal: float
    identificadoresAnalizados: int
    hallazgosPorCategoria: Dict[str, int]
    terminosMasFrecuentes: Dict[str, int]
    resumenRepos: List[RepoLenguajeInclusivo]
    resumenArchivos: List[ResumenArchivoLenguaje]
    hallazgos: List[HallazgoLenguaje]

class ClimaComunicacion(BaseModel):
    """Resumen de sentimiento/toxicidad de los comentarios analizados."""
    comentariosAnalizados: int
    porcentajePositivos: float
    porcentajeNegativos: float
    porcentajeNeutros: float
    comentariosToxicos: int
    porcentajeToxicos: float

class InformeDEI(BaseModel):
    """Informe DEI completo generado a partir de un análisis."""
    job_id: str
    metricasGlobales: MetricasGlobales
    bigFive: Dict[str, int] = Field(..., description="Recuento de adjetivos asociados a cada rasgo del modelo Big Five.")
    tonoCodigo: Dict[str, int] = Field(..., description="Recuento de adjetivos por categoría de tono en comentarios de código.")
    diversidadAutores: List[DiversidadAutor]
    diversidadRepos: List[DiversidadRepo]
    lenguajeInclusivoCodigo: LenguajeInclusivoCodigo
    hallazgosComentarios: List[HallazgoComentario]
    climaComunicacion: ClimaComunicacion

class UsuarioLogin(BaseModel):
    """Credenciales para login, registro o borrado/confirmación de cuenta."""
    user: str = Field(..., description="Nombre de usuario.")
    contrasenya: str = Field(..., description="Contraseña en texto plano.")
    nocerrar: bool = Field(False, description="Si es true, la sesión se recuerda entre reinicios del navegador (localStorage); si es false, dura solo la pestaña/ventana actual.")

class UsuarioResponse(BaseModel):
    """Respuesta tras un login correcto."""
    user: str
    nocerrar: bool = False

class UsuarioPerfil(BaseModel):
    """Datos públicos del usuario autenticado (sin contraseña)."""
    user: str = Field(..., description="Nombre de usuario.")
    n_informes: int = Field(..., description="Número de análisis asociados a esta cuenta.")
    github_conectado: bool = Field(False, description="True si el usuario ha vinculado su cuenta de GitHub vía OAuth.")
    github_login: Optional[str] = Field(None, description="Login de GitHub vinculado, si `github_conectado` es true.")

class RepoGithubDisponible(BaseModel):
    """Un repositorio real al que el usuario tiene acceso en GitHub (con su token propio)."""
    owner: str = Field(..., description="Usuario u organización propietaria del repositorio.")
    repo: str = Field(..., description="Nombre del repositorio.")
    privado: bool = Field(..., description="True si es un repositorio privado (solo visible gracias al token del usuario).")
    descripcion: Optional[str] = Field(None, description="Descripción corta del repositorio, si tiene.")

class OrgGithubDisponible(BaseModel):
    """Una organización de GitHub a la que pertenece el usuario (con su token propio)."""
    login: str = Field(..., description="Nombre/login de la organización.")
    descripcion: Optional[str] = Field(None, description="Descripción corta de la organización, si tiene.")

class UsuarioActualizar(BaseModel):
    """Cambio de contraseña: requiere la contraseña actual y la nueva."""
    contrasenya_actual: str = Field(..., description="Contraseña actual, para confirmar la identidad del usuario.")
    contrasenya_nueva: str = Field(..., min_length=1, description="Nueva contraseña a establecer.")

class MensajeSimple(BaseModel):
    """Respuesta genérica de confirmación con clave `msj`."""
    msj: str

class MensajeEliminacion(BaseModel):
    """Respuesta genérica de confirmación de borrado con clave `mensaje`."""
    mensaje: str

class JobIdResponse(BaseModel):
    """Identificador del análisis recién lanzado, para seguir su progreso."""
    job_id: str

class HistoricoItem(BaseModel):
    """Entrada del histórico de análisis (sin el informe completo)."""
    job_id: str
    fecha: str
    objetivo: str
    estado: Literal['pendiente', 'procesando', 'completado', 'error']

class MensajeChat(BaseModel):
    """Representa un mensaje individual en el historial del chat."""
    role: Literal['user', 'assistant', 'system'] = Field(..., description="Rol del emisor del mensaje.")
    content: str = Field(..., description="Contenido del mensaje.")

class ChatRequest(BaseModel):
    """Petición del frontend para hablar con el agente."""
    mensaje: str = Field(..., description="El nuevo mensaje que envía el usuario.")
    historial: List[MensajeChat] = Field(default_factory=list, description="Historial de la conversación para dar contexto.")

class ChatResponse(BaseModel):
    """Respuesta generada por el agente de IA."""
    respuesta: str