from datetime import datetime

from sqlalchemy import CHAR, CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, validates

from app.db.session import Base
from app.models.gateway import require_sha256


class ActivationReference(Base):
    __tablename__ = "referencias_activacion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pasarela_id: Mapped[int] = mapped_column(ForeignKey("pasarelas.id"))
    referencia_hash: Mapped[str] = mapped_column(CHAR(64), unique=True)
    emitido_por_usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expira_en: Mapped[datetime] = mapped_column(DateTime)
    usado_en: Mapped[datetime | None] = mapped_column(DateTime)
    invalidado_en: Mapped[datetime | None] = mapped_column(DateTime)
    resultado: Mapped[str] = mapped_column(String(16), server_default="issued")

    __table_args__ = (
        CheckConstraint("length(referencia_hash) = 64", name="ck_referencias_hash"),
        CheckConstraint("expira_en > creado_en", name="ck_referencias_expiry"),
        CheckConstraint(
            "resultado IN ('issued', 'consumed', 'revoked')", name="ck_referencias_resultado"
        ),
    )

    @validates("referencia_hash")
    def validate_hash(self, key, value):
        return require_sha256(value)
