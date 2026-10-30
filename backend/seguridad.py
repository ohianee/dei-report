"""
Middleware de seguridad HTTP para el microservicio de Chat IA.

Añade cabeceras de seguridad a todas las respuestas, incluyendo protección
contra MIME sniffing, clickjacking y restricciones mediante Content Security
Policy (CSP). La CSP también define explícitamente los orígenes permitidos
para scripts, estilos, fuentes, imágenes y conexiones al backend del chat.

La URL del backend se obtiene de `CHAT_BACKEND_URL`, permitiendo adaptar la
política de conexiones según el entorno de despliegue.
"""
import os

from dotenv import load_dotenv
from starlette.middleware.base import BaseHTTPMiddleware

load_dotenv("token.env")
CHAT_BACKEND_URL = os.getenv("CHAT_BACKEND_URL", "http://localhost:8001").strip()

class CabecerasSeguridadMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "frame-ancestors 'none'; "
            "form-action 'self'; "
            "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
            "style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net 'unsafe-inline'; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            f"connect-src 'self' {CHAT_BACKEND_URL} https://cdn.jsdelivr.net;"
        )
        return response