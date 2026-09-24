from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.gateway import Gateway
    from app.models.node import Node


class GatewaySlot(Base):
    __tablename__ = "ranuras_logicas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pasarela_id: Mapped[int] = mapped_column(ForeignKey("pasarelas.id"))
    nodo_id: Mapped[int] = mapped_column(ForeignKey("nodos.id"), unique=True)
    area_riego_id: Mapped[int] = mapped_column(ForeignKey("areas_riego.id"), unique=True)
    perfil_hardware_id: Mapped[int | None] = mapped_column(ForeignKey("perfiles_hardware.id"))
    version_plantilla_id: Mapped[int | None] = mapped_column(
        ForeignKey("versiones_plantilla_pasarela.id")
    )
    gateway: Mapped["Gateway"] = relationship("Gateway", back_populates="slots")
    node: Mapped["Node"] = relationship(back_populates="gateway_slot")
    __table_args__ = (
        UniqueConstraint(
            "id", "pasarela_id", "nodo_id", "area_riego_id", name="uq_ranuras_identity"
        ),
    )
