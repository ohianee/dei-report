"""
Análisis semántico basado en BERT (transformers).
Se utilizan dos modelos preentrenados: DistilBERT para 
clasificar el sentimiento general (positivo/negativo) y 
Toxic-BERT para detectar diferentes formas de toxicidad. 
Los resultados de BERT se muestran junto con los obtenidos 
mediante reglas, funcionando como una segunda señal de 
análisis. Además, los modelos se cargan de forma perezosa 
y una sola vez por proceso para evitar afectar al 
rendimiento del servidor cuando no se utilizan
"""

import os
import random
import torch
from transformers import pipeline
from transformers.utils import logging as transformers_logging
transformers_logging.set_verbosity_error()

_pipeline_sentimiento = None
_pipeline_toxicidad = None

DEVICE = 0 if torch.cuda.is_available() else -1
if DEVICE == -1:
    torch.set_num_threads(max(1, os.cpu_count() or 1))

MODELO_SENTIMIENTO = "distilbert-base-uncased-finetuned-sst-2-english"
MODELO_TOXICIDAD = "unitary/toxic-bert"
MAX_LONGITUD_TOKENS = 128
UMBRAL_TOXICIDAD = 0.5
ETIQUETA_PRINCIPAL_TOXICIDAD = "toxic"
BATCH_SIZE_POR_DEFECTO = 64
LIMITE_COMENTARIOS_BERT = 3000

def _cargar_pipeline_sentimiento():
    global _pipeline_sentimiento
    if _pipeline_sentimiento is None:
        _pipeline_sentimiento = pipeline(
            "sentiment-analysis",
            model=MODELO_SENTIMIENTO,
            device=DEVICE,
            truncation=True,
            max_length=MAX_LONGITUD_TOKENS,
        )
        _cuantizar_si_procede(_pipeline_sentimiento)
    return _pipeline_sentimiento


def _cargar_pipeline_toxicidad():
    global _pipeline_toxicidad
    if _pipeline_toxicidad is None:
        _pipeline_toxicidad = pipeline(
            "text-classification",
            model=MODELO_TOXICIDAD,
            device=DEVICE,
            truncation=True,
            max_length=MAX_LONGITUD_TOKENS,
            top_k=None,
        )
        _cuantizar_si_procede(_pipeline_toxicidad)
    return _pipeline_toxicidad


def _cuantizar_si_procede(pipe):
    """Cuantización dinámica (int8) de las capas Linear cuando se corre en CPU.
    En CPU esto suele dar entre 2x y 4x de velocidad en inferencia con una
    pérdida de precisión insignificante para clasificación de texto. En GPU no
    se aplica (ahí la cuantización dinámica de torch no ayuda)."""
    if DEVICE == -1:
        pipe.model = torch.quantization.quantize_dynamic(
            pipe.model, {torch.nn.Linear}, dtype=torch.qint8
        )


def precargar_modelos():
    """Fuerza la descarga/carga (y cuantización) de ambos modelos por
    adelantado. Útil para llamarla una vez al arrancar el servidor (p.ej. en
    un evento 'startup' de FastAPI) y así evitar que la primera petición del
    análisis tarde de más mientras se descargan los pesos (varios cientos de
    MB) y se preparan los modelos."""
    _cargar_pipeline_sentimiento()
    _cargar_pipeline_toxicidad()


def seleccionar_indices_muestra(n_total, limite=LIMITE_COMENTARIOS_BERT, semilla=42):
    """Devuelve los índices (ordenados) que se van a analizar con BERT.
    Si `n_total` no supera el límite, se analizan todos. Si lo supera, se toma
    una muestra aleatoria reproducible de tamaño `limite`, para acotar el
    tiempo total sin sesgar hacia los primeros o últimos comentarios."""
    if n_total <= limite:
        return list(range(n_total))
    random.seed(semilla)
    return sorted(random.sample(range(n_total), limite))


def _en_lotes(lista, tamano=BATCH_SIZE_POR_DEFECTO):
    for i in range(0, len(lista), tamano):
        yield lista[i:i + tamano]


def analizar_sentimiento_lote(textos, batch_size=BATCH_SIZE_POR_DEFECTO):
    """Devuelve una lista de dicts {'label': 'POSITIVE'|'NEGATIVE'|'NEUTRAL', 'score': float}
    en el mismo orden que `textos`. Los textos vacíos/whitespace se marcan NEUTRAL
    sin pasar por el modelo (ahorra cómputo)."""
    if not textos:
        return []

    modelo = _cargar_pipeline_sentimiento()
    resultados = [{"label": "NEUTRAL", "score": 0.0} for _ in textos]
    indices_validos = [i for i, t in enumerate(textos) if t and t.strip()]
    if not indices_validos:
        return resultados

    textos_validos = [textos[i] for i in indices_validos]
    salidas = []
    for lote in _en_lotes(textos_validos, batch_size):
        salidas.extend(modelo(lote))

    for idx, salida in zip(indices_validos, salidas):
        resultados[idx] = {"label": salida["label"], "score": round(float(salida["score"]), 4)}

    return resultados


def analizar_toxicidad_lote(textos, batch_size=BATCH_SIZE_POR_DEFECTO):
    """Devuelve una lista de diccionarios, uno por cada texto de entrada, indicando 
    si es tóxico, su puntuación de toxicidad y las categorías que superan el umbral 
    junto con sus puntuaciones. Los textos vacíos se consideran automáticamente no 
    tóxicos y no se procesan con el modelo."""
    if not textos:
        return []

    modelo = _cargar_pipeline_toxicidad()
    resultados = [{"toxico": False, "score": 0.0, "categorias": {}} for _ in textos]
    indices_validos = [i for i, t in enumerate(textos) if t and t.strip()]
    if not indices_validos:
        return resultados

    textos_validos = [textos[i] for i in indices_validos]
    salidas = []
    for lote in _en_lotes(textos_validos, batch_size):
        salidas.extend(modelo(lote))

    for idx, etiquetas in zip(indices_validos, salidas):
        scores_por_etiqueta = {e["label"]: round(float(e["score"]), 4) for e in etiquetas}
        score_toxic = scores_por_etiqueta.get(ETIQUETA_PRINCIPAL_TOXICIDAD, 0.0)
        categorias_activas = {
            etiqueta: score for etiqueta, score in scores_por_etiqueta.items()
            if score >= UMBRAL_TOXICIDAD
        }
        resultados[idx] = {
            "toxico": score_toxic >= UMBRAL_TOXICIDAD,
            "score": score_toxic,
            "categorias": categorias_activas,
        }

    return resultados