"""
Pool de PROCESOS (no de hilos) para ejecutar los análisis DEI pesados en CPU.
Se utiliza un `ProcessPoolExecutor` para ejecutar los análisis DEI intensivos 
en CPU en procesos independientes, evitando que el GIL bloquee el servidor 
FastAPI/Uvicorn y permitiendo atender otras peticiones mientras se procesan 
los repositorios. Además, varios análisis pueden ejecutarse realmente en 
paralelo en distintos núcleos. Los modelos pesados como BERT y spaCy se cargan 
una sola vez por proceso y se precargan al iniciar el pool para evitar el coste 
de carga durante el primer análisis.
"""
import multiprocessing
import os
from concurrent.futures import ProcessPoolExecutor

_MAX_ANALISIS_EN_PARALELO = max(1, min(4, (os.cpu_count() or 2) - 1))
_pool: ProcessPoolExecutor | None = None

def _inicializar_worker():
    """Se ejecuta una única vez por proceso worker, al arrancar el pool.
    Precarga los modelos pesados (BERT) para que el primer análisis que le
    toque a ese worker no tenga que esperar a descargarlos/cargarlos."""
    from analisis.bert_motor import precargar_modelos
    precargar_modelos()

def iniciar_pool_analisis() -> ProcessPoolExecutor:
    """Crea (si no existe ya) el pool de procesos usado para los análisis.
    Debe llamarse una única vez, en el evento de arranque de la app."""
    global _pool
    if _pool is None:
        contexto = multiprocessing.get_context("spawn")
        _pool = ProcessPoolExecutor(
            max_workers=_MAX_ANALISIS_EN_PARALELO,
            mp_context=contexto,
            initializer=_inicializar_worker,
        )
    return _pool

def obtener_pool_analisis() -> ProcessPoolExecutor:
    if _pool is None:
        raise RuntimeError(
            "El pool de análisis no se ha inicializado todavía "
            "(iniciar_pool_analisis() debe llamarse en el startup de la app)."
        )
    return _pool

def cerrar_pool_analisis():
    """Cierra el pool de forma ordenada. Los análisis en curso terminan de
    ejecutarse; no se aceptan análisis nuevos a partir de este punto."""
    global _pool
    if _pool is not None:
        _pool.shutdown(wait=False, cancel_futures=False)
        _pool = None