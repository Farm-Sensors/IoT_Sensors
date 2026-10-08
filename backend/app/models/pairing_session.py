"""Device-authorization pairing sessions (RFC 8628 style) for gateways.

Raw ``device_code``/``user_code`` values are never persisted: the device code is
stored as a SHA-256 digest and the user code as an HMAC-SHA256 digest keyed by a
server secret (the code space is small enough to brute force offline from a plain
hash). ``codigo_usuario_vivo`` exposes the HMAC only while the session is live so a
portable UNIQUE constraint can enforce "one live session per displayed code".
"""

from datetime import datetime

from sqlalchemy import (
    CHAR,
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, validates

from app.db.session import Base
from app.models.gateway import require_sha256

LIVE_STATES = ("pending", "approved")
TERMINAL_STATES = ("denied", "consumed", "expired")
DENIAL_REASONS = ("denied_by_admin", "cancelled", "gateway_unavailable")
PURPOSES = ("activation", "rotation")


class PairingSession(Base):
    __tablename__ = "sesiones_emparejamiento"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_publico: Mapped[str] = mapped_column(CHAR(26), unique=True)
    codigo_dispositivo_hash: Mapped[str] = mapped_column(CHAR(64), unique=True)
    codigo_usuario_hmac: Mapped[str] = mapped_column(CHAR(64))
    codigo_usuario_vivo: Mapped[str | None] = mapped_column(
        CHAR(64),
        Computed(
            "CASE WHEN estado IN ('pending', 'approved') THEN codigo_usuario_hmac ELSE NULL END",
            persisted=True,
        ),
    )
    estado: Mapped[str] = mapped_column(String(16), server_default="pending")
    motivo: Mapped[str | None] = mapped_column(String(32))
    proposito: Mapped[str | None] = mapped_column(String(16))
    pasarela_id: Mapped[int | None] = mapped_column(ForeignKey("pasarelas.id"))
    aprobado_por_usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expira_en: Mapped[datetime] = mapped_column(DateTime)
    aprobado_en: Mapped[datetime | None] = mapped_column(DateTime)
    resuelto_en: Mapped[datetime | None] = mapped_column(DateTime)
    consumido_en: Mapped[datetime | None] = mapped_column(DateTime)
    intervalo_s: Mapped[int] = mapped_column(Integer, server_default="5")
    ultimo_sondeo_en: Mapped[datetime | None] = mapped_column(DateTime)
    intentos_codigo_fallidos: Mapped[int] = mapped_column(Integer, server_default="0")
    dispositivo_hostname: Mapped[str | None] = mapped_column(String(64))
    dispositivo_modelo: Mapped[str | None] = mapped_column(String(64))
    dispositivo_version: Mapped[str | None] = mapped_column(String(64))
    red_origen: Mapped[str | None] = mapped_column(String(48))

    __table_args__ = (
        CheckConstraint(
            "estado IN ('pending', 'approved', 'denied', 'consumed', 'expired')",
            name="ck_emparejamiento_estado",
        ),
        CheckConstraint(
            "motivo IS NULL OR motivo IN ('denied_by_admin', 'cancelled', 'gateway_unavailable')",
            name="ck_emparejamiento_motivo",
        ),
        CheckConstraint(
            "proposito IS NULL OR proposito IN ('activation', 'rotation')",
            name="ck_emparejamiento_proposito",
        ),
        CheckConstraint(
            "length(codigo_dispositivo_hash) = 64", name="ck_emparejamiento_device_hash"
        ),
        CheckConstraint("length(codigo_usuario_hmac) = 64", name="ck_emparejamiento_user_hmac"),
        CheckConstraint("expira_en > creado_en", name="ck_emparejamiento_expiry"),
        CheckConstraint("intervalo_s > 0", name="ck_emparejamiento_interval"),
        CheckConstraint("intentos_codigo_fallidos >= 0", name="ck_emparejamiento_attempts"),
        CheckConstraint(
            "estado NOT IN ('denied', 'consumed', 'expired') OR resuelto_en IS NOT NULL",
            name="ck_emparejamiento_resolved",
        ),
        CheckConstraint(
            "estado <> 'consumed' OR consumido_en IS NOT NULL",
            name="ck_emparejamiento_consumed",
        ),
        CheckConstraint(
            "estado <> 'approved' OR pasarela_id IS NOT NULL",
            name="ck_emparejamiento_approved_gateway",
        ),
        UniqueConstraint("codigo_usuario_vivo", name="uq_emparejamiento_codigo_vivo"),
    )

    @validates("codigo_dispositivo_hash", "codigo_usuario_hmac")
    def validate_hash(self, key, value):
        return require_sha256(value)
