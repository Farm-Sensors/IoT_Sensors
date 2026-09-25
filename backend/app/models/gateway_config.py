from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class GatewayConfig(Base):
    __tablename__ = "configuraciones_pasarela"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    predio_id: Mapped[int] = mapped_column(ForeignKey("predios.id"))
    pasarela_id: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict] = mapped_column(JSON)
    version_plantilla_id: Mapped[int | None] = mapped_column(
        ForeignKey("versiones_plantilla_pasarela.id")
    )
    publicado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    publicado_por_usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    __table_args__ = (
        ForeignKeyConstraint(
            ["pasarela_id", "predio_id"],
            ["pasarelas.id", "pasarelas.predio_id"],
            name="fk_config_gateway_property",
        ),
        UniqueConstraint("predio_id", "version", name="uq_config_predio_version"),
        CheckConstraint("version > 0", name="ck_config_version"),
    )
