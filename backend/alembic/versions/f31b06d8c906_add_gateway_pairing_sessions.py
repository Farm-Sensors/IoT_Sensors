"""Add gateway device-authorization pairing sessions.

Revision ID: f31b06d8c906
Revises: e29a05c7b905

Additive table ``sesiones_emparejamiento`` for RFC 8628 style pairing. Downgrade
refuses to drop the table while it holds rows, matching the control-plane policy.
"""

from alembic import op
import sqlalchemy as sa

revision = "f31b06d8c906"
down_revision = "e29a05c7b905"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sesiones_emparejamiento",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_publico", sa.CHAR(length=26), nullable=False),
        sa.Column("codigo_dispositivo_hash", sa.CHAR(length=64), nullable=False),
        sa.Column("codigo_usuario_hmac", sa.CHAR(length=64), nullable=False),
        sa.Column(
            "codigo_usuario_vivo",
            sa.CHAR(length=64),
            sa.Computed(
                "CASE WHEN estado IN ('pending', 'approved') THEN codigo_usuario_hmac ELSE NULL END",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column("estado", sa.String(length=16), server_default="pending", nullable=False),
        sa.Column("motivo", sa.String(length=32), nullable=True),
        sa.Column("proposito", sa.String(length=16), nullable=True),
        sa.Column("pasarela_id", sa.Integer(), nullable=True),
        sa.Column("aprobado_por_usuario_id", sa.Integer(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("expira_en", sa.DateTime(), nullable=False),
        sa.Column("aprobado_en", sa.DateTime(), nullable=True),
        sa.Column("resuelto_en", sa.DateTime(), nullable=True),
        sa.Column("consumido_en", sa.DateTime(), nullable=True),
        sa.Column("intervalo_s", sa.Integer(), server_default="5", nullable=False),
        sa.Column("ultimo_sondeo_en", sa.DateTime(), nullable=True),
        sa.Column("intentos_codigo_fallidos", sa.Integer(), server_default="0", nullable=False),
        sa.Column("dispositivo_hostname", sa.String(length=64), nullable=True),
        sa.Column("dispositivo_modelo", sa.String(length=64), nullable=True),
        sa.Column("dispositivo_version", sa.String(length=64), nullable=True),
        sa.Column("red_origen", sa.String(length=48), nullable=True),
        sa.CheckConstraint(
            "estado IN ('pending', 'approved', 'denied', 'consumed', 'expired')",
            name="ck_emparejamiento_estado",
        ),
        sa.CheckConstraint(
            "motivo IS NULL OR motivo IN ('denied_by_admin', 'cancelled', 'gateway_unavailable')",
            name="ck_emparejamiento_motivo",
        ),
        sa.CheckConstraint(
            "proposito IS NULL OR proposito IN ('activation', 'rotation')",
            name="ck_emparejamiento_proposito",
        ),
        sa.CheckConstraint(
            "length(codigo_dispositivo_hash) = 64", name="ck_emparejamiento_device_hash"
        ),
        sa.CheckConstraint(
            "length(codigo_usuario_hmac) = 64", name="ck_emparejamiento_user_hmac"
        ),
        sa.CheckConstraint("expira_en > creado_en", name="ck_emparejamiento_expiry"),
        sa.CheckConstraint("intervalo_s > 0", name="ck_emparejamiento_interval"),
        sa.CheckConstraint("intentos_codigo_fallidos >= 0", name="ck_emparejamiento_attempts"),
        sa.CheckConstraint(
            "estado NOT IN ('denied', 'consumed', 'expired') OR resuelto_en IS NOT NULL",
            name="ck_emparejamiento_resolved",
        ),
        sa.CheckConstraint(
            "estado <> 'consumed' OR consumido_en IS NOT NULL",
            name="ck_emparejamiento_consumed",
        ),
        sa.CheckConstraint(
            "estado <> 'approved' OR pasarela_id IS NOT NULL",
            name="ck_emparejamiento_approved_gateway",
        ),
        sa.ForeignKeyConstraint(["pasarela_id"], ["pasarelas.id"]),
        sa.ForeignKeyConstraint(["aprobado_por_usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_publico"),
        sa.UniqueConstraint("codigo_dispositivo_hash"),
        sa.UniqueConstraint("codigo_usuario_vivo", name="uq_emparejamiento_codigo_vivo"),
        mysql_engine="InnoDB",
    )


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT COUNT(*) FROM sesiones_emparejamiento")):
        raise RuntimeError("Refusing downgrade: sesiones_emparejamiento contains pairing history")
    op.drop_table("sesiones_emparejamiento")
