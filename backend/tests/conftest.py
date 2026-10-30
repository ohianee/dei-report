"""
Fixtures compartidas para los tests del backend.

Usa una base de datos SQLite en memoria (independiente de dei_report.db)
para no tocar datos reales, y sobreescribe la dependencia `get_db` de
FastAPI para que cada test tenga una sesión limpia.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import analisis.bert_motor as bert_motor
bert_motor.precargar_modelos = lambda: None
import analisis.pool_procesos as pool_procesos

class _PoolFalso:
    def submit(self, fn, /, *args, **kwargs):
        import concurrent.futures
        futuro = concurrent.futures.Future()
        try:
            futuro.set_result(fn(*args, **kwargs))
        except BaseException as exc:
            futuro.set_exception(exc)
        return futuro

pool_procesos.iniciar_pool_analisis = lambda: _PoolFalso()
pool_procesos.obtener_pool_analisis = lambda: _PoolFalso()
pool_procesos.cerrar_pool_analisis = lambda: None

from database import Base, get_db
import main
import main_chat

TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture()
def db_session():
    """Sesión de BD de test, con las tablas creadas/borradas en cada test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture()
def client(db_session):
    """TestClient de FastAPI que usa la sesión de BD de test en vez de la real."""

    def _override_get_db():
        yield db_session

    main.app.dependency_overrides[get_db] = _override_get_db
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.dependency_overrides.clear()

@pytest.fixture()
def chat_client(db_session):
    """TestClient del microservicio de chat (`main_chat.py`), que vive en una
    app FastAPI separada de la principal (`main.py`) para no bloquear el
    servidor principal con la carga del LLM. Usa la misma sesión de BD de
    test que `client`, ya que ambos servicios comparten la misma base de
    datos (jobs y usuarios)."""

    def _override_get_db():
        yield db_session

    main_chat.app.dependency_overrides[get_db] = _override_get_db
    with TestClient(main_chat.app) as test_client:
        yield test_client
    main_chat.app.dependency_overrides.clear()