"""
Punto de entrada de la API DEI Report.
La configuración de la app (CORS, arranque, creación de tablas) vive aquí;
los endpoints están organizados por dominio en `routers/` y la lógica de
negocio de los informes en `servicios/informe_servicio.py`.
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv("token.env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.openapi.docs import get_redoc_html

from database import engine, Base
from analisis.bert_motor import precargar_modelos
from analisis.pool_procesos import iniciar_pool_analisis, cerrar_pool_analisis
from routers import usuario, informe, auth_github

from seguridad import CabecerasSeguridadMiddleware
from fastapi.staticfiles import StaticFiles

Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carga los modelos de BERT en memoria al arrancar el servidor, 
    para que la primera descarga de los pesos (~varios cientos de MB) 
    no cuente como tiempo de espera del usuario.

    También arranca el pool de procesos usado para ejecutar los análisis, 
    y lo cierra ordenadamente al apagar el servidor."""
    precargar_modelos()
    iniciar_pool_analisis()
    yield
    cerrar_pool_analisis()


tags_metadata = [
    {
        "name": "usuario",
        "description": "Registro, login y borrado de la cuenta de usuario.",
    },
    {
        "name": "informe",
        "description": (
            "Lanzamiento de análisis DEI en segundo plano, consulta de su "
            "progreso, obtención del informe resultante y gestión del "
            "histórico (listado y borrado)."
        ),
    },
    {
        "name": "auth-github",
        "description": (
            "Vinculación OAuth de la cuenta de GitHub del usuario, para que "
            "sus análisis usen su propio token en vez del compartido por la app."
        ),
    },
]

app = FastAPI(
    title="DEI Report API",
    description=(
        "API del backend de **DEI Report**: genera informes automáticos de "
        "calidad DEI (diversidad, equidad e inclusión) analizando el código "
        "y la actividad de repositorios de GitHub — lenguaje inclusivo en "
        "identificadores y comentarios, tono/toxicidad, y diversidad léxica "
        "entre autores y repositorios.\n\n"
        "La identidad del llamante se resuelve mediante las cabeceras "
        "`X-Usuario` (usuario ya logueado) o `X-Session-Id` (sesión anónima, "
        "usada mientras el usuario no ha iniciado sesión)."
    ),
    version="1.0.0",
    openapi_tags=tags_metadata,
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENTORNO") == "dev" else None,
    openapi_url="/openapi.json" if os.getenv("ENTORNO") == "dev" else None,
    swagger_ui_parameters={"supportedSubmitMethods": []},
    redoc_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.getenv("ENTORNO") == "dev":
    @app.get("/redoc", include_in_schema=False)
    def redoc_html():
        """Sirve ReDoc con la URL de su JS fijada a la versión 2 (en vez del
        `redoc@next` que trae por defecto FastAPI 0.104.1, roto en jsdelivr)."""
        return get_redoc_html(
            openapi_url=app.openapi_url,
            title=f"{app.title} - ReDoc",
            redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js",
        )

@app.get("/", include_in_schema=False)
def index_principal():
    html_path = Path(__file__).parent / "templates" / "index.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))

app.include_router(usuario.router)
app.include_router(informe.router)
app.include_router(auth_github.router)
app.add_middleware(CabecerasSeguridadMiddleware)
app.mount("/static", StaticFiles(directory="static"), name="static")