from datetime import datetime
from typing import TYPE_CHECKING
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    DECIMAL,
    Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base




if TYPE_CHECKING:
    from app.models.node import Node

class Reading(Base):
    __tablename__ = "lecturas"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nodo_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("nodos.id", ondelete="CASCADE"), nullable=False
    )
    marca_tiempo: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Nullable only for readings created before event IDs were required.
    event_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    payload_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    pasarela_id: Mapped[int | None] = mapped_column(ForeignKey("pasarelas.id"))
    marca_tiempo_sospechosa: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="0")

    # Datos Suelo
    suelo_conductividad: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 3), nullable=True
    )
    suelo_temperatura: Mapped[Decimal | None] = mapped_column(
        DECIMAL(6, 2), nullable=True
    )
    suelo_humedad: Mapped[Decimal | None] = mapped_column(DECIMAL(6, 2), nullable=True)
    suelo_potencial_hidrico: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 4), nullable=True
    )

    # Datos Riego
    riego_activo: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    riego_litros_acumulados: Mapped[Decimal | None] = mapped_column(
        DECIMAL(12, 2), nullable=True
    )
    riego_flujo_por_minuto: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 2), nullable=True
    )

    # Datos Ambientales
    ambiental_temperatura: Mapped[Decimal | None] = mapped_column(
        DECIMAL(6, 2), nullable=True
    )
    ambiental_humedad_relativa: Mapped[Decimal | None] = mapped_column(
        DECIMAL(6, 2), nullable=True
    )
    ambiental_velocidad_viento: Mapped[Decimal | None] = mapped_column(
        DECIMAL(7, 2), nullable=True
    )
    ambiental_radiacion_solar: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 2), nullable=True
    )
    ambiental_eto: Mapped[Decimal | None] = mapped_column(DECIMAL(6, 3), nullable=True)

    # Relationships
    node: Mapped["Node"] = relationship("Node", back_populates="readings")

    __table_args__ = (
        Index("uq_lecturas_pasarela_nodo_event_id", "pasarela_id", "nodo_id", "event_id", unique=True),
        Index("uq_lecturas_nodo_event_id", "nodo_id", "event_id", unique=True),
        Index("idx_lecturas_nodo_tiempo", "nodo_id", "marca_tiempo"),
        Index("idx_lecturas_tiempo", "marca_tiempo"),
    )
