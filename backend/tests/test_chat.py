"""
Tests del router de chat (routers/chat.py)
Validación de propiedad del informe, comprobación de que el informe 
esté listo, y el contrato de lallamada al LLM 
(routers.chat.generar_respuesta se sustituye por un doble de
prueba; el motor real se cubre en tests/test_llm_motor.py).
"""
import routers.chat as chat_router
from modelos.orm import JobRecord, UsuarioBase

RESULTADO_MINIMO = {
    "metricasGlobales": {"entropia_shannon": 1.0, "indice_simpson": 0.5, "ratio_unicos": 0.3},
    "bigFive": {"Openness": 2},
    "tonoCodigo": {"Quality_Positive": 1},
    "climaComunicacion": {
        "comentariosAnalizados": 10, "porcentajePositivos": 50.0,
        "porcentajeNegativos": 20.0, "porcentajeNeutros": 30.0,
        "comentariosToxicos": 0, "porcentajeToxicos": 0.0
    },
    "lenguajeInclusivoCodigo": {
        "scoreGlobal": 80.0, "identificadoresAnalizados": 5,
        "hallazgosPorCategoria": {}, "terminosMasFrecuentes": {},
        "resumenRepos": [], "resumenArchivos": [],
        "hallazgos": [{"repo": "a/b", "path": "x.py", "identificador": "whitelist",
                        "termino": "whitelist", "severidad": "high",
                        "alternativas": "allowlist", "ocurrencias": 3}]
    },
    "hallazgosComentarios": [],
}

class TestChatEndpoint:

    def test_job_inexistente_devuelve_404(self, chat_client):
        respuesta = chat_client.post("/chat/no-existe", json={"mensaje": "hola"})
        assert respuesta.status_code == 404

    def test_informe_no_listo_devuelve_400(self, chat_client, db_session):
        job = JobRecord(job_id="j1", objetivo="x", session_id="s1", estado="procesando")
        db_session.add(job)
        db_session.commit()

        respuesta = chat_client.post(
            "/chat/j1", json={"mensaje": "hola"}, headers={"x-session-id": "s1"}
        )
        assert respuesta.status_code == 400

    def test_usuario_invalido_devuelve_401(self, chat_client, db_session):
        job = JobRecord(job_id="j1", objetivo="x", session_id="s1",
                         estado="completado", resultado=RESULTADO_MINIMO)
        db_session.add(job)
        db_session.commit()

        respuesta = chat_client.post(
            "/chat/j1", json={"mensaje": "hola"}, headers={"x-usuario": "fantasma"}
        )
        assert respuesta.status_code == 401

    def test_sesion_distinta_devuelve_404(self, chat_client, db_session):
        job = JobRecord(job_id="j1", objetivo="x", session_id="s1",
                         estado="completado", resultado=RESULTADO_MINIMO)
        db_session.add(job)
        db_session.commit()

        respuesta = chat_client.post(
            "/chat/j1", json={"mensaje": "hola"}, headers={"x-session-id": "s2"}
        )
        assert respuesta.status_code == 404

    def test_respuesta_correcta_para_sesion_propietaria(self, chat_client, db_session, monkeypatch):
        job = JobRecord(job_id="j1", objetivo="x", session_id="s1",
                         estado="completado", resultado=RESULTADO_MINIMO)
        db_session.add(job)
        db_session.commit()

        def fake_generar_respuesta_stream(prompt_sistema, historial, nuevo_mensaje):
            yield "respuesta "
            yield "del bot"

        monkeypatch.setattr(chat_router, "generar_respuesta_stream", fake_generar_respuesta_stream)

        respuesta = chat_client.post(
            "/chat/j1", json={"mensaje": "hola"}, headers={"x-session-id": "s1"}
        )
        assert respuesta.status_code == 200
        assert respuesta.text == "respuesta del bot"

    def test_respuesta_correcta_para_usuario_propietario(self, chat_client, db_session, monkeypatch):
        usuario = UsuarioBase(username="ana", password="1234abcd")
        db_session.add(usuario)
        db_session.commit()
        db_session.refresh(usuario)

        job = JobRecord(job_id="j1", objetivo="x", usuario_id=usuario.id,
                         estado="completado", resultado=RESULTADO_MINIMO)
        db_session.add(job)
        db_session.commit()

        monkeypatch.setattr(chat_router, "generar_respuesta_stream",
                             lambda prompt_sistema, historial, nuevo_mensaje: iter(["ok"]))

        respuesta = chat_client.post(
            "/chat/j1", json={"mensaje": "hola"}, headers={"x-usuario": "ana"}
        )
        assert respuesta.status_code == 200

    def test_pasa_mensaje_e_historial_al_motor_llm(self, chat_client, db_session, monkeypatch):
        job = JobRecord(job_id="j1", objetivo="x", session_id="s1",
                         estado="completado", resultado=RESULTADO_MINIMO)
        db_session.add(job)
        db_session.commit()

        llamadas = []

        def fake_generar_respuesta_stream(prompt_sistema, historial, nuevo_mensaje):
            llamadas.append((prompt_sistema, historial, nuevo_mensaje))
            yield "ok"

        monkeypatch.setattr(chat_router, "generar_respuesta_stream", fake_generar_respuesta_stream)

        historial = [{"role": "user", "content": "primer mensaje"},
                     {"role": "assistant", "content": "primera respuesta"}]
        respuesta = chat_client.post(
            "/chat/j1",
            json={"mensaje": "segundo mensaje", "historial": historial},
            headers={"x-session-id": "s1"}
        )

        assert respuesta.status_code == 200
        assert respuesta.text == "ok"
        assert len(llamadas) == 1
        prompt_sistema, historial_recibido, nuevo_mensaje = llamadas[0]
        assert nuevo_mensaje == "segundo mensaje"
        assert [h.content for h in historial_recibido] == ["primer mensaje", "primera respuesta"]
        assert "whitelist" in prompt_sistema