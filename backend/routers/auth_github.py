"""
OAuth de GitHub (Authorization Code Flow).
Permite a un usuario YA REGISTRADO en la app (identificado con `X-Usuario`)
vincular su cuenta de GitHub para que los análisis que lance se ejecuten
con SU PROPIO token en vez del token compartido de la app. El token se
guarda cifrado (ver `cifrado.py`) y nunca se devuelve al frontend.
"""
import os
import secrets
from datetime import datetime, timedelta, timezone

import requests
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from cifrado import cifrar
from database import get_db
from modelos.orm import GithubOAuthState, UsuarioBase
from modelos.schemas import MensajeSimple, RepoGithubDisponible, OrgGithubDisponible
from analisis.github_fetcher import crear_sesion_github, obtener_repos_usuario, obtener_orgs_usuario
from servicios.informe_servicio import resolver_token_github_usuario

router = APIRouter(tags=["auth-github"])

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_OAUTH_SCOPE = os.getenv("GITHUB_OAUTH_SCOPE", "repo read:org read:user")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:4200")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
TIEMPO_VIDA_STATE = timedelta(minutes=10)

def _limpiar_states_caducados(db: Session):
    limite = datetime.now(timezone.utc) - TIEMPO_VIDA_STATE
    db.query(GithubOAuthState).filter(GithubOAuthState.creado_en < limite).delete()
    db.commit()

@router.get(
    "/auth/github/login",
    summary="Iniciar la vinculación OAuth con GitHub",
    description=(
        "Redirige a GitHub para que el usuario autorice la app. Requiere el "
        "parámetro `x_usuario` del usuario ya logueado que quiere vincular su "
        "cuenta de GitHub.\n\n"
        "NOTA: a diferencia del resto de la API, aquí `x_usuario` va como "
        "query param (y no como cabecera `X-Usuario`) porque este endpoint "
        "se alcanza con una navegación completa del navegador "
        "(`window.location`), que no puede fijar cabeceras personalizadas "
        "como sí hace el interceptor HTTP de Angular en el resto de peticiones."
    ),
    responses={401: {"description": "Falta el parámetro x_usuario o el usuario no existe"}},
)
def github_login(x_usuario: str = None, db: Session = Depends(get_db)):
    if not GITHUB_CLIENT_ID:
        raise HTTPException(500, "GITHUB_CLIENT_ID no está configurado en el servidor")
    if not x_usuario:
        raise HTTPException(401, "Falta el parámetro x_usuario")

    usuario = db.query(UsuarioBase).filter(UsuarioBase.username == x_usuario).first()
    if not usuario:
        raise HTTPException(401, "Usuario inválido")

    _limpiar_states_caducados(db)

    state = secrets.token_urlsafe(24)
    db.add(GithubOAuthState(state=state, usuario_id=usuario.id))
    db.commit()

    redirect_uri = f"{BACKEND_URL}/auth/github/callback"
    url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={GITHUB_OAUTH_SCOPE.replace(' ', '%20')}"
        f"&state={state}"
    )
    return RedirectResponse(url)

@router.get(
    "/auth/github/callback",
    summary="Callback OAuth de GitHub",
    description=(
        "GitHub redirige aquí tras la autorización. Intercambia el `code` "
        "por un `access_token`, lo guarda cifrado junto al usuario que "
        "inició el flujo (identificado por `state`), y redirige de vuelta "
        "al frontend."
    ),
    include_in_schema=False,
)
def github_callback(code: str = None, state: str = None, error: str = None, db: Session = Depends(get_db)):
    if error or not code or not state:
        return RedirectResponse(f"{FRONTEND_URL}/perfil?github=error")

    _limpiar_states_caducados(db)
    estado_guardado = db.query(GithubOAuthState).filter(GithubOAuthState.state == state).first()
    if not estado_guardado:
        return RedirectResponse(f"{FRONTEND_URL}/perfil?github=error")

    usuario_id = estado_guardado.usuario_id
    db.delete(estado_guardado)
    db.commit()

    try:
        resp = requests.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": f"{BACKEND_URL}/auth/github/callback",
            },
            timeout=10,
        )
        datos = resp.json()
    except requests.RequestException:
        return RedirectResponse(f"{FRONTEND_URL}/perfil?github=error")

    token = datos.get("access_token")
    if not token:
        return RedirectResponse(f"{FRONTEND_URL}/perfil?github=error")

    github_login_usuario = None
    try:
        resp_user = requests.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {token}"},
            timeout=10,
        )
        if resp_user.status_code == 200:
            github_login_usuario = resp_user.json().get("login")
    except requests.RequestException:
        pass

    usuario = db.query(UsuarioBase).filter(UsuarioBase.id == usuario_id).first()
    if not usuario:
        return RedirectResponse(f"{FRONTEND_URL}/perfil?github=error")

    usuario.github_token_cifrado = cifrar(token)
    usuario.github_login = github_login_usuario
    db.commit()

    return RedirectResponse(f"{FRONTEND_URL}/perfil?github=conectado")

@router.delete(
    "/auth/github",
    response_model=MensajeSimple,
    summary="Desvincular la cuenta de GitHub",
    description="Elimina el token de GitHub guardado. Los análisis futuros de este usuario volverán a usar el token compartido de la app.",
    responses={401: {"description": "Falta la cabecera X-Usuario o el usuario no existe"}},
)
def github_desconectar(x_usuario: str = Header(None), db: Session = Depends(get_db)):
    if not x_usuario:
        raise HTTPException(401, "Falta la cabecera X-Usuario")
    usuario = db.query(UsuarioBase).filter(UsuarioBase.username == x_usuario).first()
    if not usuario:
        raise HTTPException(401, "Usuario inválido")

    usuario.github_token_cifrado = None
    usuario.github_login = None
    db.commit()
    return {"msj": "Cuenta de GitHub desvinculada correctamente"}

def _sesion_con_token_propio(x_usuario: str, db: Session) -> tuple:
    """Devuelve (usuario, sesion_http) para un usuario que DEBE tener GitHub
    vinculado; lanza 400 si no lo tiene. Se usa en los endpoints de listado
    (repos/orgs), que solo tienen sentido con el token personal del usuario:
    con el token compartido de la app listaríamos los repos de la cuenta de
    servicio, no los del usuario que está mirando el selector."""
    if not x_usuario:
        raise HTTPException(401, "Falta la cabecera X-Usuario")
    usuario = db.query(UsuarioBase).filter(UsuarioBase.username == x_usuario).first()
    if not usuario:
        raise HTTPException(401, "Usuario inválido")
    token = resolver_token_github_usuario(db, usuario.id)
    if not token:
        raise HTTPException(400, "El usuario no tiene una cuenta de GitHub vinculada")
    return usuario, crear_sesion_github(token)

@router.get(
    "/github/repos",
    response_model=list[RepoGithubDisponible],
    summary="Listar los repositorios propios de GitHub del usuario",
    description=(
        "Devuelve los repositorios a los que el usuario tiene acceso en "
        "GitHub con SU PROPIO token (propios, como colaborador, y de sus "
        "organizaciones, incluidos los privados). Pensado para alimentar un "
        "selector en el frontend en vez de que el usuario tenga que escribir "
        "owner/repo a ciegas. Requiere tener la cuenta de GitHub vinculada."
    ),
    responses={
        400: {"description": "El usuario no tiene una cuenta de GitHub vinculada"},
        401: {"description": "Falta la cabecera X-Usuario o el usuario no existe"},
    },
)
def listar_repos_github(x_usuario: str = Header(None), db: Session = Depends(get_db)):
    _usuario, sesion_http = _sesion_con_token_propio(x_usuario, db)
    return obtener_repos_usuario(sesion_http)

@router.get(
    "/github/orgs",
    response_model=list[OrgGithubDisponible],
    summary="Listar las organizaciones de GitHub del usuario",
    description=(
        "Devuelve las organizaciones de GitHub a las que pertenece el "
        "usuario con SU PROPIO token, para poder elegir una en el modo "
        "'organización' del selector en vez de escribir el nombre a mano. "
        "Requiere tener la cuenta de GitHub vinculada."
    ),
    responses={
        400: {"description": "El usuario no tiene una cuenta de GitHub vinculada"},
        401: {"description": "Falta la cabecera X-Usuario o el usuario no existe"},
    },
)
def listar_orgs_github(x_usuario: str = Header(None), db: Session = Depends(get_db)):
    _usuario, sesion_http = _sesion_con_token_propio(x_usuario, db)
    return obtener_orgs_usuario(sesion_http)