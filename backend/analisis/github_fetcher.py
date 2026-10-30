import requests
import time
import os
import zipfile
import io
import concurrent.futures
from dotenv import load_dotenv

load_dotenv("token.env")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
session = requests.Session()
if GITHUB_TOKEN:
    session.headers.update({"Authorization": f"token {GITHUB_TOKEN}"})

def crear_sesion_github(token_usuario: str | None = None) -> requests.Session:
    """Crea la sesión de requests a usar en un análisis concreto.

    Si el usuario ha vinculado su cuenta de GitHub, `token_usuario` es su
    token personal y se usa una sesión NUEVA con él (así cada análisis
    ve exactamente lo que ese usuario ve en GitHub, incluidos sus privados
    y organizaciones). Si no, se reutiliza la sesión compartida de la app.
    """
    if not token_usuario:
        return session
    sesion_usuario = requests.Session()
    sesion_usuario.headers.update({"Authorization": f"token {token_usuario}"})
    return sesion_usuario

EXTENSIONES_CODIGO = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rb", ".php",
    ".c", ".h", ".cpp", ".hpp", ".cs", ".rs", ".kt", ".swift", ".scala",
}
CARPETAS_EXCLUIDAS = {
    "node_modules", "vendor", "dist", "build", ".git", "__pycache__",
    "venv", ".venv", "third_party", "migrations", "coverage",
}
MAX_TAMANO_ARCHIVO_KB = 500

def fetch_github_comments(owner, repo, max_pages=5, per_page=100, sesion_http=None):
    sesion_http = sesion_http or session
    comments = []
    base_url = f"https://api.github.com/repos/{owner}/{repo}"
    endpoints = [("issues/comments", "issue"), ("pulls/comments", "pr_review")]

    for endpoint, tipo in endpoints:
        for page in range(1, max_pages + 1):
            url = f"{base_url}/{endpoint}?per_page={per_page}&page={page}"
            resp = sesion_http.get(url)

            if resp.status_code != 200:
                print(f"[github_fetcher] Error {resp.status_code}: {resp.text[:200]}")
                break
            data = resp.json()

            if not data:
                break
            
            for item in data:
                body = item.get("body") or ""
                author = (item.get("user") or {}).get("login", "desconocido")
                comments.append({
                    "repo": f"{owner}/{repo}",
                    "author": author,
                    "body": body
                })

            restante = resp.headers.get("X-RateLimit-Remaining")
            if restante is not None and int(restante) < 3:
                time.sleep(1.0)
    return comments

def obtener_repos_usuario(sesion_http, max_repos=200):
    """Lista los repos a los que el usuario dueño de `sesion_http` tiene acceso
    (propios, como colaborador, y de sus organizaciones), incluidos privados.
    Requiere una sesión creada con el token PERSONAL del usuario (ver
    `crear_sesion_github`); con el token compartido de la app esto listaría
    los repos de la cuenta de servicio, no los del usuario."""
    repos = []
    page = 1
    while len(repos) < max_repos:
        url = (
            "https://api.github.com/user/repos"
            f"?per_page=100&page={page}&affiliation=owner,collaborator,organization_member&sort=updated"
        )
        r = sesion_http.get(url)
        if r.status_code != 200:
            print(f"[github_fetcher] Error {r.status_code} listando repos del usuario: {r.text[:200]}")
            break
        data = r.json()
        if not data:
            break
        for repo in data:
            repos.append({
                "owner": repo["owner"]["login"],
                "repo": repo["name"],
                "privado": repo.get("private", False),
                "descripcion": repo.get("description"),
            })
        page += 1
    return repos[:max_repos]


def obtener_orgs_usuario(sesion_http):
    """Lista las organizaciones a las que pertenece el usuario dueño de
    `sesion_http` (requiere el scope `read:org` concedido en el OAuth)."""
    orgs = []
    r = sesion_http.get("https://api.github.com/user/orgs?per_page=100")
    if r.status_code != 200:
        print(f"[github_fetcher] Error {r.status_code} listando orgs del usuario: {r.text[:200]}")
        return orgs
    for org in r.json():
        orgs.append({"login": org["login"], "descripcion": org.get("description")})
    return orgs


def obtener_repos_org(org, max_repos=10, sesion_http=None):
    sesion_http = sesion_http or session
    repos = []
    page = 1
    while len(repos) < max_repos:
        url = f"https://api.github.com/orgs/{org}/repos?per_page=100&page={page}"
        r = sesion_http.get(url)
        if r.status_code != 200:
            break
        data = r.json()
        if not data:
            break
        for repo in data:
            repos.append({"owner": org, "repo": repo["name"]})
        page += 1
    return repos[:max_repos]

def obtener_rama_default(owner, repo, sesion_http=None):
    sesion_http = sesion_http or session
    url = f"https://api.github.com/repos/{owner}/{repo}"
    r = sesion_http.get(url)
    if r.status_code != 200:
        print(f"Aviso {r.status_code} obteniendo metadatos de {owner}/{repo}")
        return None
    return r.json().get("default_branch", "main")


def fetch_github_codigo(owner, repo, sesion_http=None):
    """Devuelve una lista de dicts {repo, path, contenido} con el código fuente del repo,
    lista para pasar a `analizar_lenguaje_codigo`."""
    sesion_http = sesion_http or session
    rama = obtener_rama_default(owner, repo, sesion_http)
    if not rama:
        return []

    url = f"https://api.github.com/repos/{owner}/{repo}/zipball/{rama}"
    r = sesion_http.get(url)
    if r.status_code != 200:
        print(f"[github_fetcher] Error {r.status_code} al descargar el ZIP de {owner}/{repo}")
        return []

    registros = []
    try:
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            for info in z.infolist():
                if info.is_dir():
                    continue
                
                partes_path = info.filename.split("/", 1)
                path_real = partes_path[1] if len(partes_path) > 1 else info.filename

                if any(f"/{carpeta}/" in f"/{path_real}/" for carpeta in CARPETAS_EXCLUIDAS):
                    continue
                
                if not any(path_real.endswith(ext) for ext in EXTENSIONES_CODIGO):
                    continue
                
                if info.file_size > MAX_TAMANO_ARCHIVO_KB * 1024:
                    continue

                contenido = z.read(info.filename).decode("utf-8", errors="ignore")
                registros.append({
                    "repo": f"{owner}/{repo}",
                    "path": path_real,
                    "contenido": contenido,
                })
    except zipfile.BadZipFile:
        print(f"[github_fetcher] Error crítico: El archivo descargado de {owner}/{repo} no es un ZIP válido.")
    return registros

MAX_WORKERS_REPOS_DEFAULT = 6
def fetch_repo_completo(owner, repo, max_pages_comentarios=2, sesion_http=None):
    """Descarga comentarios y código fuente de UN repo en paralelo (2 hilos)."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
        futuro_comentarios = ex.submit(fetch_github_comments, owner, repo, max_pages=max_pages_comentarios, sesion_http=sesion_http)
        futuro_codigo = ex.submit(fetch_github_codigo, owner, repo, sesion_http=sesion_http)
        comentarios = futuro_comentarios.result()
        codigo = futuro_codigo.result()
    return {"owner": owner, "repo": repo, "comentarios": comentarios, "codigo": codigo}

def descargar_datos_repos(repos_a_analizar, max_workers=MAX_WORKERS_REPOS_DEFAULT,
                           max_pages_comentarios=2, callback_progreso=None, sesion_http=None):
    """
    Descarga comentarios + código de TODOS los repos en paralelo. 
    Limitando el número de repositorios procesados simultáneamente mediante max_workers. 
    Dentro de cada repositorio, ambas tareas también se ejecutan en paralelo y se llama 
    al callback_progreso cada vez que termina un repositorio. 
    Devuelve una lista de dicts en el mismo orden que `repos_a_analizar`:
    [{"owner", "repo", "comentarios": [...], "codigo": [...]}, ...].
    """
    resultados = [None] * len(repos_a_analizar)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        futuros = {
            ex.submit(fetch_repo_completo, info["owner"], info["repo"], max_pages_comentarios=max_pages_comentarios, sesion_http=sesion_http): idx
            for idx, info in enumerate(repos_a_analizar)
        }
        completados = 0
        for futuro in concurrent.futures.as_completed(futuros):
            idx = futuros[futuro]
            try:
                resultados[idx] = futuro.result()
            except Exception as e:
                info = repos_a_analizar[idx]
                print(f"[github_fetcher] Error descargando {info['owner']}/{info['repo']}: {e}")
                resultados[idx] = {"owner": info["owner"], "repo": info["repo"], "comentarios": [], "codigo": []}
            completados += 1
            if callback_progreso:
                callback_progreso(completados, len(repos_a_analizar), resultados[idx])
    return resultados