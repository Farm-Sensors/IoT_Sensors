from sqlalchemy import JSON, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import TimestampMixin


class DashboardPreference(Base, TimestampMixin):
    """Per-client selection of the dashboard cards to render.

    One row per client (``cliente_id`` unique). Absent row means the dashboard
    falls back to its automatic behavior: show only the cards whose data exists
    in the latest reading.
    """

    __tablename__ = "preferencias_dashboard"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("clientes.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    tarjetas: Mapped[list] = mapped_column(JSON, nullable=False)
