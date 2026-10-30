"""
Tests de analisis/llm_motor.py
Construcción del prompt en el formato de chat nativo de Phi-3, generación de la 
respuesta completa y en streaming, y manejo del modelo ausente. El modelo 
real (`Llama`) se sustituye por un doble de prueba para no depender de 
tener el .gguf descargado en disco.
"""
from types import SimpleNamespace

import pytest

import analisis.llm_motor as llm_motor
from analisis.llm_motor import (
    generar_respuesta,
    generar_respuesta_stream,
    construir_prompt,
    cargar_llm,
)


class MensajeFake(SimpleNamespace):
    """Simula modelos.schemas.MensajeChat (tiene .role y .content)."""
    pass

class FakeLlama:
    def __init__(self, texto="  respuesta generada  ", fragmentos=None):
        self.llamadas = []
        self.texto = texto
        self.fragmentos = fragmentos or []

    def create_completion(self, prompt, max_tokens, temperature, stop, stream=False):
        self.llamadas.append(prompt)
        if stream:
            return ({"choices": [{"text": frag}]} for frag in self.fragmentos)
        return {"choices": [{"text": self.texto}]}

class TestConstruirPrompt:

    def test_el_turno_de_sistema_va_primero(self):
        prompt = construir_prompt("system prompt", [], "hola")
        assert prompt.startswith("<|system|>\nsystem prompt<|end|>\n")

    def test_el_nuevo_mensaje_de_usuario_va_al_final_del_historial(self):
        prompt = construir_prompt("sistema", [], "cual es mi score?")
        assert "<|user|>\ncual es mi score?<|end|>\n<|assistant|>\n" in prompt
        assert prompt.endswith("<|assistant|>\n")

    def test_recorta_el_historial_a_los_ultimos_4_mensajes(self):
        historial = [MensajeFake(role="user", content=f"msj {i}") for i in range(6)]
        prompt = construir_prompt("sistema", historial, "nuevo")

        for i in range(2, 6):
            assert f"msj {i}" in prompt
        for i in range(0, 2):
            assert f"msj {i}" not in prompt

    def test_historial_corto_no_se_recorta(self):
        historial = [MensajeFake(role="assistant", content="msj 0")]
        prompt = construir_prompt("sistema", historial, "nuevo")
        assert "msj 0" in prompt

class TestGenerarRespuesta:

    def test_devuelve_el_contenido_sin_espacios_extra(self, monkeypatch):
        monkeypatch.setattr(llm_motor, "cargar_llm", lambda: FakeLlama())
        assert generar_respuesta("sistema", [], "hola") == "respuesta generada"

    def test_usa_el_prompt_construido_en_formato_phi3(self, monkeypatch):
        fake_llm = FakeLlama()
        monkeypatch.setattr(llm_motor, "cargar_llm", lambda: fake_llm)

        generar_respuesta("sistema", [], "hola")

        assert "<|system|>\nsistema<|end|>\n" in fake_llm.llamadas[0]
        assert "<|user|>\nhola<|end|>\n" in fake_llm.llamadas[0]

class TestGenerarRespuestaStream:

    def test_cede_cada_fragmento_segun_se_genera(self, monkeypatch):
        fake_llm = FakeLlama(fragmentos=["Hola", ", ", "¿en qué puedo ayudarte?"])
        monkeypatch.setattr(llm_motor, "cargar_llm", lambda: fake_llm)

        fragmentos = list(generar_respuesta_stream("sistema", [], "hola"))

        assert fragmentos == ["Hola", ", ", "¿en qué puedo ayudarte?"]

    def test_no_cede_fragmentos_vacios(self, monkeypatch):
        fake_llm = FakeLlama(fragmentos=["Hola", "", "!"])
        monkeypatch.setattr(llm_motor, "cargar_llm", lambda: fake_llm)

        fragmentos = list(generar_respuesta_stream("sistema", [], "hola"))

        assert fragmentos == ["Hola", "!"]

class TestCargarLlm:

    def test_lanza_error_si_no_existe_el_fichero_del_modelo(self, monkeypatch):
        llm_motor._llm = None
        monkeypatch.setattr(llm_motor.os.path, "exists", lambda ruta: False)

        with pytest.raises(FileNotFoundError):
            cargar_llm()

    def test_reutiliza_la_instancia_ya_cargada(self, monkeypatch):
        instancia_previa = FakeLlama()
        llm_motor._llm = instancia_previa
        monkeypatch.setattr(llm_motor, "Llama", lambda **kwargs: (_ for _ in ()).throw(
            AssertionError("no debería reconstruir el modelo si ya está cargado")))

        assert cargar_llm() is instancia_previa
        llm_motor._llm = None