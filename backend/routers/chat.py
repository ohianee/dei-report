import json
from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from modelos.orm import JobRecord
from modelos.schemas import ChatRequest
from servicios.informe_servicio import resolver_propietario, verificar_propiedad
from analisis.llm_motor import generar_respuesta_stream

router = APIRouter(tags=["chat"])

@router.get("/chat/status", summary="Comprobar estado del servidor de chat")
def comprobar_estado():
    return {"status": "ok"}

@router.post(
    "/chat/{job_id}",
    summary="Chatear con el agente de IA sobre un informe DEI (respuesta en streaming)"
)
async def chatear_con_informe(job_id: str, peticion: ChatRequest, x_usuario: str = Header(None),
        x_session_id: str = Header(None), db: Session = Depends(get_db)):
    job = db.query(JobRecord).filter(JobRecord.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")

    usuario_id, session_id = resolver_propietario(x_usuario, x_session_id, db)
    verificar_propiedad(job, usuario_id, session_id)

    if job.estado != "completado" or not job.resultado:
        raise HTTPException(status_code=400, detail="El informe aún no está listo")

    resultado_reducido = {
        "metricasGlobales": job.resultado.get("metricasGlobales"),
        "climaComunicacion": job.resultado.get("climaComunicacion"),
        "bigFive": job.resultado.get("bigFive"),
        "top_hallazgos_lenguaje": job.resultado.get("lenguajeInclusivoCodigo", {}).get("hallazgos", [])[:10]
    }
    contexto_str = json.dumps(resultado_reducido, ensure_ascii=False)

    system_prompt = (
        "Eres un consultor experto en Diversidad, Equidad e Inclusión (DEI) para código de software. "
        "Ayudas al usuario a interpretar el informe de su proyecto. "
        "AQUÍ TIENES LOS DATOS DEL INFORME EN JSON:\n"
        f"{contexto_str}\n\n"
        "REGLAS ESTRICTAS:\n"
        "- Responde SOLO basándote en los datos del JSON proporcionado.\n"
        "- Sé claro, directo y usa un tono constructivo y profesional.\n"
        "- Si te preguntan algo que no está en el JSON, di que no tienes esa información."
    )

    generador = generar_respuesta_stream(
        prompt_sistema=system_prompt,
        historial=peticion.historial,
        nuevo_mensaje=peticion.mensaje
    )

    return StreamingResponse(generador, media_type="text/plain; charset=utf-8")