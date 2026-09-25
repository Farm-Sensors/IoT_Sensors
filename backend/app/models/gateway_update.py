from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class GatewayUpdateAuthorization(Base):
    __tablename__ = "autorizaciones_actualizacion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pasarela_id: Mapped[int] = mapped_column(ForeignKey("pasarelas.id"))
    authorization_id: Mapped[str] = mapped_column(String(64), unique=True)
    image_version: Mapped[str] = mapped_column(String(128))
    image_digest: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    emitido_por_usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    consumido_en: Mapped[datetime | None] = mapped_column(DateTime)


class GatewayUpdateConfirmation(Base):
    __tablename__ = "confirmaciones_actualizacion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pasarela_id: Mapped[int] = mapped_column(ForeignKey("pasarelas.id"))
    authorization_id: Mapped[str] = mapped_column(String(64))
    event_id: Mapped[str] = mapped_column(String(128))
    image_version: Mapped[str] = mapped_column(String(128))
    image_digest: Mapped[str] = mapped_column(String(128))
    technician_confirmed_at: Mapped[datetime] = mapped_column(DateTime)
    result: Mapped[str] = mapped_column(String(24), server_default="confirmed")
    payload_hash: Mapped[str] = mapped_column(String(64))
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("pasarela_id", "event_id", name="uq_confirmaciones_pasarela_evento"),
        CheckConstraint("result = 'confirmed'", name="ck_confirmaciones_result"),
    )
