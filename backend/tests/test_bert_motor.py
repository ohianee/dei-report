"""
Tests de analisis/bert_motor.py.
`seleccionar_indices_muestra` es pura y se prueba directamente. Las
funciones de inferencia (`analizar_sentimiento_lote`, `analizar_toxicidad_lote`)
sustituyen el pipeline de transformers por un doble de prueba (vía
monkeypatch de `_cargar_pipeline_sentimiento`/`_cargar_pipeline_toxicidad`)
para no depender de descargar/cargar los pesos reales en cada test."""
import analisis.bert_motor as bert_motor
from analisis.bert_motor import (
    seleccionar_indices_muestra, analizar_sentimiento_lote, analizar_toxicidad_lote,
)

class TestSeleccionarIndicesMuestra:

    def test_por_debajo_del_limite_devuelve_todos(self):
        assert seleccionar_indices_muestra(5, limite=10) == [0, 1, 2, 3, 4]

    def test_por_encima_del_limite_devuelve_una_muestra_del_tamano_pedido(self):
        indices = seleccionar_indices_muestra(100, limite=10)
        assert len(indices) == 10
        assert indices == sorted(indices)
        assert len(set(indices)) == 10

    def test_es_reproducible_con_la_misma_semilla(self):
        a = seleccionar_indices_muestra(1000, limite=50, semilla=7)
        b = seleccionar_indices_muestra(1000, limite=50, semilla=7)
        assert a == b

    def test_semillas_distintas_pueden_dar_muestras_distintas(self):
        a = seleccionar_indices_muestra(1000, limite=50, semilla=1)
        b = seleccionar_indices_muestra(1000, limite=50, semilla=2)
        assert a != b

    def test_justo_en_el_limite_devuelve_todos(self):
        assert seleccionar_indices_muestra(10, limite=10) == list(range(10))

class FakePipeline:
    """Simula un pipeline de `transformers`: recibe una lista de textos y
    devuelve una lista de resultados, uno por texto, en el mismo orden."""

    def __init__(self, resultado_por_texto):
        self.resultado_por_texto = resultado_por_texto
        self.llamadas = []

    def __call__(self, lote):
        self.llamadas.append(list(lote))
        return [self.resultado_por_texto(texto) for texto in lote]

class TestAnalizarSentimientoLote:

    def test_lista_vacia_no_llama_al_modelo(self, monkeypatch):
        def fallar():
            raise AssertionError("no debería cargar el pipeline para una lista vacía")
        monkeypatch.setattr(bert_motor, "_cargar_pipeline_sentimiento", fallar)
        assert analizar_sentimiento_lote([]) == []

    def test_textos_vacios_se_marcan_neutral_sin_pasar_por_el_modelo(self, monkeypatch):
        fake = FakePipeline(lambda t: {"label": "POSITIVE", "score": 0.99})
        monkeypatch.setattr(bert_motor, "_cargar_pipeline_sentimiento", lambda: fake)

        resultados = analizar_sentimiento_lote(["", "   ", "texto real"])

        assert resultados[0] == {"label": "NEUTRAL", "score": 0.0}
        assert resultados[1] == {"label": "NEUTRAL", "score": 0.0}
        assert resultados[2] == {"label": "POSITIVE", "score": 0.99}
        assert fake.llamadas == [["texto real"]]

    def test_respeta_el_orden_original(self, monkeypatch):
        fake = FakePipeline(lambda t: {"label": "NEGATIVE" if "malo" in t else "POSITIVE", "score": 0.8})
        monkeypatch.setattr(bert_motor, "_cargar_pipeline_sentimiento", lambda: fake)

        resultados = analizar_sentimiento_lote(["esto es malo", "esto es bueno"])

        assert resultados[0]["label"] == "NEGATIVE"
        assert resultados[1]["label"] == "POSITIVE"

    def test_procesa_en_lotes_del_tamano_indicado(self, monkeypatch):
        fake = FakePipeline(lambda t: {"label": "POSITIVE", "score": 1.0})
        monkeypatch.setattr(bert_motor, "_cargar_pipeline_sentimiento", lambda: fake)

        textos = [f"texto {i}" for i in range(5)]
        analizar_sentimiento_lote(textos, batch_size=2)

        assert [len(lote) for lote in fake.llamadas] == [2, 2, 1]

class TestAnalizarToxicidadLote:

    def test_lista_vacia_no_llama_al_modelo(self, monkeypatch):
        def fallar():
            raise AssertionError("no debería cargar el pipeline para una lista vacía")
        monkeypatch.setattr(bert_motor, "_cargar_pipeline_toxicidad", fallar)
        assert analizar_toxicidad_lote([]) == []

    def test_texto_vacio_se_marca_no_toxico_sin_pasar_por_el_modelo(self, monkeypatch):
        fake = FakePipeline(lambda t: [{"label": "toxic", "score": 0.99}])
        monkeypatch.setattr(bert_motor, "_cargar_pipeline_toxicidad", lambda: fake)

        resultados = analizar_toxicidad_lote(["", "texto real"])

        assert resultados[0] == {"toxico": False, "score": 0.0, "categorias": {}}
        assert resultados[1]["toxico"] is True
        assert resultados[1]["score"] == 0.99

    def test_solo_incluye_categorias_por_encima_del_umbral(self, monkeypatch):
        fake = FakePipeline(lambda t: [
            {"label": "toxic", "score": 0.9},
            {"label": "insult", "score": 0.55},
            {"label": "threat", "score": 0.1},
        ])
        monkeypatch.setattr(bert_motor, "_cargar_pipeline_toxicidad", lambda: fake)

        resultados = analizar_toxicidad_lote(["texto toxico"])

        assert set(resultados[0]["categorias"].keys()) == {"toxic", "insult"}
        assert "threat" not in resultados[0]["categorias"]

    def test_toxico_es_false_si_la_etiqueta_toxic_no_supera_el_umbral(self, monkeypatch):
        fake = FakePipeline(lambda t: [{"label": "toxic", "score": 0.2}])
        monkeypatch.setattr(bert_motor, "_cargar_pipeline_toxicidad", lambda: fake)

        resultados = analizar_toxicidad_lote(["texto normal"])
        assert resultados[0]["toxico"] is False