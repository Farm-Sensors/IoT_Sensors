from sqlalchemy import ForeignKey, Index, Integer, String
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import SoftDeleteMixin, TimestampMixin




if TYPE_CHECKING:
    from app.models.gateway import Gateway
    from app.models.client import Client
    from app.models.irrigation_area import IrrigationArea

class Property(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "predios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    ubicacion: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )

    gateway: Mapped["Gateway | None"] = relationship(
        "Gateway", back_populates="property", uselist=False
    )

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="properties")
    irrigation_areas: Mapped[list["IrrigationArea"]] = relationship(
        "IrrigationArea", back_populates="property"
    )

    __table_args__ = (Index("idx_predios_cliente_id", "cliente_id"),)
