"""
Punto de entrada del microservicio de Chat IA de DEI Report.
La aplicación se encarga de configurar FastAPI, la conexión con la base de
datos, CORS, la documentación de la API y el middleware de cabeceras de
seguridad. Los endpoints del chat están organizados en `routers/chat.py`.

Este servicio está separado del backend principal para ejecutar las
operaciones relacionadas con el motor LLM sin bloquear el resto de la API.
"""

import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.openapi.docs import get_redoc_html

from dotenv import load_dotenv
load_dotenv("token.env")

from database import engine, Base
from routers import chat

from seguridad import CabecerasSeguridadMiddleware
from fastapi.staticfiles import StaticFiles

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DEI Report - Microservicio de Chat IA",
    description="Backend dedicado exclusivamente a manejar " \
    "el motor LLM para no bloquear el servidor principal.",
    version="1.0.0",
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
def index_chat():
    html_path = Path(__file__).parent / "templates" / "index_chat.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))

app.include_router(chat.router)
app.add_middleware(CabecerasSeguridadMiddleware)
app.mount("/static", StaticFiles(directory="static"), name="static")