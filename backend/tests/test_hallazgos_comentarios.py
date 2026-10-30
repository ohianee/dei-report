"""
Tests de analisis/hallazgos_comentarios.py
Detección de lenguaje no inclusivo y tono negativo 
(basados en diccionario/spaCy, sin necesidad de BERT) y de 
toxicidad (cascada sentimiento -> toxicidad, con los modelos BERT
sustituidos por dobles de prueba para no depender de pesos descargados).
"""
import analisis.hallazgos_comentarios as hallazgos_comentarios
from analisis.hallazgos_comentarios import analizar_hallazgos_comentarios


class TestSinBert:

    def test_detecta_lenguaje_no_inclusivo(self):
        comentarios = [{"repo": "acme/web", "author": "ana", "body": "Add this to the blacklist file"}]
        hallazgos = analizar_hallazgos_comentarios(comentarios, usar_bert=False)

        no_inclusivos = [h for h in hallazgos if h["tipo"] == "non_inclusive"]
        assert len(no_inclusivos) == 1
        assert no_inclusivos[0]["termino"] == "blacklist"
        assert no_inclusivos[0]["repo"] == "acme/web"
        assert no_inclusivos[0]["author"] == "ana"
        assert "denylist" in no_inclusivos[0]["alternativas"]

    def test_detecta_tono_negativo(self):
        comentarios = [{"repo": "acme/web", "author": "ana", "body": "This code is messy and hacky"}]
        hallazgos = analizar_hallazgos_comentarios(comentarios, usar_bert=False)

        tonos = [h for h in hallazgos if h["tipo"] == "negative_tone"]
        assert any(h["termino"] == "messy" for h in tonos)
        assert all(h["categoria"] == "negative_quality" for h in tonos)

    def test_comentario_neutro_no_genera_hallazgos(self):
        comentarios = [{"repo": "acme/web", "author": "ana", "body": "Looks good to me, thanks"}]
        assert analizar_hallazgos_comentarios(comentarios, usar_bert=False) == []

    def test_sin_comentarios_devuelve_lista_vacia(self):
        assert analizar_hallazgos_comentarios([], usar_bert=False) == []

    def test_contexto_incluye_fragmento_alrededor_del_termino(self):
        comentarios = [{"repo": "r", "author": "a", "body": "please update the whitelist entry now"}]
        hallazgos = analizar_hallazgos_comentarios(comentarios, usar_bert=False)
        hallazgo = next(h for h in hallazgos if h["termino"] == "whitelist")
        assert "whitelist" in hallazgo["contexto"]

    def test_no_ejecuta_analisis_de_toxicidad(self, monkeypatch):
        def fallar(*args, **kwargs):
            raise AssertionError("no debería llamarse a BERT cuando usar_bert=False")

        monkeypatch.setattr(hallazgos_comentarios, "analizar_toxicidad_lote", fallar)
        monkeypatch.setattr(hallazgos_comentarios, "analizar_sentimiento_lote", fallar)

        comentarios = [{"repo": "r", "author": "a", "body": "a normal comment"}]
        analizar_hallazgos_comentarios(comentarios, usar_bert=False)


class TestConBertSimulado:

    def test_reutiliza_sentimientos_ya_calculados_sin_llamar_de_nuevo(self, monkeypatch):
        def fallar(*args, **kwargs):
            raise AssertionError("no debería recalcular sentimientos si ya se pasaron")

        monkeypatch.setattr(hallazgos_comentarios, "analizar_sentimiento_lote", fallar)
        monkeypatch.setattr(hallazgos_comentarios, "analizar_toxicidad_lote", lambda textos: [
            {"toxico": False, "score": 0.0, "categorias": {}} for _ in textos
        ])

        comentarios = [{"repo": "r", "author": "a", "body": "some comment here"}]
        sentimientos = [{"label": "NEUTRAL", "score": 0.0}]

        analizar_hallazgos_comentarios(comentarios, usar_bert=True, sentimientos=sentimientos)

    def test_escala_a_toxicidad_solo_los_negativos_por_encima_del_umbral(self, monkeypatch):
        llamadas_toxicidad = []

        def fake_toxicidad(textos):
            llamadas_toxicidad.append(list(textos))
            return [{"toxico": False, "score": 0.0, "categorias": {}} for _ in textos]

        monkeypatch.setattr(hallazgos_comentarios, "analizar_toxicidad_lote", fake_toxicidad)

        comentarios = [
            {"repo": "r", "author": "a", "body": "comentario muy negativo"},
            {"repo": "r", "author": "b", "body": "comentario neutro"},
        ]
        sentimientos = [
            {"label": "NEGATIVE", "score": 0.9},
            {"label": "NEUTRAL", "score": 0.0},
        ]

        analizar_hallazgos_comentarios(comentarios, usar_bert=True, sentimientos=sentimientos)

        assert len(llamadas_toxicidad) == 1
        textos_enviados = llamadas_toxicidad[0]
        assert textos_enviados[0] == "comentario muy negativo"
        assert textos_enviados[1] == ""

    def test_hallazgo_de_toxicidad_incluye_categoria_y_severidad(self, monkeypatch):
        monkeypatch.setattr(hallazgos_comentarios, "analizar_toxicidad_lote", lambda textos: [
            {"toxico": True, "score": 0.95, "categorias": {"insult": 0.95, "toxic": 0.9}}
        ])

        comentarios = [{"repo": "acme/web", "author": "ana", "body": "you are an idiot"}]
        sentimientos = [{"label": "NEGATIVE", "score": 0.9}]

        hallazgos = analizar_hallazgos_comentarios(comentarios, usar_bert=True, sentimientos=sentimientos)

        toxicos = [h for h in hallazgos if h["tipo"] == "toxicity"]
        assert len(toxicos) == 1
        assert toxicos[0]["termino"] == "insult"
        assert toxicos[0]["severidad"] == "high"
        assert toxicos[0]["score"] == 0.95

    def test_toxicidad_con_score_bajo_tiene_severidad_media(self, monkeypatch):
        monkeypatch.setattr(hallazgos_comentarios, "analizar_toxicidad_lote", lambda textos: [
            {"toxico": True, "score": 0.6, "categorias": {"toxic": 0.6}}
        ])

        comentarios = [{"repo": "r", "author": "a", "body": "not nice comment"}]
        sentimientos = [{"label": "NEGATIVE", "score": 0.9}]

        hallazgos = analizar_hallazgos_comentarios(comentarios, usar_bert=True, sentimientos=sentimientos)
        toxicos = [h for h in hallazgos if h["tipo"] == "toxicity"]
        assert toxicos[0]["severidad"] == "medium"

    def test_no_toxico_no_genera_hallazgo_de_toxicidad(self, monkeypatch):
        monkeypatch.setattr(hallazgos_comentarios, "analizar_toxicidad_lote", lambda textos: [
            {"toxico": False, "score": 0.1, "categorias": {}}
        ])

        comentarios = [{"repo": "r", "author": "a", "body": "a rather negative comment"}]
        sentimientos = [{"label": "NEGATIVE", "score": 0.9}]

        hallazgos = analizar_hallazgos_comentarios(comentarios, usar_bert=True, sentimientos=sentimientos)
        assert not any(h["tipo"] == "toxicity" for h in hallazgos)
