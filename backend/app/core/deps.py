import hashlib

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.client import Client
from app.models.gateway import Gateway
from app.models.node import Node
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/docs-login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decode JWT and return the active, non-deleted user."""
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id: int | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.execute(
        select(User).where(
            User.id == int(user_id),
            User.activo.is_(True),
            User.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o deshabilitado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user has the 'admin' role."""
    if current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador",
        )
    return current_user


def get_current_client(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Client:
    """Return the Client record associated with the current user."""
    if current_user.rol == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este endpoint es solo para clientes",
        )
    client = db.execute(
        select(Client).where(
            Client.usuario_id == current_user.id,
            Client.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registro de cliente no encontrado",
        )
    return client


def validate_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> Node:
    """Validate the X-API-Key header and return the active Node."""
    node = db.execute(
        select(Node).where(
            Node.api_key == x_api_key,
            Node.activo.is_(True),
            Node.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key inválida o nodo deshabilitado",
        )
    return node


def validate_gateway_credential(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> Gateway:
    """Authenticate a machine request as exactly one active gateway."""
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Gateway credential is required",
        )
    digest = hashlib.sha256(x_api_key.encode("utf-8")).hexdigest()
    gateway = db.execute(
        select(Gateway).where(
            Gateway.credencial_hash == digest,
            Gateway.estado == "active",
            Gateway.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Gateway credential is invalid",
        )
    return gateway
