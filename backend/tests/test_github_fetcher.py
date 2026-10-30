"""
Tests de analisis/github_fetcher.py
Descarga de comentarios y código de GitHub. La sesión HTTP 
real (`session`) se sustituye por un doble de prueba para no hacer 
llamadas de red; el zip de código se construye en memoria.
"""
import io
import zipfile
import analisis.github_fetcher as github_fetcher
from analisis.github_fetcher import (
    fetch_github_comments, obtener_repos_org, obtener_rama_default,
    fetch_github_codigo, fetch_repo_completo, descargar_datos_repos,
)

class FakeResponse:
    def __init__(self, status_code=200, json_data=None, content=b"", headers=None, text=""):
        self.status_code = status_code
        self._json_data = json_data if json_data is not None else []
        self.content = content
        self.headers = headers or {}
        self.text = text

    def json(self):
        return self._json_data

class FakeSession:
    def __init__(self, respuestas):
        """`respuestas`: lista de FakeResponse, se van consumiendo por orden
        en cada llamada a `get`, o un callable(url) -> FakeResponse."""
        self._respuestas = respuestas
        self.urls_llamadas = []

    def get(self, url):
        self.urls_llamadas.append(url)
        if callable(self._respuestas):
            return self._respuestas(url)
        return self._respuestas.pop(0)

class TestFetchGithubComments:

    def test_junta_comentarios_de_issues_y_prs(self, monkeypatch):
        respuestas = [
            FakeResponse(json_data=[{"body": "hola", "user": {"login": "ana"}}]),
            FakeResponse(json_data=[{"body": "pr comment", "user": {"login": "bob"}}]),
        ]
        monkeypatch.setattr(github_fetcher, "session", FakeSession(respuestas))
        comentarios = fetch_github_comments("acme", "web", max_pages=1)

        assert len(comentarios) == 2
        assert comentarios[0] == {"repo": "acme/web", "author": "ana", "body": "hola"}
        assert comentarios[1] == {"repo": "acme/web", "author": "bob", "body": "pr comment"}

    def test_para_si_una_pagina_devuelve_vacio(self, monkeypatch):
        respuestas = [FakeResponse(json_data=[]), FakeResponse(json_data=[])]
        monkeypatch.setattr(github_fetcher, "session", FakeSession(respuestas))

        comentarios = fetch_github_comments("acme", "web", max_pages=5)
        assert comentarios == []

    def test_error_http_detiene_ese_endpoint(self, monkeypatch):
        respuestas = [FakeResponse(status_code=404, text="not found"), FakeResponse(json_data=[])]
        monkeypatch.setattr(github_fetcher, "session", FakeSession(respuestas))

        comentarios = fetch_github_comments("acme", "web", max_pages=3)
        assert comentarios == []

    def test_autor_desconocido_si_falta_el_usuario(self, monkeypatch):
        respuestas = [
            FakeResponse(json_data=[{"body": "hola"}]),
            FakeResponse(json_data=[]),
            FakeResponse(json_data=[]),
            FakeResponse(json_data=[]),
        ]
        monkeypatch.setattr(github_fetcher, "session", FakeSession(respuestas))

        comentarios = fetch_github_comments("acme", "web", max_pages=1)
        assert comentarios[0]["author"] == "desconocido"

class TestObtenerReposOrg:

    def test_devuelve_repos_de_la_org(self, monkeypatch):
        respuestas = [
            FakeResponse(json_data=[{"name": "web"}, {"name": "api"}]),
            FakeResponse(json_data=[]),
        ]
        monkeypatch.setattr(github_fetcher, "session", FakeSession(respuestas))

        repos = obtener_repos_org("acme", max_repos=10)
        assert repos == [{"owner": "acme", "repo": "web"}, {"owner": "acme", "repo": "api"}]

    def test_respeta_el_limite_max_repos(self, monkeypatch):
        respuestas = [FakeResponse(json_data=[{"name": f"repo{i}"} for i in range(20)])]
        monkeypatch.setattr(github_fetcher, "session", FakeSession(respuestas))

        repos = obtener_repos_org("acme", max_repos=5)
        assert len(repos) == 5

    def test_error_http_devuelve_lista_vacia(self, monkeypatch):
        monkeypatch.setattr(github_fetcher, "session", FakeSession([FakeResponse(status_code=500)]))
        assert obtener_repos_org("acme") == []

class TestObtenerRamaDefault:

    def test_devuelve_la_rama_default(self, monkeypatch):
        monkeypatch.setattr(
            github_fetcher, "session",
            FakeSession([FakeResponse(json_data={"default_branch": "develop"})])
        )
        assert obtener_rama_default("acme", "web") == "develop"

    def test_error_http_devuelve_none(self, monkeypatch):
        monkeypatch.setattr(github_fetcher, "session", FakeSession([FakeResponse(status_code=404)]))
        assert obtener_rama_default("acme", "web") is None

def _crear_zip_fake(archivos: dict) -> bytes:
    """archivos: {ruta_dentro_del_zip: contenido_str}"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as z:
        for ruta, contenido in archivos.items():
            z.writestr(f"acme-web-abc123/{ruta}", contenido)
    return buffer.getvalue()

class TestFetchGithubCodigo:

    def test_filtra_por_extension_y_quita_prefijo_del_zip(self, monkeypatch):
        zip_bytes = _crear_zip_fake({
            "src/main.py": "print(1)",
            "README.md": "hola",
        })
        monkeypatch.setattr(github_fetcher, "session", FakeSession([
            FakeResponse(json_data={"default_branch": "main"}),
            FakeResponse(content=zip_bytes),
        ]))

        archivos = fetch_github_codigo("acme", "web")

        assert len(archivos) == 1
        assert archivos[0]["path"] == "src/main.py"
        assert archivos[0]["contenido"] == "print(1)"
        assert archivos[0]["repo"] == "acme/web"

    def test_excluye_carpetas_no_deseadas(self, monkeypatch):
        zip_bytes = _crear_zip_fake({
            "src/main.py": "print(1)",
            "node_modules/lib.js": "var x = 1;",
        })
        monkeypatch.setattr(github_fetcher, "session", FakeSession([
            FakeResponse(json_data={"default_branch": "main"}),
            FakeResponse(content=zip_bytes),
        ]))

        archivos = fetch_github_codigo("acme", "web")
        assert all("node_modules" not in a["path"] for a in archivos)

    def test_sin_rama_default_devuelve_lista_vacia(self, monkeypatch):
        monkeypatch.setattr(github_fetcher, "session", FakeSession([FakeResponse(status_code=404)]))
        assert fetch_github_codigo("acme", "web") == []

    def test_error_descargando_zip_devuelve_lista_vacia(self, monkeypatch):
        monkeypatch.setattr(github_fetcher, "session", FakeSession([
            FakeResponse(json_data={"default_branch": "main"}),
            FakeResponse(status_code=500),
        ]))
        assert fetch_github_codigo("acme", "web") == []

    def test_zip_invalido_no_lanza_excepcion(self, monkeypatch):
        monkeypatch.setattr(github_fetcher, "session", FakeSession([
            FakeResponse(json_data={"default_branch": "main"}),
            FakeResponse(content=b"esto no es un zip"),
        ]))
        assert fetch_github_codigo("acme", "web") == []

class TestDescargaCompleta:

    def test_fetch_repo_completo_junta_comentarios_y_codigo(self, monkeypatch):
        monkeypatch.setattr(github_fetcher, "fetch_github_comments",
                             lambda owner, repo, max_pages=5, sesion_http=None: [{"repo": f"{owner}/{repo}", "author": "a", "body": "hola"}])
        monkeypatch.setattr(github_fetcher, "fetch_github_codigo",
                             lambda owner, repo, sesion_http=None: [{"repo": f"{owner}/{repo}", "path": "a.py", "contenido": "x"}])

        resultado = fetch_repo_completo("acme", "web")

        assert resultado["owner"] == "acme"
        assert resultado["repo"] == "web"
        assert len(resultado["comentarios"]) == 1
        assert len(resultado["codigo"]) == 1

    def test_descargar_datos_repos_mantiene_el_orden_de_entrada(self, monkeypatch):
        def fake_fetch(owner, repo, max_pages_comentarios=2, sesion_http=None):
            return {"owner": owner, "repo": repo, "comentarios": [], "codigo": []}

        monkeypatch.setattr(github_fetcher, "fetch_repo_completo", fake_fetch)

        repos = [{"owner": "acme", "repo": "a"}, {"owner": "acme", "repo": "b"}, {"owner": "acme", "repo": "c"}]
        resultados = descargar_datos_repos(repos, max_workers=3)

        assert [r["repo"] for r in resultados] == ["a", "b", "c"]

    def test_descargar_datos_repos_invoca_callback_de_progreso(self, monkeypatch):
        monkeypatch.setattr(
            github_fetcher, "fetch_repo_completo",
            lambda owner, repo, max_pages_comentarios=2, sesion_http=None: {"owner": owner, "repo": repo, "comentarios": [], "codigo": []}
        )

        llamadas = []
        repos = [{"owner": "acme", "repo": "a"}, {"owner": "acme", "repo": "b"}]
        descargar_datos_repos(repos, callback_progreso=lambda completados, total, resultado: llamadas.append((completados, total)))

        assert len(llamadas) == 2
        assert llamadas[-1] == (2, 2)

    def test_descargar_datos_repos_no_falla_si_un_repo_lanza_excepcion(self, monkeypatch):
        def fake_fetch(owner, repo, max_pages_comentarios=2, sesion_http=None):
            if repo == "roto":
                raise Exception("fallo de red")
            return {"owner": owner, "repo": repo, "comentarios": [], "codigo": []}

        monkeypatch.setattr(github_fetcher, "fetch_repo_completo", fake_fetch)

        repos = [{"owner": "acme", "repo": "ok"}, {"owner": "acme", "repo": "roto"}]
        resultados = descargar_datos_repos(repos)

        assert resultados[0]["repo"] == "ok"
        assert resultados[1] == {"owner": "acme", "repo": "roto", "comentarios": [], "codigo": []}