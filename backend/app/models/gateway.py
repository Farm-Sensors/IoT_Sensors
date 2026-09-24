"""Cloud gateway persistence; no machine authentication is enabled here."""

import re
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CHAR,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.session import Base
from app.models.base import SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.property import Property


def require_sha256(value: str) -> str:
    if not isinstance(value, str) or re.fullmatch(r"[0-9a-f]{64}", value) is None:
        raise ValueError("Only a lowercase SHA-256 digest may be persisted")
    return value


class Gateway(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "pasarelas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    predio_id: Mapped[int] = mapped_column(ForeignKey("predios.id"), unique=True)
    estado: Mapped[str] = mapped_column(String(24), server_default="pending_activation")
    credencial_hash: Mapped[str | None] = mapped_column(CHAR(64), unique=True)
    credencial_prefijo: Mapped[str | None] = mapped_column(String(16))
    config_version_activa: Mapped[int] = mapped_column(Integer, server_default="0")
    bindings_revision: Mapped[int] = mapped_column(Integer, server_default="0")
    ultimo_heartbeat_en: Mapped[datetime | None] = mapped_column(DateTime)
    activado_en: Mapped[datetime | None] = mapped_column(DateTime)
    revocado_en: Mapped[datetime | None] = mapped_column(DateTime)
    property: Mapped["Property"] = relationship(back_populates="gateway")

    __table_args__ = (
        UniqueConstraint("id", "predio_id", name="uq_pasarelas_id_predio"),
        CheckConstraint(
            "estado IN ('pending_activation', 'active', 'revoked')", name="ck_pasarelas_estado"
        ),
        CheckConstraint(
            "config_version_activa >= 0 AND bindings_revision >= 0", name="ck_pasarelas_revisions"
        ),
        CheckConstraint(
            "credencial_hash IS NULL OR length(credencial_hash) = 64", name="ck_pasarelas_hash"
        ),
    )

    @validates("credencial_hash")
    def validate_hash(self, key, value):
        return None if value is None else require_sha256(value)
