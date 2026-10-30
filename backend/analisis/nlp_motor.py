import re
from math import log2
from collections import Counter
import spacy
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    import spacy.cli
    spacy.cli.download("en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

BIG_FIVE_ADJECTIVES = {
    "Extraversion": ["talkative", "energetic", "outgoing", "assertive", "sociable", "bold", "active", "enthusiastic", "spontaneous", "adventurous"],
    "Agreeableness": ["kind", "cooperative", "sympathetic", "warm", "considerate", "helpful", "polite", "generous", "trustful", "gentle"],
    "Conscientiousness": ["organized", "careful", "reliable", "responsible", "precise", "thorough", "efficient", "disciplined", "practical", "systematic"],
    "Neuroticism": ["anxious", "moody", "nervous", "insecure", "tense", "irritable", "touchy", "fearful", "unstable", "worried"],
    "Openness": ["creative", "curious", "imaginative", "original", "insightful", "inventive", "artistic", "complex", "intellectual", "philosophical"]
}
CODE_TONE_ADJECTIVES = {
    "Quality_Positive": ["good", "excellent", "great", "nice", "clean", "elegant", "solid", "correct", "robust", "valid", "useful", "efficient", "reliable", "beautiful", "perfect", "consistent", "proper", "sane", "wonderful"],
    "Quality_Negative": ["wrong", "bad", "broken", "messy", "sloppy", "buggy", "hacky", "fragile", "invalid", "unnecessary", "redundant", "weird"],
    "Complexity": ["simple", "easy", "complex", "complicated", "trivial", "straightforward", "tricky", "hard", "advanced", "elaborate"],
    "Certainty": ["sure", "certain", "clear", "explicit", "obvious", "ambiguous", "unclear", "confusing", "uncertain", "implicit", "likely", "true", "exact"],
    "Emotional_Tone": ["happy", "awesome", "glad", "interesting", "confusing", "hesitant", "welcome", "sorry", "honest", "aware"],
    "Politeness_Agreeableness": ["helpful", "kind", "polite", "considerate", "respectful", "acceptable", "reasonable", "preferred", "appropriate"]
}

def limpiar_texto(texto):
    texto = re.sub(r"```.*?```", " ", texto, flags=re.DOTALL)
    texto = re.sub(r"`[^`]*`", " ", texto)
    texto = re.sub(r"http\S+|www\.\S+", " ", texto)
    texto = re.sub(r"[@#]\w+", " ", texto)
    texto = re.sub(r"[^A-Za-z\s]", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()

def extraer_adjetivos(texto):
    doc = nlp(texto)
    return [token.lemma_.lower() for token in doc if token.pos_ == "ADJ" and token.is_alpha]

def extraer_adjetivos_lote(textos):
    """Procesa una lista de textos en bloque, mucho más rápido que uno por uno."""
    resultados = []
    for doc in nlp.pipe(textos, batch_size=100, disable=["ner", "parser"]):
        resultados.append([token.lemma_.lower() for token in doc if token.pos_ == "ADJ" and token.is_alpha])
    return resultados

def entropia_shannon(frecuencias):
    total = sum(frecuencias.values())
    if total == 0: return 0.0
    probs = [f / total for f in frecuencias.values()]
    return -sum(p * log2(p) for p in probs if p > 0)

def indice_simpson(frecuencias):
    total = sum(frecuencias.values())
    if total <= 1: return 0.0
    return 1 - sum(f * (f - 1) for f in frecuencias.values()) / (total * (total - 1))