"""
Lógica de los informes DEI: ejecución del análisis en segundo plano, 
limpieza de sesiones anónimas antiguas, resolución/verificación de 
propiedad de un informe frente a usuario logueado o sesión anónima, y 
cálculo de la clave de objetivo usada para evitar lanzar dos veces el 
mismo análisis en paralelo.
"""
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
import pandas as pd
import requests
from fastapi import HTTPException
from sqlalchemy.orm import Session
from analisis.bert_motor import analizar_sentimiento_lote, seleccionar_indices_muestra
from analisis.github_fetcher import obtener_repos_org, descargar_datos_repos, crear_sesion_github
from analisis.hallazgos_comentarios import analizar_hallazgos_comentarios
from analisis.lenguaje_inclusivo import analizar_lenguaje_codigo
from analisis.nlp_motor import (
    extraer_adjetivos_lote, limpiar_texto, entropia_shannon,
    indice_simpson, BIG_FIVE_ADJECTIVES, CODE_TONE_ADJECTIVES
)
from cifrado import descifrar
from database import SessionLocal
from modelos.orm import UsuarioBase, JobRecord
from modelos.schemas import RepoConfig

def calcular_clave_objetivo(config: RepoConfig) -> str:
    """Clave que identifica de forma unívoca el objetivo de un análisis:
    la misma organización, o el mismo conjunto de repos (sin importar el
    orden en que se hayan introducido). Dos configuraciones con la misma
    clave se consideran "el mismo análisis" a efectos de no duplicar
    procesos en curso."""
    if config.modo == "organizacion":
        return f"org:{(config.org or '').strip().lower()}"
    repos_normalizados = sorted(f"{r.owner.strip().lower()}/{r.repo.strip().lower()}" for r in (config.repos or []))
    return "lista:" + ",".join(repos_normalizados)

def buscar_analisis_en_curso(db: Session, clave_objetivo: str, usuario_id, session_id) -> JobRecord | None:
    """Devuelve el job en curso (pendiente/procesando) del mismo propietario
    y mismo objetivo, si existe, para no lanzar dos veces el mismo análisis."""
    query = db.query(JobRecord).filter(
        JobRecord.objetivo_clave == clave_objetivo,
        JobRecord.estado.in_(["pendiente", "procesando"]),
    )
    if usuario_id is not None:
        query = query.filter(JobRecord.usuario_id == usuario_id)
    else:
        query = query.filter(JobRecord.usuario_id.is_(None), JobRecord.session_id == session_id)
    return query.first()

def limpiar_sesiones_anonimas_antiguas(db: Session):
    """Borra registros anónimos que tengan más de 24 horas de antigüedad."""
    limite_tiempo = datetime.now(timezone.utc) - timedelta(hours=24)
    db.query(JobRecord).filter(
        JobRecord.usuario_id.is_(None),
        JobRecord.fecha < limite_tiempo
    ).delete()
    db.commit()

def resolver_token_github_usuario(db: Session, usuario_id) -> str | None:
    """Devuelve el token de GitHub personal del usuario (descifrado) si lo
    ha vinculado vía OAuth, o None si no ha iniciado sesión o no lo ha
    conectado (en cuyo caso el análisis usará el token compartido de la app)."""
    if usuario_id is None:
        return None
    usuario = db.query(UsuarioBase).filter(UsuarioBase.id == usuario_id).first()
    if not usuario or not usuario.github_token_cifrado:
        return None
    return descifrar(usuario.github_token_cifrado)

def ejecutar_analisis_real(job_id: str, config: RepoConfig, usuario_id=None):
    inicio_tiempo = time.perf_counter()
    db = SessionLocal()
    job = db.query(JobRecord).filter(JobRecord.job_id == job_id).first()

    try:
        job.mensaje = "RESOLVING_REPOS"
        db.commit()

        token_usuario = resolver_token_github_usuario(db, usuario_id)
        sesion_http = crear_sesion_github(token_usuario)

        if token_usuario:
            try:
                who = sesion_http.get("https://api.github.com/user", timeout=10)
                login = who.json().get("login") if who.status_code == 200 else f"error {who.status_code}"
            except requests.RequestException:
                login = "error de red"
            print(f"[informe_servicio] Job {job_id}: usando TOKEN PERSONAL (github login: {login})", flush=True)
        else:
            print(f"[informe_servicio] Job {job_id}: usando TOKEN COMPARTIDO de la app (usuario_id={usuario_id})", flush=True)

        repos_a_analizar = (
            [repo.model_dump() for repo in config.repos]
            if config.modo == "lista"
            else obtener_repos_org(config.org, sesion_http=sesion_http)
        )
        if not repos_a_analizar:
            raise Exception("No se encontraron repositorios para analizar.")

        job.progreso = 10
        job.mensaje = f"DOWNLOADING_START|{len(repos_a_analizar)}"
        db.commit()

        def _actualizar_progreso_descarga(completados, total, resultado_repo):
            job.mensaje = f"DOWNLOADING_PROGRESS|{resultado_repo['owner']}/{resultado_repo['repo']}|{completados}|{total}"
            job.progreso = 10 + int((completados / total) * 30)
            db.commit()

        datos_repos = descargar_datos_repos(
            repos_a_analizar,
            max_workers=6,
            max_pages_comentarios=2,
            callback_progreso=_actualizar_progreso_descarga,
            sesion_http=sesion_http,
        )

        todos_los_comentarios = [c for r in datos_repos for c in r["comentarios"]]
        archivos_codigo = [c for r in datos_repos for c in r["codigo"]]

        if not todos_los_comentarios and not archivos_codigo:
            raise Exception("No se encontraron ni comentarios ni código fuente en los repositorios dados.")

        hay_comentarios = bool(todos_los_comentarios)

        job.mensaje = "PROCESSING_NLP"
        job.progreso = 45
        db.commit()

        if hay_comentarios:
            df = pd.DataFrame(todos_los_comentarios)
            df["clean_body"] = df["body"].apply(limpiar_texto)
            df = df[df["clean_body"].str.split().str.len() > 2].reset_index(drop=True)
            df["adjetivos"] = extraer_adjetivos_lote(df["clean_body"].tolist())

            job.progreso = 50
            job.mensaje = "CALCULATING_METRICS"
            db.commit()

            todos_adjetivos = [adj for lista in df["adjetivos"] for adj in lista]
            frecuencia_global = Counter(todos_adjetivos)

            entropia_global = entropia_shannon(frecuencia_global)
            simpson_global = indice_simpson(frecuencia_global)
            ratio_unicos = len(frecuencia_global) / max(sum(frecuencia_global.values()), 1)

            rasgos_totales = {rasgo: 0 for rasgo in BIG_FIVE_ADJECTIVES}
            tono_totales = {categoria: 0 for categoria in CODE_TONE_ADJECTIVES}

            for adj in todos_adjetivos:
                for rasgo, palabras in BIG_FIVE_ADJECTIVES.items():
                    if adj in palabras: rasgos_totales[rasgo] += 1
                for categoria, palabras in CODE_TONE_ADJECTIVES.items():
                    if adj in palabras: tono_totales[categoria] += 1

            div_autores = []
            for autor, grupo in df.groupby("author"):
                if len(grupo) > 2:
                    adjs = [a for lista in grupo["adjetivos"] for a in lista]
                    freq = Counter(adjs)
                    div_autores.append({
                        "author": autor,
                        "n_comentarios": len(grupo),
                        "n_adjetivos": len(adjs),
                        "entropia": entropia_shannon(freq),
                        "simpson": indice_simpson(freq)
                    })

            div_repos = []
            for repo, grupo in df.groupby("repo"):
                adjs = [a for lista in grupo["adjetivos"] for a in lista]
                freq = Counter(adjs)
                div_repos.append({
                    "repo": repo,
                    "comentarios": len(grupo),
                    "adjetivos": len(adjs),
                    "adjetivos_unicos": len(freq),
                    "entropia": entropia_shannon(freq),
                    "simpson": indice_simpson(freq),
                    "ttr": len(freq) / max(sum(freq.values()), 1)
                })
        else:
            entropia_global = 0.0
            simpson_global = 0.0
            ratio_unicos = 0.0
            rasgos_totales = {rasgo: 0 for rasgo in BIG_FIVE_ADJECTIVES}
            tono_totales = {categoria: 0 for categoria in CODE_TONE_ADJECTIVES}
            div_autores = []
            div_repos = []

        job.mensaje = "ANALYZING_INCLUSIVE_LANG"
        job.progreso = 60
        db.commit()

        resultado_lenguaje = analizar_lenguaje_codigo(archivos_codigo)
        hallazgos_brutos = resultado_lenguaje.get("hallazgos", [])
        agrupacion = {}

        for h in hallazgos_brutos:
            clave = (h["repo"], h["identificador"], h["termino"])

            if clave not in agrupacion:
                agrupacion[clave] = {
                    "repo": h["repo"],
                    "identificador": h["identificador"],
                    "termino": h["termino"],
                    "severidad": h["severidad"],
                    "alternativas": h["alternativas"],
                    "paths_unicos": set(),
                    "ocurrencias": 0
                }

            agrupacion[clave]["paths_unicos"].add(h["path"])
            agrupacion[clave]["ocurrencias"] += 1

        hallazgos_agrupados = []
        for grupo in agrupacion.values():
            paths = list(grupo["paths_unicos"])

            if len(paths) == 1:
                path_str = paths[0]
            elif len(paths) <= 2:
                path_str = ", ".join(paths)
            else:
                path_str = f"{paths[0]} (+{len(paths)-1} archivos)"

            hallazgos_agrupados.append({
                "repo": grupo["repo"],
                "path": path_str,
                "identificador": grupo["identificador"],
                "termino": grupo["termino"],
                "severidad": grupo["severidad"],
                "alternativas": grupo["alternativas"],
                "ocurrencias": grupo["ocurrencias"]
            })
        hallazgos_agrupados.sort(key=lambda x: x["ocurrencias"], reverse=True)

        LIMITE_HALLAZGOS_POR_REPO = 100
        hallazgos_por_repo: dict[str, list] = {}
        for h in hallazgos_agrupados:
            hallazgos_por_repo.setdefault(h["repo"], []).append(h)

        hallazgos_finales = []
        for repo, lista_repo in hallazgos_por_repo.items():
            hallazgos_finales.extend(lista_repo[:LIMITE_HALLAZGOS_POR_REPO])
        hallazgos_finales.sort(key=lambda x: x["ocurrencias"], reverse=True)

        job.mensaje = "ANALYZING_TONE_BERT"
        job.progreso = 75
        db.commit()

        if hay_comentarios:
            cuerpos = [c.get("body", "") for c in todos_los_comentarios]
            indices_muestra = seleccionar_indices_muestra(len(cuerpos))
            set_muestra = set(indices_muestra)
            cuerpos_para_bert = [c if i in set_muestra else "" for i, c in enumerate(cuerpos)]
            sentimientos = analizar_sentimiento_lote(cuerpos_para_bert)
            sentimientos_analizados = [sentimientos[i] for i in indices_muestra]

            n_positivos = sum(1 for s in sentimientos_analizados if s["label"] == "POSITIVE")
            n_negativos = sum(1 for s in sentimientos_analizados if s["label"] == "NEGATIVE")
            n_neutros = len(sentimientos_analizados) - n_positivos - n_negativos
            total_sentimientos = max(len(sentimientos_analizados), 1)

            job.mensaje = "ANALYZING_COMMENTS"
            job.progreso = 90
            db.commit()
            hallazgos_en_comentarios = analizar_hallazgos_comentarios(
                todos_los_comentarios, usar_bert=True, sentimientos=sentimientos
            )
            orden_sev = {"high": 0, "medium": 1, "low": 2}
            hallazgos_en_comentarios.sort(key=lambda x: orden_sev.get(x["severidad"], 3))

            n_toxicos_bert = sum(1 for h in hallazgos_en_comentarios if h["tipo"] == "toxicity")
            clima_comunicacion = {
                "comentariosAnalizados": len(sentimientos_analizados),
                "porcentajePositivos": round(n_positivos / total_sentimientos * 100, 1),
                "porcentajeNegativos": round(n_negativos / total_sentimientos * 100, 1),
                "porcentajeNeutros": round(n_neutros / total_sentimientos * 100, 1),
                "comentariosToxicos": n_toxicos_bert,
                "porcentajeToxicos": round(n_toxicos_bert / total_sentimientos * 100, 1),
            }
        else:
            job.mensaje = "ANALYZING_COMMENTS"
            job.progreso = 90
            db.commit()
            hallazgos_en_comentarios = []
            clima_comunicacion = {
                "comentariosAnalizados": 0,
                "porcentajePositivos": 0,
                "porcentajeNegativos": 0,
                "porcentajeNeutros": 0,
                "comentariosToxicos": 0,
                "porcentajeToxicos": 0,
            }

        job.resultado = {
            "job_id": job_id,
            "metricasGlobales": {
                "entropia_shannon": entropia_global,
                "indice_simpson": simpson_global,
                "ratio_unicos": ratio_unicos
            },
            "bigFive": rasgos_totales,
            "tonoCodigo": tono_totales,
            "diversidadAutores": sorted(div_autores, key=lambda x: x["entropia"], reverse=True)[:50],
            "diversidadRepos": sorted(div_repos, key=lambda x: x["entropia"], reverse=True),
            "lenguajeInclusivoCodigo": {
                "scoreGlobal": resultado_lenguaje["scoreGlobal"],
                "identificadoresAnalizados": resultado_lenguaje["identificadoresAnalizados"],
                "hallazgosPorCategoria": resultado_lenguaje["hallazgosPorCategoria"],
                "terminosMasFrecuentes": resultado_lenguaje["terminosMasFrecuentes"],
                "resumenRepos": resultado_lenguaje["resumenRepos"],
                "resumenArchivos": resultado_lenguaje["resumenArchivos"][:500],
                "hallazgos": hallazgos_finales[:500],
            },
            "hallazgosComentarios": hallazgos_en_comentarios[:500],
            "climaComunicacion": clima_comunicacion
        }

        job.estado = "completado"
        job.progreso = 100
        job.mensaje = "ANALYSIS_COMPLETED"
        db.commit()

    except Exception as e:
        job.estado = "error"
        job.mensaje = f"ERROR|{str(e)}"
        db.commit()
    finally:
        duracion = time.perf_counter() - inicio_tiempo
        print(f"[informe_servicio] Job {job_id}: análisis finalizado en {duracion:.2f} segundos", flush=True)
        db.close()

def resolver_propietario(x_usuario, x_session_id, db: Session):
    """Devuelve (usuario_id, session_id) a partir de las cabeceras de la petición.
    Si hay usuario logueado válido, se ignora la sesión anónima."""
    if x_usuario:
        usuario_db = db.query(UsuarioBase).filter(UsuarioBase.username == x_usuario).first()
        if not usuario_db:
            raise HTTPException(status_code=401, detail="Usuario inválido")
        return usuario_db.id, None
    return None, x_session_id

def verificar_propiedad(job: JobRecord, usuario_id, session_id):
    """Lanza 404 si el job no pertenece al usuario/sesión que hace la petición."""
    if usuario_id is not None:
        if job.usuario_id != usuario_id:
            raise HTTPException(status_code=404, detail="Análisis no encontrado")
    else:
        if job.usuario_id is not None or job.session_id != session_id:
            raise HTTPException(status_code=404, detail="Análisis no encontrado")