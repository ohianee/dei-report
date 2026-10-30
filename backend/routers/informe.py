"""
Endpoints relacionados con los informes DEI: lanzar un análisis,
consultar su estado, obtener el informe resultante, listar el histórico
y borrar un informe.
"""
import asyncio
import uuid

from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session

from analisis.pool_procesos import obtener_pool_analisis
from database import get_db
from modelos.orm import JobRecord
from modelos.schemas import RepoConfig, EstadoJob, InformeDEI, JobIdResponse, HistoricoItem, MensajeEliminacion
from modelos.orm import UsuarioBase
from servicios.informe_servicio import (
    limpiar_sesiones_anonimas_antiguas,
    ejecutar_analisis_real,
    resolver_propietario,
    verificar_propiedad,
    calcular_clave_objetivo,
    buscar_analisis_en_curso,
)

router = APIRouter(tags=["informe"])
_DESC_AUTENTICACION = (
    "El llamante debe identificarse con la cabecera `X-Usuario` (usuario ya "
    "logueado) o `X-Session-Id` (sesión anónima). Si no coincide con el "
    "propietario del informe, se devuelve 404 para no filtrar su existencia."
)

@router.post(
    "/analizar",
    response_model=JobIdResponse,
    summary="Lanzar un nuevo análisis DEI",
    description=(
        "Encola en segundo plano el análisis de uno o varios repositorios "
        "(modo `lista`) o de todos los repositorios de una organización "
        "(modo `organizacion`) y devuelve un `job_id` para seguir su progreso "
        "con `/analizar/{job_id}/estado`.\n\n"
        "Requiere identificar al llamante con `X-Usuario` (usuario logueado) "
        "o, si no ha iniciado sesión, con `X-Session-Id`."
    ),
    responses={
        400: {"description": "Falta identificador de sesión"},
        401: {"description": "Usuario inválido"},
        409: {"description": "Ya hay un análisis en curso para el mismo objetivo (misma organización o misma lista de repos); se devuelve el `job_id` del análisis existente"},
    },
)
async def lanzar_analisis(config: RepoConfig,
        x_usuario: str = Header(None), x_session_id: str = Header(None), db: Session = Depends(get_db)):

    limpiar_sesiones_anonimas_antiguas(db)
    usuario_id = None
    if x_usuario:
        usuario_db = db.query(UsuarioBase).filter(UsuarioBase.username == x_usuario).first()
        if not usuario_db:
            raise HTTPException(status_code=401, detail="Usuario inválido")
        usuario_id = usuario_db.id
    elif not x_session_id:
        raise HTTPException(status_code=400, detail="Falta identificador de sesión")

    clave_objetivo = calcular_clave_objetivo(config)
    job_en_curso = buscar_analisis_en_curso(db, clave_objetivo, usuario_id, x_session_id)
    if job_en_curso:
        raise HTTPException(
            status_code=409,
            detail={
                "mensaje": "Ya hay un análisis en curso para este mismo objetivo.",
                "job_id": job_en_curso.job_id,
            },
        )

    nuevo_job_id = str(uuid.uuid4())
    objetivo_str = f"Org: {config.org}" if config.modo == "organizacion" else f"Lista: {len(config.repos)} repos"
    nuevo_job = JobRecord(
        job_id=nuevo_job_id,
        objetivo=objetivo_str,
        objetivo_clave=clave_objetivo,
        usuario_id=usuario_id,
        session_id=None if usuario_id else x_session_id,
    )
    db.add(nuevo_job)
    db.commit()
    pool = obtener_pool_analisis()

    asyncio.get_running_loop().run_in_executor(
        pool, ejecutar_analisis_real, nuevo_job_id, config, usuario_id
    )
    return {"job_id": nuevo_job_id}

@router.get(
    "/analizar/{job_id}/estado",
    response_model=EstadoJob,
    summary="Consultar el estado de un análisis",
    description="Devuelve el progreso (0-100) y el mensaje actual de la tarea en segundo plano. " + _DESC_AUTENTICACION,
    responses={404: {"description": "Análisis no encontrado o no pertenece al llamante"}},
)
async def obtener_estado(job_id: str, x_usuario: str = Header(None),
        x_session_id: str = Header(None), db: Session = Depends(get_db)):
    job = db.query(JobRecord).filter(JobRecord.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")

    usuario_id, session_id = resolver_propietario(x_usuario, x_session_id, db)
    verificar_propiedad(job, usuario_id, session_id)

    return EstadoJob(
        job_id=job.job_id,
        estado=job.estado,
        progreso=job.progreso,
        mensaje=job.mensaje
    )

@router.get(
    "/informe/{job_id}",
    response_model=InformeDEI,
    summary="Obtener el informe DEI completo",
    description=(
        "Devuelve el informe DEI generado (métricas globales, diversidad de "
        "autores/repos, lenguaje inclusivo en el código, hallazgos en "
        "comentarios y clima de comunicación) una vez que el análisis ha "
        "terminado. " + _DESC_AUTENTICACION
    ),
    responses={
        400: {"description": "El informe aún no está listo o falló"},
        404: {"description": "Análisis no encontrado o no pertenece al llamante"},
    },
)
async def obtener_informe(job_id: str, x_usuario: str = Header(None),
        x_session_id: str = Header(None), db: Session = Depends(get_db)):
    job = db.query(JobRecord).filter(JobRecord.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")

    usuario_id, session_id = resolver_propietario(x_usuario, x_session_id, db)
    verificar_propiedad(job, usuario_id, session_id)

    if job.estado != "completado" or not job.resultado:
        raise HTTPException(status_code=400, detail="El informe aún no está listo o falló")

    return job.resultado

@router.get(
    "/historico",
    response_model=list[HistoricoItem],
    summary="Listar el histórico de análisis",
    description=(
        "Devuelve los análisis (en cualquier estado) del usuario logueado o "
        "de la sesión anónima indicada, ordenados del más reciente al más "
        "antiguo. Si no se envía ninguna cabecera de identificación, "
        "devuelve una lista vacía."
    ),
)
async def obtener_historico(x_usuario: str = Header(None),
        x_session_id: str = Header(None), db: Session = Depends(get_db),):
    usuario_id, session_id = resolver_propietario(x_usuario, x_session_id, db)

    query = db.query(JobRecord)
    if usuario_id is not None:
        query = query.filter(JobRecord.usuario_id == usuario_id)
    elif session_id:
        query = query.filter(JobRecord.usuario_id.is_(None), JobRecord.session_id == session_id)
    else:
        return []

    jobs = query.order_by(JobRecord.fecha.desc()).all()
    lista_historico = []
    for job in jobs:
        fecha_str = job.fecha.isoformat()
        if not fecha_str.endswith('Z') and '+' not in fecha_str:
            fecha_str += 'Z'
        lista_historico.append({
            "job_id": job.job_id,
            "fecha": fecha_str,
            "objetivo": job.objetivo,
            "estado": job.estado
        })
    return lista_historico

@router.delete(
    "/historico/{job_id}",
    response_model=MensajeEliminacion,
    summary="Borrar un informe del histórico",
    description="Elimina de forma permanente un análisis y su informe asociado. " + _DESC_AUTENTICACION,
    responses={404: {"description": "Análisis no encontrado o no pertenece al llamante"}},
)
async def borrar_informe(job_id: str, x_usuario: str = Header(None),
        x_session_id: str = Header(None), db: Session = Depends(get_db)):
    job = db.query(JobRecord).filter(JobRecord.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")

    usuario_id, session_id = resolver_propietario(x_usuario, x_session_id, db)
    verificar_propiedad(job, usuario_id, session_id)

    db.delete(job)
    db.commit()
    return {"mensaje": f"Informe {job_id} eliminado correctamente"}