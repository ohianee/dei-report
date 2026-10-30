import os
from llama_cpp import Llama

_llm = None
STOP_TOKENS = ["<|end|>", "<|user|>", "<|assistant|>", "<|system|>"]

def cargar_llm():
    global _llm
    if _llm is None:
        ruta_actual = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        ruta_modelo = os.path.join(ruta_actual, "modelos_ia", "phi-3-mini.gguf")

        if not os.path.exists(ruta_modelo):
            raise FileNotFoundError(f"No se encontró el modelo en {ruta_modelo}. Debes descargarlo primero.")

        _llm = Llama(
            model_path=ruta_modelo,
            n_ctx=4096,
            n_threads=max(1, os.cpu_count() - 1),
            verbose=False
        )
    return _llm


def construir_prompt(prompt_sistema: str, historial: list, nuevo_mensaje: str) -> str:
    """Construye el prompt en el formato de chat nativo de Phi-3, en vez de
    delegar en la plantilla que llama-cpp-python intenta adivinar a partir de
    los metadatos del GGUF. Cada turno se envuelve como <|rol|>\\ncontenido<|end|>
    y se deja abierto el turno "<|assistant|>" al final para que el modelo
    continúe la generación justo ahí, tal y como especifica la tarjeta del
    modelo en Hugging Face."""
    partes = [f"<|system|>\n{prompt_sistema}<|end|>\n"]

    historial_recortado = historial[-4:] if len(historial) > 4 else historial
    for msj in historial_recortado:
        partes.append(f"<|{msj.role}|>\n{msj.content}<|end|>\n")

    partes.append(f"<|user|>\n{nuevo_mensaje}<|end|>\n")
    partes.append("<|assistant|>\n")
    return "".join(partes)


def generar_respuesta(prompt_sistema: str, historial: list, nuevo_mensaje: str) -> str:
    """Envía el contexto y la conversación al LLM y devuelve la respuesta completa
    de una sola vez (usado por el resto de la aplicación fuera del endpoint de
    chat, y en los tests)."""
    llm = cargar_llm()
    prompt = construir_prompt(prompt_sistema, historial, nuevo_mensaje)

    respuesta = llm.create_completion(
        prompt=prompt,
        max_tokens=450,
        temperature=0.2,
        stop=STOP_TOKENS
    )

    return respuesta["choices"][0]["text"].strip()


def generar_respuesta_stream(prompt_sistema: str, historial: list, nuevo_mensaje: str):
    """Igual que generar_respuesta, pero como generador: cede cada fragmento
    de texto tan pronto como el modelo lo produce, en vez de esperar a tener
    la respuesta completa. Se usa desde el endpoint de chat para poder
    devolver la respuesta al frontend token a token (streaming) y así reducir
    la sensación de espera, aunque el tiempo total de inferencia sea el mismo."""
    llm = cargar_llm()
    prompt = construir_prompt(prompt_sistema, historial, nuevo_mensaje)

    flujo = llm.create_completion(
        prompt=prompt,
        max_tokens=450,
        temperature=0.2,
        stop=STOP_TOKENS,
        stream=True
    )

    for fragmento in flujo:
        texto = fragmento["choices"][0]["text"]
        if texto:
            yield texto