from sqlalchemy import JSON, CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import TimestampMixin


class GatewayTemplate(Base, TimestampMixin):
    __tablename__ = "plantillas_pasarela"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150))
    estado: Mapped[str] = mapped_column(String(16), server_default="draft")
    __table_args__ = (
        CheckConstraint("estado IN ('draft', 'active', 'retired')", name="ck_plantillas_estado"),
    )


class GatewayTemplateVersion(Base, TimestampMixin):
    __tablename__ = "versiones_plantilla_pasarela"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plantilla_id: Mapped[int] = mapped_column(ForeignKey("plantillas_pasarela.id"))
    version: Mapped[int] = mapped_column(Integer)
    estado: Mapped[str] = mapped_column(String(16), server_default="draft")
    # Existing-area selectors, pending slots and profile links; no physical identity.
    definicion: Mapped[dict] = mapped_column(JSON)
    __table_args__ = (
        UniqueConstraint("plantilla_id", "version", name="uq_versiones_plantilla_version"),
        CheckConstraint("version > 0", name="ck_versiones_plantilla_version"),
        CheckConstraint(
            "estado IN ('draft', 'active', 'retired')", name="ck_versiones_plantilla_estado"
        ),
    )
