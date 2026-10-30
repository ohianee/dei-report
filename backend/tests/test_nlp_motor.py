"""
Tests de analisis/nlp_motor.py
Limpieza de texto, extracción de adjetivos (spaCy) y las métricas de 
diversidad léxica (entropía de Shannon, índice de Simpson) usadas en las 
métricas globales y por autor/repo.
"""
from analisis.nlp_motor import (
    limpiar_texto, extraer_adjetivos, extraer_adjetivos_lote,
    entropia_shannon, indice_simpson,
)

class TestLimpiarTexto:

    def test_quita_bloques_de_codigo(self):
        assert limpiar_texto("antes ```codigo aqui``` despues") == "antes despues"

    def test_quita_codigo_inline(self):
        assert limpiar_texto("usa `variable_x` en el bucle") == "usa en el bucle"

    def test_quita_urls(self):
        assert limpiar_texto("mira https://ejemplo.com/foo y www.otro.com") == "mira y"

    def test_quita_menciones_y_hashtags(self):
        assert limpiar_texto("hola @usuario mira #tema") == "hola mira"

    def test_quita_numeros_y_puntuacion(self):
        assert limpiar_texto("Esto es genial! (100% seguro)") == "Esto es genial seguro"

    def test_colapsa_espacios_multiples(self):
        assert limpiar_texto("hola    mundo\n\ncruel") == "hola mundo cruel"

    def test_texto_vacio_devuelve_vacio(self):
        assert limpiar_texto("") == ""

class TestExtraerAdjetivos:

    def test_extrae_adjetivos_en_minuscula(self):
        adjetivos = extraer_adjetivos("This is a great and elegant solution")
        assert "great" in adjetivos
        assert "elegant" in adjetivos

    def test_sin_adjetivos_devuelve_lista_vacia(self):
        assert extraer_adjetivos("the cat sat on the mat") == []

    def test_lote_procesa_varios_textos_en_orden(self):
        resultados = extraer_adjetivos_lote(["a good idea", "a bad idea", "no adjectives here"])
        assert len(resultados) == 3
        assert "good" in resultados[0]
        assert "bad" in resultados[1]
        assert resultados[2] == []

class TestEntropiaShannon:

    def test_distribucion_uniforme_da_entropia_maxima(self):
        from collections import Counter
        frecuencias = Counter({"a": 10, "b": 10, "c": 10, "d": 10})
        import math
        assert entropia_shannon(frecuencias) == math.log2(4)

    def test_un_solo_valor_da_entropia_cero(self):
        from collections import Counter
        assert entropia_shannon(Counter({"a": 5})) == 0.0

    def test_sin_frecuencias_da_cero(self):
        from collections import Counter
        assert entropia_shannon(Counter()) == 0.0

class TestIndiceSimpson:

    def test_un_solo_elemento_da_cero(self):
        from collections import Counter
        assert indice_simpson(Counter({"a": 1})) == 0.0

    def test_maxima_diversidad_se_acerca_a_uno(self):
        from collections import Counter
        frecuencias = Counter({"a": 1, "b": 1, "c": 1, "d": 1})
        assert indice_simpson(frecuencias) == 1.0

    def test_baja_diversidad_da_valor_bajo(self):
        from collections import Counter
        frecuencias = Counter({"a": 100, "b": 1})
        assert 0.0 < indice_simpson(frecuencias) < 0.1