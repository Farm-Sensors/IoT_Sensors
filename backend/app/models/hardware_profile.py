from sqlalchemy import Boolean, Integer, String, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class HardwareProfile(Base):
    __tablename__ = "perfiles_hardware"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(64), unique=True)
    nombre: Mapped[str] = mapped_column(String(150))
    activo: Mapped[bool] = mapped_column(Boolean, server_default=true())
