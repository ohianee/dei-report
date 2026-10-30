"""
Tests del informe DEI (job de análisis)
Modelo ORM JobRecord, las funciones de servicio en servicios/informe_servicio.py 
y los endpoints que operan sobre los jobs (/analizar, /historico, /informe...).
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

import routers.informe as informe_router
from modelos.orm import JobRecord, UsuarioBase
from modelos.schemas import RepoConfig, RepoItem
from servicios.informe_servicio import (
    limpiar_sesiones_anonimas_antiguas,
    resolver_propietario,
    verificar_propiedad,
    calcular_clave_objetivo,
    buscar_analisis_en_curso,
)

class TestInformeModelo:

    def test_job_se_crea_con_valores_por_defecto(self, db_session):
        job = JobRecord(job_id="job-1", objetivo="Lista: 1 repos")
        db_session.add(job)
        db_session.commit()
        db_session.refresh(job)

        assert job.estado == "procesando"
        assert job.progreso == 0
        assert job.resultado is None
        assert job.usuario_id is None
        assert job.fecha is not None

    def test_job_anonimo_guarda_session_id(self, db_session):
        job = JobRecord(job_id="job-anon", objetivo="Org: acme", session_id="sesion-xyz")
        db_session.add(job)
        db_session.commit()
        db_session.refresh(job)

        assert job.session_id == "sesion-xyz"
        assert job.usuario_id is None

    def test_job_de_usuario_guarda_relacion_con_propietario(self, db_session):
        usuario = UsuarioBase(username="ana", password="1234abcd")
        db_session.add(usuario)
        db_session.commit()
        db_session.refresh(usuario)

        job = JobRecord(job_id="job-usr", objetivo="Lista: 1 repos", usuario_id=usuario.id)
        db_session.add(job)
        db_session.commit()
        db_session.refresh(job)

        assert job.propietario.username == "ana"

class TestLimpiarSesionesAnonimasAntiguas:

    def test_borra_solo_anonimos_de_mas_de_24h(self, db_session):
        antiguo = JobRecord(
            job_id="viejo", objetivo="x", session_id="s1",
            fecha=datetime.now(timezone.utc) - timedelta(hours=25)
        )
        reciente = JobRecord(
            job_id="nuevo", objetivo="x", session_id="s2",
            fecha=datetime.now(timezone.utc)
        )
        usuario = UsuarioBase(username="ana", password="1234abcd")
        db_session.add_all([antiguo, reciente, usuario])
        db_session.commit()
        db_session.refresh(usuario)

        antiguo_con_usuario = JobRecord(
            job_id="viejo-con-usuario", objetivo="x", usuario_id=usuario.id,
            fecha=datetime.now(timezone.utc) - timedelta(hours=25)
        )
        db_session.add(antiguo_con_usuario)
        db_session.commit()

        limpiar_sesiones_anonimas_antiguas(db_session)

        ids_restantes = {j.job_id for j in db_session.query(JobRecord).all()}
        assert ids_restantes == {"nuevo", "viejo-con-usuario"}

class TestResolverPropietario:

    def test_con_usuario_valido_devuelve_su_id(self, db_session):
        usuario = UsuarioBase(username="ana", password="1234abcd")
        db_session.add(usuario)
        db_session.commit()
        db_session.refresh(usuario)

        usuario_id, session_id = resolver_propietario("ana", None, db_session)

        assert usuario_id == usuario.id
        assert session_id is None

    def test_con_usuario_invalido_lanza_401(self, db_session):
        with pytest.raises(HTTPException) as exc:
            resolver_propietario("no-existe", "sesion-1", db_session)
        assert exc.value.status_code == 401

    def test_sin_usuario_devuelve_session_id(self, db_session):
        usuario_id, session_id = resolver_propietario(None, "sesion-1", db_session)
        assert usuario_id is None
        assert session_id == "sesion-1"

class TestVerificarPropiedad:

    def test_usuario_propietario_no_lanza_error(self):
        job = JobRecord(job_id="j1", objetivo="x", usuario_id=5)
        verificar_propiedad(job, usuario_id=5, session_id=None)

    def test_usuario_no_propietario_lanza_404(self):
        job = JobRecord(job_id="j1", objetivo="x", usuario_id=5)
        with pytest.raises(HTTPException) as exc:
            verificar_propiedad(job, usuario_id=6, session_id=None)
        assert exc.value.status_code == 404

    def test_sesion_anonima_propietaria_no_lanza_error(self):
        job = JobRecord(job_id="j1", objetivo="x", session_id="s1")
        verificar_propiedad(job, usuario_id=None, session_id="s1")

    def test_sesion_anonima_distinta_lanza_404(self):
        job = JobRecord(job_id="j1", objetivo="x", session_id="s1")
        with pytest.raises(HTTPException) as exc:
            verificar_propiedad(job, usuario_id=None, session_id="s2")
        assert exc.value.status_code == 404

    def test_job_de_usuario_no_accesible_por_sesion_anonima(self):
        job = JobRecord(job_id="j1", objetivo="x", usuario_id=5)
        with pytest.raises(HTTPException) as exc:
            verificar_propiedad(job, usuario_id=None, session_id="s1")
        assert exc.value.status_code == 404

class TestCalcularClaveObjetivo:

    def test_misma_org_distintas_mayusculas_misma_clave(self):
        c1 = RepoConfig(modo="organizacion", org="MiOrg")
        c2 = RepoConfig(modo="organizacion", org=" miorg ")
        assert calcular_clave_objetivo(c1) == calcular_clave_objetivo(c2)

    def test_distinta_org_distinta_clave(self):
        c1 = RepoConfig(modo="organizacion", org="org-a")
        c2 = RepoConfig(modo="organizacion", org="org-b")
        assert calcular_clave_objetivo(c1) != calcular_clave_objetivo(c2)

    def test_misma_lista_distinto_orden_misma_clave(self):
        c1 = RepoConfig(modo="lista", repos=[RepoItem(owner="A", repo="X"), RepoItem(owner="B", repo="Y")])
        c2 = RepoConfig(modo="lista", repos=[RepoItem(owner="b", repo="y"), RepoItem(owner="a", repo="x")])
        assert calcular_clave_objetivo(c1) == calcular_clave_objetivo(c2)

    def test_lista_distinta_repos_distinta_clave(self):
        c1 = RepoConfig(modo="lista", repos=[RepoItem(owner="a", repo="x")])
        c2 = RepoConfig(modo="lista", repos=[RepoItem(owner="a", repo="y")])
        assert calcular_clave_objetivo(c1) != calcular_clave_objetivo(c2)

class TestBuscarAnalisisEnCurso:

    def test_encuentra_job_en_curso_de_la_misma_sesion(self, db_session):
        db_session.add(JobRecord(job_id="j1", objetivo="x", objetivo_clave="org:acme", session_id="s1", estado="procesando"))
        db_session.commit()

        encontrado = buscar_analisis_en_curso(db_session, "org:acme", usuario_id=None, session_id="s1")
        assert encontrado is not None
        assert encontrado.job_id == "j1"

    def test_no_encuentra_si_es_otra_sesion(self, db_session):
        db_session.add(JobRecord(job_id="j1", objetivo="x", objetivo_clave="org:acme", session_id="s1", estado="procesando"))
        db_session.commit()

        assert buscar_analisis_en_curso(db_session, "org:acme", usuario_id=None, session_id="s2") is None

    def test_no_encuentra_si_ya_esta_completado(self, db_session):
        db_session.add(JobRecord(job_id="j1", objetivo="x", objetivo_clave="org:acme", session_id="s1", estado="completado"))
        db_session.commit()

        assert buscar_analisis_en_curso(db_session, "org:acme", usuario_id=None, session_id="s1") is None

    def test_no_encuentra_si_es_otro_objetivo(self, db_session):
        db_session.add(JobRecord(job_id="j1", objetivo="x", objetivo_clave="org:acme", session_id="s1", estado="procesando"))
        db_session.commit()

        assert buscar_analisis_en_curso(db_session, "org:otra", usuario_id=None, session_id="s1") is None

class TestAnalizarEndpoint:

    CONFIG_LISTA = {"modo": "lista", "repos": [{"owner": "acme", "repo": "web"}]}

    def test_sin_usuario_ni_sesion_devuelve_400(self, client):
        respuesta = client.post("/analizar", json=self.CONFIG_LISTA)
        assert respuesta.status_code == 400

    def test_con_session_id_crea_job_anonimo(self, client, db_session, monkeypatch):
        monkeypatch.setattr(informe_router, "ejecutar_analisis_real", lambda job_id, config, usuario_id=None: None)

        respuesta = client.post(
            "/analizar", json=self.CONFIG_LISTA,
            headers={"x-session-id": "sesion-1"}
        )

        assert respuesta.status_code == 200
        job_id = respuesta.json()["job_id"]

        job = db_session.query(JobRecord).filter(JobRecord.job_id == job_id).first()
        assert job is not None
        assert job.usuario_id is None
        assert job.session_id == "sesion-1"
        assert job.objetivo == "Lista: 1 repos"

    def test_con_usuario_valido_crea_job_del_usuario(self, client, db_session, monkeypatch):
        monkeypatch.setattr(informe_router, "ejecutar_analisis_real", lambda job_id, config, usuario_id=None: None)
        client.post("/registro", json={"user": "ana", "contrasenya": "1234abcd"})

        respuesta = client.post(
            "/analizar", json=self.CONFIG_LISTA,
            headers={"x-usuario": "ana"}
        )

        assert respuesta.status_code == 200
        job_id = respuesta.json()["job_id"]
        job = db_session.query(JobRecord).filter(JobRecord.job_id == job_id).first()
        usuario = db_session.query(UsuarioBase).filter(UsuarioBase.username == "ana").first()

        assert job.usuario_id == usuario.id
        assert job.session_id is None

    def test_con_usuario_invalido_devuelve_401(self, client, monkeypatch):
        monkeypatch.setattr(informe_router, "ejecutar_analisis_real", lambda job_id, config, usuario_id=None: None)

        respuesta = client.post(
            "/analizar", json=self.CONFIG_LISTA,
            headers={"x-usuario": "no-existe"}
        )
        assert respuesta.status_code == 401

    def test_lanza_la_tarea_en_background_con_los_argumentos_correctos(self, client, monkeypatch):
        llamadas = []
        monkeypatch.setattr(
            informe_router, "ejecutar_analisis_real",
            lambda job_id, config, usuario_id=None: llamadas.append((job_id, config, usuario_id))
        )

        respuesta = client.post(
            "/analizar", json=self.CONFIG_LISTA,
            headers={"x-session-id": "sesion-1"}
        )
        job_id = respuesta.json()["job_id"]

        assert len(llamadas) == 1
        assert llamadas[0][0] == job_id
        assert llamadas[0][1].modo == "lista"

    def test_no_permite_lanzar_dos_veces_el_mismo_objetivo(self, client, monkeypatch):
        monkeypatch.setattr(informe_router, "ejecutar_analisis_real", lambda job_id, config, usuario_id=None: None)

        primera = client.post("/analizar", json=self.CONFIG_LISTA, headers={"x-session-id": "s1"})
        segunda = client.post("/analizar", json=self.CONFIG_LISTA, headers={"x-session-id": "s1"})

        assert primera.status_code == 200
        assert segunda.status_code == 409
        assert segunda.json()["detail"]["job_id"] == primera.json()["job_id"]

    def test_permite_lanzar_objetivos_distintos_a_la_vez(self, client, monkeypatch):
        monkeypatch.setattr(informe_router, "ejecutar_analisis_real", lambda job_id, config, usuario_id=None: None)
        otro_config = {"modo": "lista", "repos": [{"owner": "acme", "repo": "otro-repo"}]}
        headers = {"x-session-id": "s1"}

        primera = client.post("/analizar", json=self.CONFIG_LISTA, headers=headers)
        segunda = client.post("/analizar", json=otro_config, headers=headers)

        assert primera.status_code == 200
        assert segunda.status_code == 200
        assert primera.json()["job_id"] != segunda.json()["job_id"]

    def test_permite_la_misma_org_en_sesiones_distintas(self, client, monkeypatch):
        monkeypatch.setattr(informe_router, "ejecutar_analisis_real", lambda job_id, config, usuario_id=None: None)

        primera = client.post("/analizar", json=self.CONFIG_LISTA, headers={"x-session-id": "s1"})
        segunda = client.post("/analizar", json=self.CONFIG_LISTA, headers={"x-session-id": "s2"})

        assert primera.status_code == 200
        assert segunda.status_code == 200

class TestEstadoEndpoint:

    def test_job_inexistente_devuelve_404(self, client):
        respuesta = client.get("/analizar/no-existe/estado")
        assert respuesta.status_code == 404

    def test_devuelve_el_estado_del_propietario_por_sesion(self, client, db_session):
        job = JobRecord(job_id="j1", objetivo="x", session_id="s1", progreso=42, mensaje="En curso")
        db_session.add(job)
        db_session.commit()

        respuesta = client.get("/analizar/j1/estado", headers={"x-session-id": "s1"})

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["job_id"] == "j1"
        assert cuerpo["progreso"] == 42
        assert cuerpo["mensaje"] == "En curso"

    def test_otra_sesion_no_puede_ver_el_job(self, client, db_session):
        job = JobRecord(job_id="j1", objetivo="x", session_id="s1")
        db_session.add(job)
        db_session.commit()

        respuesta = client.get("/analizar/j1/estado", headers={"x-session-id": "s2"})
        assert respuesta.status_code == 404

class TestInformeEndpoint:

    RESULTADO_MINIMO = {
        "job_id": "j1",
        "metricasGlobales": {"entropia_shannon": 0.0, "indice_simpson": 0.0, "ratio_unicos": 0.0},
        "bigFive": {}, "tonoCodigo": {},
        "diversidadAutores": [], "diversidadRepos": [],
        "lenguajeInclusivoCodigo": {
            "scoreGlobal": 0.0, "identificadoresAnalizados": 0,
            "hallazgosPorCategoria": {}, "terminosMasFrecuentes": {},
            "resumenRepos": [], "resumenArchivos": [], "hallazgos": []
        },
        "hallazgosComentarios": [],
        "climaComunicacion": {
            "comentariosAnalizados": 0, "porcentajePositivos": 0.0,
            "porcentajeNegativos": 0.0, "porcentajeNeutros": 0.0,
            "comentariosToxicos": 0, "porcentajeToxicos": 0.0
        }
    }

    def test_informe_no_listo_devuelve_400(self, client, db_session):
        job = JobRecord(job_id="j1", objetivo="x", session_id="s1", estado="procesando")
        db_session.add(job)
        db_session.commit()

        respuesta = client.get("/informe/j1", headers={"x-session-id": "s1"})
        assert respuesta.status_code == 400

    def test_informe_completado_se_devuelve(self, client, db_session):
        job = JobRecord(
            job_id="j1", objetivo="x", session_id="s1",
            estado="completado", resultado=self.RESULTADO_MINIMO
        )
        db_session.add(job)
        db_session.commit()

        respuesta = client.get("/informe/j1", headers={"x-session-id": "s1"})
        assert respuesta.status_code == 200
        assert respuesta.json()["job_id"] == "j1"

class TestHistoricoEndpoint:

    def test_sin_identificacion_devuelve_lista_vacia(self, client):
        respuesta = client.get("/historico")
        assert respuesta.status_code == 200
        assert respuesta.json() == []

    def test_devuelve_solo_los_jobs_de_la_sesion(self, client, db_session):
        db_session.add_all([
            JobRecord(job_id="mio", objetivo="x", session_id="s1"),
            JobRecord(job_id="de-otro", objetivo="x", session_id="s2"),
        ])
        db_session.commit()

        respuesta = client.get("/historico", headers={"x-session-id": "s1"})
        ids = [item["job_id"] for item in respuesta.json()]
        assert ids == ["mio"]

    def test_devuelve_solo_los_jobs_del_usuario(self, client, db_session):
        usuario = UsuarioBase(username="ana", password="1234abcd")
        db_session.add(usuario)
        db_session.commit()
        db_session.refresh(usuario)

        db_session.add_all([
            JobRecord(job_id="mio", objetivo="x", usuario_id=usuario.id),
            JobRecord(job_id="anonimo", objetivo="x", session_id="s2"),
        ])
        db_session.commit()

        respuesta = client.get("/historico", headers={"x-usuario": "ana"})
        ids = [item["job_id"] for item in respuesta.json()]
        assert ids == ["mio"]

class TestBorrarInformeEndpoint:

    def test_borra_el_job_propio(self, client, db_session):
        db_session.add(JobRecord(job_id="j1", objetivo="x", session_id="s1"))
        db_session.commit()

        respuesta = client.delete("/historico/j1", headers={"x-session-id": "s1"})

        assert respuesta.status_code == 200
        assert db_session.query(JobRecord).filter(JobRecord.job_id == "j1").first() is None

    def test_no_puede_borrar_job_de_otra_sesion(self, client, db_session):
        db_session.add(JobRecord(job_id="j1", objetivo="x", session_id="s1"))
        db_session.commit()

        respuesta = client.delete("/historico/j1", headers={"x-session-id": "s2"})

        assert respuesta.status_code == 404
        assert db_session.query(JobRecord).filter(JobRecord.job_id == "j1").first() is not None

    def test_job_inexistente_devuelve_404(self, client):
        respuesta = client.delete("/historico/no-existe", headers={"x-session-id": "s1"})
        assert respuesta.status_code == 404