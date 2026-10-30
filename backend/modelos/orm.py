"""Modelos ORM (SQLAlchemy) de las tablas `usuarios` y `jobs`."""
from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone

class UsuarioBase(Base):
    """Cuenta de usuario registrada (username + password en claro, demo)."""
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    jobs = relationship("JobRecord", back_populates="propietario")
    github_login = Column(String, nullable=True)
    github_token_cifrado = Column(String, nullable=True)

class GithubOAuthState(Base):
    """Valor `state` (anti-CSRF) generado en `/auth/github/login` y
    consumido en `/auth/github/callback`. De un solo uso y de vida corta:
    se borra tanto al consumirse como en la limpieza periódica de
    registros antiguos."""
    __tablename__ = "github_oauth_state"
    state = Column(String, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class JobRecord(Base):
    """Un análisis DEI lanzado (en curso, completado o fallido) y su resultado.
    Pertenece a un `usuario_id` (si el llamante había iniciado sesión) o a un
    `session_id` anónimo, nunca a ambos. `objetivo_clave` identifica de forma
    unívoca el objetivo del análisis (misma org o mismo conjunto de repos) y
    se usa para impedir lanzar dos veces el mismo análisis en paralelo;
    `objetivo` es solo la versión legible para mostrar en el histórico.
    """
    __tablename__ = "jobs"
    job_id = Column(String, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    session_id = Column(String, nullable=True, index=True)
    fecha = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    objetivo = Column(String)
    objetivo_clave = Column(String, index=True)
    estado = Column(String, default="procesando")
    progreso = Column(Integer, default=0)
    mensaje = Column(String, default="INIT_TASK")
    resultado = Column(JSON, nullable=True)
    propietario = relationship("UsuarioBase", back_populates="jobs")