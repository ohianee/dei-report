"""
Análisis de lenguaje inclusivo en el código fuente (identificadores).
Como indicador adicional de diversidad y DEI. Extrae los identificadores 
mediante expresiones regulares, los divide en subpalabras y lematiza con 
spaCy para detectar variantes, y compara unigramas y bigramas con un 
diccionario de términos no inclusivos. A partir de estos resultados 
calcula un score de inclusividad de 0 a 100 por repositorio. Es un 
análisis léxico ligero, por lo que puede generar falsos positivos y no 
sustituye a un linter o parser específico del lenguaje.
"""

import re
from collections import Counter
from analisis.nlp_motor import nlp

RE_IDENTIFICADOR = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
RE_CAMEL = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")

def dividir_identificador(identificador):
    """camelCase / PascalCase / snake_case / kebab-case -> sub-palabras en minúscula."""
    partes = identificador.replace("-", "_").split("_")
    subpalabras = []
    for parte in partes:
        if not parte:
            continue
        for trozo in RE_CAMEL.sub("_", parte).split("_"):
            trozo = trozo.strip().lower()
            if trozo.isalpha() and len(trozo) > 1:
                subpalabras.append(trozo)
    return subpalabras

def extraer_identificadores(codigo_fuente):
    """Lista de identificadores 'crudos' (sin dividir) encontrados en un archivo."""
    return RE_IDENTIFICADOR.findall(codigo_fuente or "")

TERMINOS_NO_INCLUSIVOS = {
    ("whitelist",):        {"categoria": "racial_historical", "severidad": "high",   "alternativas": ["allowlist", "permitlist"]},
    ("blacklist",):        {"categoria": "racial_historical", "severidad": "high",   "alternativas": ["denylist", "blocklist"]},
    ("master",):           {"categoria": "slavery_historical", "severidad": "medium", "alternativas": ["primary", "main", "leader"]},
    ("slave",):            {"categoria": "slavery_historical", "severidad": "high",   "alternativas": ["replica", "secondary", "follower", "worker"]},
    ("grandfather",):      {"categoria": "racial_historical", "severidad": "medium", "alternativas": ["legacy", "exempt"]},
    ("sanity", "check"):   {"categoria": "ableism", "severidad": "medium", "alternativas": ["confidence check", "coherence check"]},
    ("sane",):             {"categoria": "ableism", "severidad": "low",    "alternativas": ["valid", "consistent"]},
    ("crazy",):            {"categoria": "ableism", "severidad": "low",    "alternativas": ["unexpected", "surprising"]},
    ("insane",):           {"categoria": "ableism", "severidad": "low",    "alternativas": ["extreme", "surprising"]},
    ("cripple",):          {"categoria": "ableism", "severidad": "high",   "alternativas": ["degrade", "impair"]},
    ("handicap",):         {"categoria": "ableism", "severidad": "high",   "alternativas": ["limitation", "constraint"]},
    ("dummy",):            {"categoria": "ableism", "severidad": "medium", "alternativas": ["placeholder", "sample"]},
    ("guy",):              {"categoria": "gender", "severidad": "low",    "alternativas": ["folks", "everyone", "team"]},
    ("man", "hour"):       {"categoria": "gender", "severidad": "low",    "alternativas": ["person-hour", "work-hour"]},
    ("chairman",):         {"categoria": "gender", "severidad": "medium", "alternativas": ["chairperson", "chair"]},
    ("manpower",):         {"categoria": "gender", "severidad": "low",    "alternativas": ["workforce", "staff"]},
    ("mankind",):          {"categoria": "gender", "severidad": "low",    "alternativas": ["humankind", "humanity"]},
}

def _lematizar_palabras(lista_palabras):
    """Lematiza una lista de palabras sueltas con spaCy (lemas en minúscula)."""
    if not lista_palabras:
        return []
    docs = nlp.pipe(lista_palabras)
    return [doc[0].lemma_.lower() if len(doc) else palabra for doc, palabra in zip(docs, lista_palabras)]

def _construir_diccionario_lematizado():
    todas_las_palabras_clave = sorted({palabra for clave in TERMINOS_NO_INCLUSIVOS for palabra in clave})
    lemas = dict(zip(todas_las_palabras_clave, _lematizar_palabras(todas_las_palabras_clave)))
    diccionario = {
        tuple(lemas[palabra] for palabra in clave): info
        for clave, info in TERMINOS_NO_INCLUSIVOS.items()
    }
    max_ngrama = max(len(clave) for clave in diccionario)
    return diccionario, max_ngrama

DICCIONARIO_LEMATIZADO, MAX_NGRAMA = _construir_diccionario_lematizado()
PESO_SEVERIDAD = {"high": 3, "medium": 2, "low": 1}

def _buscar_coincidencias(subpalabras_lematizadas):
    encontrados = []
    n = len(subpalabras_lematizadas)
    for tam_ngrama in range(1, MAX_NGRAMA + 1):
        for i in range(n - tam_ngrama + 1):
            ngrama = tuple(subpalabras_lematizadas[i:i + tam_ngrama])
            if ngrama in DICCIONARIO_LEMATIZADO:
                encontrados.append(ngrama)
    return encontrados

def analizar_identificadores_archivo(codigo_fuente, lemas_map=None):
    """Devuelve una lista de hallazgos: {identificador, termino, categoria, severidad, alternativas}.

    `lemas_map`: dict opcional {subpalabra: lema} ya calculado globalmente para todo
    el análisis (ver `analizar_lenguaje_codigo`). Si no se pasa, se calcula aquí
    mismo (más lento: dispara una llamada a spaCy por archivo)."""
    identificadores = set(extraer_identificadores(codigo_fuente))
    hallazgos = []

    mapa_subpalabras = {ident: dividir_identificador(ident) for ident in identificadores}
    todas_subpalabras = sorted({p for subs in mapa_subpalabras.values() for p in subs})
    if not todas_subpalabras:
        return hallazgos

    if lemas_map is None:
        lemas_map = dict(zip(todas_subpalabras, _lematizar_palabras(todas_subpalabras)))

    for identificador, subpalabras in mapa_subpalabras.items():
        if not subpalabras:
            continue
        lemas = [lemas_map[p] for p in subpalabras]
        for ngrama in _buscar_coincidencias(lemas):
            info = DICCIONARIO_LEMATIZADO[ngrama]
            hallazgos.append({
                "identificador": identificador,
                "termino": " ".join(ngrama),
                "categoria": info["categoria"],
                "severidad": info["severidad"],
                "alternativas": ", ".join(info["alternativas"]),
            })
    return hallazgos

def calcular_score_inclusividad(hallazgos_repo, n_identificadores_repo):
    if n_identificadores_repo == 0:
        return 100.0
    penalizacion = sum(PESO_SEVERIDAD[h["severidad"]] for h in hallazgos_repo)
    densidad_ponderada = penalizacion / n_identificadores_repo * 1000
    score = max(0.0, 100.0 - densidad_ponderada * 5)
    return round(score, 1)

def analizar_lenguaje_codigo(archivos_por_repo):
    """
    Recibe los archivos de código de todos los repositorios y devuelve un análisis 
    estructurado de inclusividad. Incluye los hallazgos individuales detectados, 
    resúmenes por archivo y repositorio con métricas como densidad y score de 
    inclusividad, y agregados globales por categorías y términos más frecuentes, 
    además de un `scoreGlobal` que combina los resultados de todos los repositorios.
    """
    hallazgos = []
    resumen_archivos = []
    datos_por_archivo = []

    todas_las_subpalabras = set()
    for archivo in archivos_por_repo:
        contenido = archivo.get("contenido", "")
        identificadores = set(extraer_identificadores(contenido))
        mapa_subpalabras = {ident: dividir_identificador(ident) for ident in identificadores}
        for subs in mapa_subpalabras.values():
            todas_las_subpalabras.update(subs)
        datos_por_archivo.append((archivo, identificadores, mapa_subpalabras))

    subpalabras_ordenadas = sorted(todas_las_subpalabras)
    lemas_map_global = dict(zip(subpalabras_ordenadas, _lematizar_palabras(subpalabras_ordenadas)))

    for archivo, identificadores, mapa_subpalabras in datos_por_archivo:
        hallazgos_archivo = []
        for identificador, subpalabras in mapa_subpalabras.items():
            if not subpalabras:
                continue
            lemas = [lemas_map_global[p] for p in subpalabras]
            for ngrama in _buscar_coincidencias(lemas):
                info = DICCIONARIO_LEMATIZADO[ngrama]
                hallazgos_archivo.append({
                    "identificador": identificador,
                    "termino": " ".join(ngrama),
                    "categoria": info["categoria"],
                    "severidad": info["severidad"],
                    "alternativas": ", ".join(info["alternativas"]),
                })

        resumen_archivos.append({
            "repo": archivo["repo"],
            "path": archivo["path"],
            "n_identificadores": len(identificadores),
            "n_hallazgos": len(hallazgos_archivo),
        })

        for h in hallazgos_archivo:
            hallazgos.append({"repo": archivo["repo"], "path": archivo["path"], **h})

    repos = sorted({fila["repo"] for fila in resumen_archivos})
    resumen_repos = []
    for repo in repos:
        hallazgos_repo = [h for h in hallazgos if h["repo"] == repo]
        n_ident_repo = sum(f["n_identificadores"] for f in resumen_archivos if f["repo"] == repo)
        n_archivos_repo = sum(1 for f in resumen_archivos if f["repo"] == repo)

        conteo_categoria = Counter(h["categoria"] for h in hallazgos_repo)
        conteo_severidad = Counter(h["severidad"] for h in hallazgos_repo)

        resumen_repos.append({
            "repo": repo,
            "archivosAnalizados": n_archivos_repo,
            "identificadoresAnalizados": n_ident_repo,
            "hallazgos": len(hallazgos_repo),
            "densidadPor1000Ids": round(len(hallazgos_repo) / max(n_ident_repo, 1) * 1000, 2),
            "scoreInclusividad": calcular_score_inclusividad(hallazgos_repo, n_ident_repo),
            "hallazgosPorCategoria": dict(conteo_categoria),
            "hallazgosPorSeveridad": dict(conteo_severidad),
        })

    resumen_repos.sort(key=lambda r: r["scoreInclusividad"])

    total_identificadores = sum(f["n_identificadores"] for f in resumen_archivos)
    score_global = calcular_score_inclusividad(hallazgos, total_identificadores)

    conteo_categoria_global = Counter(h["categoria"] for h in hallazgos)
    conteo_termino_global = Counter(h["termino"] for h in hallazgos)

    return {
        "hallazgos": hallazgos,
        "resumenArchivos": resumen_archivos,
        "resumenRepos": resumen_repos,
        "scoreGlobal": score_global,
        "identificadoresAnalizados": total_identificadores,
        "hallazgosPorCategoria": dict(conteo_categoria_global),
        "terminosMasFrecuentes": dict(conteo_termino_global.most_common(15)),
    }