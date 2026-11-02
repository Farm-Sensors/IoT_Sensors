from sqlalchemy import Integer, String
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import SoftDeleteMixin, TimestampMixin




if TYPE_CHECKING:
    from app.models.irrigation_area import IrrigationArea

class CropType(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tipos_cultivo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    descripcion: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    # Foto opcional: solo su dirección en Wikimedia Commons y su atribución; nunca la imagen.
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    foto_credito: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    foto_pagina: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    # Relationships
    irrigation_areas: Mapped[list["IrrigationArea"]] = relationship(
        "IrrigationArea", back_populates="crop_type"
    )
