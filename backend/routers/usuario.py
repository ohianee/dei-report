"""
Endpoints relacionados con el usuario: login, registro, consulta de
perfil, cambio de contraseña y borrado de cuenta.
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from database import get_db
from modelos.orm import UsuarioBase, JobRecord
from modelos.schemas import (
    UsuarioLogin, UsuarioResponse, UsuarioPerfil, UsuarioActualizar,
    MensajeSimple, MensajeEliminacion,
)
from cifrado import obtener_hash_password, verificar_password

router = APIRouter(tags=["usuario"])

def _obtener_usuario_o_401(x_usuario: str, db: Session) -> UsuarioBase:
    """Busca al usuario identificado por `X-Usuario`; 401 si no existe."""
    if not x_usuario:
        raise HTTPException(status_code=401, detail="Falta la cabecera X-Usuario")
    usuario = db.query(UsuarioBase).filter(UsuarioBase.username == x_usuario).first()
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario inválido")
    return usuario

@router.post(
    "/login",
    response_model=UsuarioResponse,
    summary="Iniciar sesión",
    description=(
        "Valida usuario y contraseña. Si la petición incluye la cabecera "
        "`X-Session-Id` de una sesión anónima previa, los informes que esa "
        "sesión hubiera generado se adoptan por el usuario que inicia sesión."
    ),
    responses={401: {"description": "Usuario o contraseña incorrectos"}},
)
def login(credenciales: UsuarioLogin, x_session_id: str = Header(None), db: Session = Depends(get_db)):
    usuario = db.query(UsuarioBase).filter(UsuarioBase.username == credenciales.user).first()

    if not usuario or not verificar_password(credenciales.contrasenya, usuario.password):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    if x_session_id:
        db.query(JobRecord).filter(
            JobRecord.session_id == x_session_id,
            JobRecord.usuario_id.is_(None)
        ).update({"usuario_id": usuario.id, "session_id": None})
        db.commit()

    return {
        "user": usuario.username,
        "nocerrar": credenciales.nocerrar
    }

@router.post(
    "/registro",
    response_model=MensajeSimple,
    summary="Registrar un nuevo usuario",
    description="Crea una cuenta nueva con usuario y contraseña. Falla si el usuario ya existe.",
    responses={400: {"description": "El usuario ya existe"}},
)
def registrar_usuario(credenciales: UsuarioLogin, db: Session = Depends(get_db)):
    existe = db.query(UsuarioBase).filter(UsuarioBase.username == credenciales.user).first()
    if existe:
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    nuevo_usuario = UsuarioBase(
        username=credenciales.user,
        password=obtener_hash_password(credenciales.contrasenya)
    )
    db.add(nuevo_usuario)
    db.commit()
    return {"msj": "Usuario creado con éxito"}

@router.get(
    "/usuario",
    response_model=UsuarioPerfil,
    summary="Consultar el perfil del usuario autenticado",
    description="Devuelve el nombre de usuario y el número de análisis asociados a la cuenta. Requiere la cabecera `X-Usuario`.",
    responses={401: {"description": "Falta la cabecera X-Usuario o el usuario no existe"}},
)
def obtener_perfil(x_usuario: str = Header(None), db: Session = Depends(get_db)):
    usuario = _obtener_usuario_o_401(x_usuario, db)
    n_informes = db.query(JobRecord).filter(JobRecord.usuario_id == usuario.id).count()
    return {
        "user": usuario.username,
        "n_informes": n_informes,
        "github_conectado": usuario.github_token_cifrado is not None,
        "github_login": usuario.github_login,
    }

@router.put(
    "/usuario",
    response_model=MensajeSimple,
    summary="Cambiar la contraseña del usuario",
    description=(
        "Actualiza la contraseña de la cuenta identificada por `X-Usuario`. "
        "Requiere confirmar la contraseña actual en el cuerpo de la petición."
    ),
    responses={401: {"description": "Falta la cabecera X-Usuario, el usuario no existe o la contraseña actual no coincide"}},
)
def actualizar_usuario(datos: UsuarioActualizar, x_usuario: str = Header(None), db: Session = Depends(get_db)):
    usuario = _obtener_usuario_o_401(x_usuario, db)
    
    if not verificar_password(datos.contrasenya_actual, usuario.password):
        raise HTTPException(status_code=401, detail="La contraseña actual no coincide")

    usuario.password = obtener_hash_password(datos.contrasenya_nueva)
    db.commit()
    return {"msj": "Contraseña actualizada con éxito"}

@router.delete(
    "/usuario",
    response_model=MensajeEliminacion,
    summary="Eliminar la cuenta del usuario",
    description=(
        "Borra la cuenta de forma permanente junto con todos sus informes "
        "(`JobRecord`) asociados. Requiere confirmar usuario y contraseña "
        "en el cuerpo de la petición, igual que en `/login`, para evitar que "
        "una cuenta se pueda borrar solo con conocer el nombre de usuario."
    ),
    responses={401: {"description": "Usuario o contraseña incorrectos"}},
)
def borrar_usuario(credenciales: UsuarioLogin, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioBase).filter(
        UsuarioBase.username == credenciales.user
    ).first()

    if not usuario or not verificar_password(credenciales.contrasenya, usuario.password):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    db.query(JobRecord).filter(JobRecord.usuario_id == usuario.id).delete()
    db.delete(usuario)
    db.commit()
    return {"mensaje": f"Usuario {usuario.username} eliminado correctamente"}