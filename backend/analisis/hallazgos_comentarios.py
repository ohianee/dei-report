from analisis.nlp_motor import nlp, CODE_TONE_ADJECTIVES
from analisis.lenguaje_inclusivo import DICCIONARIO_LEMATIZADO, MAX_NGRAMA
from analisis.bert_motor import (
    analizar_toxicidad_lote, analizar_sentimiento_lote, seleccionar_indices_muestra
)

UMBRAL_NEGATIVIDAD_PARA_ESCALAR = 0.6
def _extraer_contexto(texto, start_char, end_char, padding=40):
    """
    Extrae una ventana de texto alrededor de la palabra encontrada,
    añadiendo puntos suspensivos si corta el texto original.
    """
    inicio = max(0, start_char - padding)
    fin = min(len(texto), end_char + padding)
    fragmento = texto[inicio:fin]
    fragmento = fragmento.replace('\n', ' ').replace('\r', '')
    
    if inicio > 0:
        fragmento = "..." + fragmento
    if fin < len(texto):
        fragmento = fragmento + "..."
        
    return fragmento.strip()

def analizar_hallazgos_comentarios(comentarios, usar_bert=True, sentimientos=None):
    """
    Analiza una lista de diccionarios de comentarios buscando:
    Detectar lenguaje no inclusivo y tono negativo mediante diccionarios, y 
    toxicidad real mediante BERT, capaz de identificar insultos, amenazas o 
    lenguaje agresivo aunque no contenga términos predefinidos. Para optimizar 
    el rendimiento, la toxicidad se evalúa solo en los comentarios previamente 
    clasificados como negativos, y permite reutilizar resultados de análisis de 
    sentimiento ya calculados para evitar procesar los mismos comentarios de nuevo.
    """
    hallazgos = []
    adjetivos_negativos = set(CODE_TONE_ADJECTIVES.get("Quality_Negative", []))
    textos = [c.get("body", "") for c in comentarios]
    docs = nlp.pipe(textos, batch_size=100, disable=["ner", "parser"])

    if usar_bert:
        indices_muestra = set(seleccionar_indices_muestra(len(textos)))

        if sentimientos is None:
            textos_para_sentimiento = [t if i in indices_muestra else "" for i, t in enumerate(textos)]
            sentimientos = analizar_sentimiento_lote(textos_para_sentimiento)

        indices_a_escalar = {
            i for i in indices_muestra
            if sentimientos[i] and sentimientos[i]["label"] == "NEGATIVE"
            and sentimientos[i]["score"] >= UMBRAL_NEGATIVIDAD_PARA_ESCALAR
        }
        textos_para_toxicidad = [t if i in indices_a_escalar else "" for i, t in enumerate(textos)]
        resultados_toxicidad = analizar_toxicidad_lote(textos_para_toxicidad)
    else:
        resultados_toxicidad = [None] * len(comentarios)

    for comentario, doc, toxicidad in zip(comentarios, docs, resultados_toxicidad):
        texto_original = comentario.get("body", "")
        repo = comentario.get("repo", "Desconocido")
        author = comentario.get("author", "Desconocido")
        tokens = [t for t in doc if t.is_alpha]
        n_tokens = len(tokens)
        
        if n_tokens == 0:
            continue

        for tam_ngrama in range(1, MAX_NGRAMA + 1):
            for i in range(n_tokens - tam_ngrama + 1):
                ngrama_tokens = tokens[i:i + tam_ngrama]
                ngrama_lemas = tuple(t.lemma_.lower() for t in ngrama_tokens)
                
                if ngrama_lemas in DICCIONARIO_LEMATIZADO:
                    info = DICCIONARIO_LEMATIZADO[ngrama_lemas]
                    start_char = ngrama_tokens[0].idx
                    end_char = ngrama_tokens[-1].idx + len(ngrama_tokens[-1].text)
                    
                    hallazgos.append({
                        "repo": repo,
                        "author": author,
                        "tipo": "non_inclusive",
                        "termino": " ".join(ngrama_lemas),
                        "categoria": info["categoria"],
                        "severidad": info["severidad"],
                        "alternativas": ", ".join(info["alternativas"]),
                        "contexto": _extraer_contexto(texto_original, start_char, end_char)
                    })

        for token in tokens:
            lema = token.lemma_.lower()
            if token.pos_ == "ADJ" and lema in adjetivos_negativos:
                start_char = token.idx
                end_char = token.idx + len(token.text)
                
                hallazgos.append({
                    "repo": repo,
                    "author": author,
                    "tipo": "negative_tone",
                    "termino": lema,
                    "categoria": "negative_quality",
                    "severidad": "medium",
                    "alternativas": "review_constructiveness",
                    "contexto": _extraer_contexto(texto_original, start_char, end_char)
                })

        if usar_bert and toxicidad and toxicidad["toxico"]:
            categoria_principal = max(toxicidad["categorias"], key=toxicidad["categorias"].get)
            severidad = "high" if toxicidad["score"] >= 0.8 else "medium"
            fragmento = texto_original.replace("\n", " ").replace("\r", "").strip()
            if len(fragmento) > 200:
                fragmento = fragmento[:200] + "..."

            hallazgos.append({
                "repo": repo,
                "author": author,
                "tipo": "toxicity",
                "termino": categoria_principal,
                "categoria": "toxicity_model",
                "score": round(toxicidad["score"], 2),
                "severidad": severidad,
                "alternativas": "review_toxic_tone",
                "contexto": fragmento
            })

    return hallazgos