"""
Cifrado simétrico (Fernet/AES) para datos sensibles guardados en BD.
El sistema utiliza cifrado simétrico Fernet/AES para proteger los datos 
sensibles almacenados en la base de datos, especialmente los access_token de 
GitHub obtenidos mediante OAuth. La clave de cifrado se obtiene de la variable 
de entorno FERNET_KEY y debe ser independiente de otros secretos de GitHub. 
Esto garantiza que los tokens nunca se almacenen en texto plano.

Generar una clave nueva:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
import os
import bcrypt
from functools import lru_cache
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

load_dotenv("token.env")

@lru_cache(maxsize=1)
def _obtener_fernet() -> Fernet:
    clave = os.getenv("FERNET_KEY")
    if not clave:
        raise RuntimeError(
            "Falta la variable de entorno FERNET_KEY. Genera una con "
            "`python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\"` y añádela a token.env."
        )
    return Fernet(clave.encode())

def cifrar(texto_plano: str) -> str:
    """Cifra una cadena (p.ej. un token de GitHub) para guardarla en BD."""
    return _obtener_fernet().encrypt(texto_plano.encode()).decode()

def descifrar(texto_cifrado: str) -> str | None:
    """Descifra una cadena guardada en BD. Devuelve None si es inválida."""
    try:
        return _obtener_fernet().decrypt(texto_cifrado.encode()).decode()
    except InvalidToken:
        return None

def obtener_hash_password(password: str) -> str:
    """Genera un hash seguro con salt para la contraseña."""
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_password.decode('utf-8')

def verificar_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica que la contraseña proporcionada coincida con el hash almacenado."""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))