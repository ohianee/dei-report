"""
Tests de la clase 'usuario'
Modelo ORM UsuarioBase y los endpoints /login y /registro 
que operan sobre ella.
"""
from modelos.orm import UsuarioBase, JobRecord
from cifrado import obtener_hash_password, verificar_password

class TestUsuarioModelo:

    def test_crear_usuario_guarda_los_campos(self, db_session):
        pass_hash = obtener_hash_password("secreta123")
        usuario = UsuarioBase(username="ana", password=pass_hash)
        
        db_session.add(usuario)
        db_session.commit()
        db_session.refresh(usuario)

        assert usuario.id is not None
        assert usuario.username == "ana"
        assert verificar_password("secreta123", usuario.password)

    def test_username_es_unico(self, db_session):
        pass_hash_1 = obtener_hash_password("pass1")
        db_session.add(UsuarioBase(username="ana", password=pass_hash_1))
        db_session.commit()

        pass_hash_2 = obtener_hash_password("pass2")
        db_session.add(UsuarioBase(username="ana", password=pass_hash_2))
        try:
            db_session.commit()
            assert False, "Se esperaba un error de integridad por username duplicado"
        except Exception:
            db_session.rollback()

    def test_relacion_con_jobs(self, db_session):
        pass_hash = obtener_hash_password("secreta123")
        usuario = UsuarioBase(username="ana", password=pass_hash)
        
        db_session.add(usuario)
        db_session.commit()
        db_session.refresh(usuario)

        job = JobRecord(job_id="job-1", objetivo="Lista: 1 repos", usuario_id=usuario.id)
        db_session.add(job)
        db_session.commit()
        db_session.refresh(usuario)

        assert len(usuario.jobs) == 1
        assert usuario.jobs[0].job_id == "job-1"
        assert usuario.jobs[0].propietario.username == "ana"

class TestRegistroEndpoint:

    def test_registro_correcto(self, client):
        respuesta = client.post("/registro", json={
            "user": "nuevo_usuario",
            "contrasenya": "1234abcd"
        })

        assert respuesta.status_code == 200
        assert respuesta.json() == {"msj": "Usuario creado con éxito"}

    def test_registro_usuario_duplicado(self, client):
        payload = {"user": "duplicado", "contrasenya": "1234abcd"}
        primera = client.post("/registro", json=payload)
        segunda = client.post("/registro", json=payload)

        assert primera.status_code == 200
        assert segunda.status_code == 400
        assert "ya existe" in segunda.json()["detail"]

class TestLoginEndpoint:

    def _crear_usuario(self, client, user="ana", contrasenya="1234abcd"):
        client.post("/registro", json={"user": user, "contrasenya": contrasenya})

    def test_login_correcto(self, client):
        self._crear_usuario(client)

        respuesta = client.post("/login", json={
            "user": "ana",
            "contrasenya": "1234abcd",
            "nocerrar": True
        })

        assert respuesta.status_code == 200
        assert respuesta.json() == {"user": "ana", "nocerrar": True}

    def test_login_contrasenya_incorrecta(self, client):
        self._crear_usuario(client)

        respuesta = client.post("/login", json={
            "user": "ana",
            "contrasenya": "no-es-esta"
        })

        assert respuesta.status_code == 401

    def test_login_usuario_inexistente(self, client):
        respuesta = client.post("/login", json={
            "user": "fantasma",
            "contrasenya": "1234abcd"
        })

        assert respuesta.status_code == 401

    def test_login_adopta_jobs_de_la_sesion_anonima(self, client, db_session):
        self._crear_usuario(client)

        job = JobRecord(job_id="job-anonimo", objetivo="Lista: 1 repos", session_id="sesion-abc")
        db_session.add(job)
        db_session.commit()

        respuesta = client.post(
            "/login",
            json={"user": "ana", "contrasenya": "1234abcd"},
            headers={"x-session-id": "sesion-abc"}
        )
        assert respuesta.status_code == 200

        db_session.refresh(job)
        usuario = db_session.query(UsuarioBase).filter(UsuarioBase.username == "ana").first()
        assert job.usuario_id == usuario.id
        assert job.session_id is None

class TestBorrarUsuarioEndpoint:

    def _crear_usuario(self, client, user="ana", contrasenya="1234abcd"):
        client.post("/registro", json={"user": user, "contrasenya": contrasenya})

    def test_borrar_usuario_correcto(self, client, db_session):
        self._crear_usuario(client)

        respuesta = client.request(
            "DELETE", "/usuario",
            json={"user": "ana", "contrasenya": "1234abcd"}
        )

        assert respuesta.status_code == 200
        assert respuesta.json() == {"mensaje": "Usuario ana eliminado correctamente"}
        assert db_session.query(UsuarioBase).filter(UsuarioBase.username == "ana").first() is None

    def test_borrar_usuario_contrasenya_incorrecta(self, client):
        self._crear_usuario(client)

        respuesta = client.request(
            "DELETE", "/usuario",
            json={"user": "ana", "contrasenya": "no-es-esta"}
        )

        assert respuesta.status_code == 401

    def test_borrar_usuario_inexistente(self, client):
        respuesta = client.request(
            "DELETE", "/usuario",
            json={"user": "fantasma", "contrasenya": "1234abcd"}
        )

        assert respuesta.status_code == 401

    def test_borrar_usuario_elimina_tambien_sus_jobs(self, client, db_session):
        self._crear_usuario(client)
        usuario = db_session.query(UsuarioBase).filter(UsuarioBase.username == "ana").first()

        job = JobRecord(job_id="job-1", objetivo="Lista: 1 repos", usuario_id=usuario.id)
        db_session.add(job)
        db_session.commit()

        respuesta = client.request(
            "DELETE", "/usuario",
            json={"user": "ana", "contrasenya": "1234abcd"}
        )

        assert respuesta.status_code == 200
        assert db_session.query(JobRecord).filter(JobRecord.job_id == "job-1").first() is None

class TestPerfilEndpoint:

    def _crear_usuario(self, client, user="ana", contrasenya="1234abcd"):
        client.post("/registro", json={"user": user, "contrasenya": contrasenya})

    def test_perfil_correcto(self, client, db_session):
        self._crear_usuario(client)
        usuario = db_session.query(UsuarioBase).filter(UsuarioBase.username == "ana").first()
        db_session.add(JobRecord(job_id="job-1", objetivo="Lista: 1 repos", usuario_id=usuario.id))
        db_session.commit()

        respuesta = client.get("/usuario", headers={"X-Usuario": "ana"})

        assert respuesta.status_code == 200
        assert respuesta.json() == {
            "user": "ana", "n_informes": 1,
            "github_conectado": False, "github_login": None,
        }

    def test_perfil_sin_cabecera(self, client):
        respuesta = client.get("/usuario")
        assert respuesta.status_code == 401

    def test_perfil_usuario_inexistente(self, client):
        respuesta = client.get("/usuario", headers={"X-Usuario": "fantasma"})
        assert respuesta.status_code == 401

class TestActualizarUsuarioEndpoint:

    def _crear_usuario(self, client, user="ana", contrasenya="1234abcd"):
        client.post("/registro", json={"user": user, "contrasenya": contrasenya})

    def test_cambiar_contrasenya_correcto(self, client):
        self._crear_usuario(client)

        respuesta = client.put(
            "/usuario",
            headers={"X-Usuario": "ana"},
            json={"contrasenya_actual": "1234abcd", "contrasenya_nueva": "otra_pass"}
        )
        assert respuesta.status_code == 200

        login_antigua = client.post("/login", json={"user": "ana", "contrasenya": "1234abcd"})
        login_nueva = client.post("/login", json={"user": "ana", "contrasenya": "otra_pass"})
        assert login_antigua.status_code == 401
        assert login_nueva.status_code == 200

    def test_cambiar_contrasenya_actual_incorrecta(self, client):
        self._crear_usuario(client)

        respuesta = client.put(
            "/usuario",
            headers={"X-Usuario": "ana"},
            json={"contrasenya_actual": "no-es-esta", "contrasenya_nueva": "otra_pass"}
        )
        assert respuesta.status_code == 401