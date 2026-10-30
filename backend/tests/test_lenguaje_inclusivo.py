"""
Tests de analisis/lenguaje_inclusivo.py
División de identificadores en sub-palabras, detección de términos no 
inclusivos, cálculo del score de inclusividad y el orquestador que 
analiza el código de varios repos.
"""
from analisis.lenguaje_inclusivo import (
    dividir_identificador, extraer_identificadores,
    analizar_identificadores_archivo, calcular_score_inclusividad,
    analizar_lenguaje_codigo,
)

class TestDividirIdentificador:

    def test_camel_case(self):
        assert dividir_identificador("whitelistUsers") == ["whitelist", "users"]

    def test_pascal_case(self):
        assert dividir_identificador("WhiteListUsers") == ["white", "list", "users"]

    def test_snake_case(self):
        assert dividir_identificador("white_list_users") == ["white", "list", "users"]

    def test_kebab_case(self):
        assert dividir_identificador("white-list-users") == ["white", "list", "users"]

    def test_sigla_seguida_de_palabra(self):
        assert dividir_identificador("HTTPServer") == ["http", "server"]

    def test_ignora_letras_sueltas(self):
        assert dividir_identificador("a_b_master") == ["master"]

    def test_identificador_vacio(self):
        assert dividir_identificador("") == []

class TestExtraerIdentificadores:

    def test_extrae_identificadores_de_codigo(self):
        codigo = "def whitelist_users(masterList):\n    return masterList"
        identificadores = extraer_identificadores(codigo)
        assert "whitelist_users" in identificadores
        assert "masterList" in identificadores
        assert "def" in identificadores

    def test_codigo_none_devuelve_lista_vacia(self):
        assert extraer_identificadores(None) == []

    def test_codigo_vacio_devuelve_lista_vacia(self):
        assert extraer_identificadores("") == []

class TestAnalizarIdentificadoresArchivo:

    def test_detecta_termino_no_inclusivo(self):
        hallazgos = analizar_identificadores_archivo("def whitelist_ips(): pass")
        terminos = {h["termino"] for h in hallazgos}
        assert "whitelist" in terminos
        hallazgo = next(h for h in hallazgos if h["termino"] == "whitelist")
        assert hallazgo["identificador"] == "whitelist_ips"
        assert hallazgo["categoria"] == "racial_historical"
        assert hallazgo["severidad"] == "high"
        assert "allowlist" in hallazgo["alternativas"]

    def test_codigo_sin_terminos_no_inclusivos_no_genera_hallazgos(self):
        assert analizar_identificadores_archivo("def calcular_total(precio, cantidad): return precio * cantidad") == []

    def test_detecta_bigrama(self):
        hallazgos = analizar_identificadores_archivo("def sanity_check_input(x): pass")
        terminos = {h["termino"] for h in hallazgos}
        assert "sanity check" in terminos

    def test_reutiliza_lemas_map_pasado_por_parametro(self):
        lemas_map = {"whitelist": "whitelist"}
        hallazgos = analizar_identificadores_archivo("whitelist = []", lemas_map=lemas_map)
        assert len(hallazgos) == 1
        assert hallazgos[0]["termino"] == "whitelist"

class TestCalcularScoreInclusividad:

    def test_sin_identificadores_score_maximo(self):
        assert calcular_score_inclusividad([], 0) == 100.0

    def test_sin_hallazgos_score_maximo(self):
        assert calcular_score_inclusividad([], 100) == 100.0

    def test_hallazgos_reducen_el_score(self):
        hallazgos = [{"severidad": "high"}, {"severidad": "medium"}]
        score = calcular_score_inclusividad(hallazgos, 10)
        assert 0.0 <= score < 100.0

    def test_score_nunca_es_negativo(self):
        hallazgos = [{"severidad": "high"} for _ in range(50)]
        assert calcular_score_inclusividad(hallazgos, 5) == 0.0

class TestAnalizarLenguajeCodigo:

    ARCHIVOS = [
        {"repo": "acme/web", "path": "a.py", "contenido": "def whitelist_hosts(): pass"},
        {"repo": "acme/web", "path": "b.py", "contenido": "def calcular_total(): pass"},
        {"repo": "acme/api", "path": "c.py", "contenido": "class MasterConfig: pass"},
    ]

    def test_resumen_archivos_incluye_todos_los_archivos(self):
        resultado = analizar_lenguaje_codigo(self.ARCHIVOS)
        paths = {(f["repo"], f["path"]) for f in resultado["resumenArchivos"]}
        assert paths == {("acme/web", "a.py"), ("acme/web", "b.py"), ("acme/api", "c.py")}

    def test_hallazgos_agregan_repo_y_path(self):
        resultado = analizar_lenguaje_codigo(self.ARCHIVOS)
        hallazgo = next(h for h in resultado["hallazgos"] if h["termino"] == "whitelist")
        assert hallazgo["repo"] == "acme/web"
        assert hallazgo["path"] == "a.py"

    def test_resumen_repos_agrupa_por_repo(self):
        resultado = analizar_lenguaje_codigo(self.ARCHIVOS)
        repos = {r["repo"] for r in resultado["resumenRepos"]}
        assert repos == {"acme/web", "acme/api"}

    def test_repo_sin_hallazgos_tiene_score_maximo(self):
        resultado = analizar_lenguaje_codigo([
            {"repo": "acme/limpio", "path": "a.py", "contenido": "def calcular_total(): pass"}
        ])
        repo_limpio = next(r for r in resultado["resumenRepos"] if r["repo"] == "acme/limpio")
        assert repo_limpio["scoreInclusividad"] == 100.0
        assert repo_limpio["hallazgos"] == 0

    def test_sin_archivos_devuelve_estructura_vacia(self):
        resultado = analizar_lenguaje_codigo([])
        assert resultado["hallazgos"] == []
        assert resultado["resumenRepos"] == []
        assert resultado["scoreGlobal"] == 100.0

    def test_terminos_mas_frecuentes_cuenta_ocurrencias(self):
        archivos = [
            {"repo": "r", "path": "a.py", "contenido": "whitelist_a = []"},
            {"repo": "r", "path": "b.py", "contenido": "whitelist_b = []"},
        ]
        resultado = analizar_lenguaje_codigo(archivos)
        assert resultado["terminosMasFrecuentes"]["whitelist"] == 2