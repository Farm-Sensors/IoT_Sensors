from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PhysicalBinding(Base):
    __tablename__ = "vinculos_fisicos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pasarela_id: Mapped[int] = mapped_column(Integer)
    ranura_id: Mapped[int] = mapped_column(Integer)
    nodo_id: Mapped[int] = mapped_column(Integer)
    area_riego_id: Mapped[int] = mapped_column(Integer)
    uid: Mapped[str] = mapped_column(String(128))
    numero_serie: Mapped[str] = mapped_column(String(100))
    evento_propuesta_id: Mapped[str | None] = mapped_column(String(128))
    hash_propuesta: Mapped[str | None] = mapped_column(String(64))
    estado_propuesta: Mapped[str | None] = mapped_column(String(24))
    evento_confirmacion_id: Mapped[str | None] = mapped_column(String(128))
    hash_confirmacion: Mapped[str | None] = mapped_column(String(64))
    estado: Mapped[str] = mapped_column(String(16), server_default="pending")
    propuesto_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    confirmado_en: Mapped[datetime | None] = mapped_column(DateTime)
    cerrado_en: Mapped[datetime | None] = mapped_column(DateTime)
    confirmado_por_pasarela_id: Mapped[int | None] = mapped_column(ForeignKey("pasarelas.id"))
    nodo_confirmado_id: Mapped[int | None] = mapped_column(
        Integer,
        Computed("CASE WHEN estado = 'confirmed' THEN nodo_id ELSE NULL END", persisted=True),
    )
    uid_confirmado: Mapped[str | None] = mapped_column(
        String(128),
        Computed("CASE WHEN estado = 'confirmed' THEN uid ELSE NULL END", persisted=True),
    )
    __table_args__ = (
        ForeignKeyConstraint(
            ["ranura_id", "pasarela_id", "nodo_id", "area_riego_id"],
            [
                "ranuras_logicas.id",
                "ranuras_logicas.pasarela_id",
                "ranuras_logicas.nodo_id",
                "ranuras_logicas.area_riego_id",
            ],
            name="fk_binding_slot_identity",
        ),
        UniqueConstraint("nodo_confirmado_id", name="uq_binding_current_node"),
        UniqueConstraint("pasarela_id", "uid_confirmado", name="uq_binding_current_uid"),
        UniqueConstraint(
            "pasarela_id", "evento_propuesta_id", name="uq_binding_gateway_proposal_event"
        ),
        UniqueConstraint(
            "pasarela_id", "evento_confirmacion_id", name="uq_binding_gateway_confirm_event"
        ),
        CheckConstraint("estado IN ('pending', 'confirmed', 'closed')", name="ck_binding_estado"),
        CheckConstraint(
            "estado_propuesta IS NULL OR estado_propuesta IN ('pending_initial', 'pending_reassignment')",
            name="ck_binding_proposal_status",
        ),
        CheckConstraint(
            "hash_propuesta IS NULL OR length(hash_propuesta) = 64",
            name="ck_binding_proposal_hash",
        ),
        CheckConstraint(
            "hash_confirmacion IS NULL OR length(hash_confirmacion) = 64",
            name="ck_binding_confirmation_hash",
        ),
        CheckConstraint(
            "confirmado_por_pasarela_id IS NULL OR confirmado_por_pasarela_id = pasarela_id",
            name="ck_binding_confirming_gateway",
        ),
        CheckConstraint(
            "estado <> 'confirmed' OR (confirmado_en IS NOT NULL AND confirmado_por_pasarela_id IS NOT NULL AND cerrado_en IS NULL)",
            name="ck_binding_confirmed",
        ),
        CheckConstraint("estado <> 'closed' OR cerrado_en IS NOT NULL", name="ck_binding_closed"),
    )
