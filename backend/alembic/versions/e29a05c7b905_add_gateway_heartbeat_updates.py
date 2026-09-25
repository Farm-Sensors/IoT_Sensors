"""Add prepared-image update authorization and confirmation tables.

Revision ID: e29a05c7b905
Revises: e29a04c7b904
"""

from alembic import op
import sqlalchemy as sa

revision = "e29a05c7b905"
down_revision = "e29a04c7b904"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "autorizaciones_actualizacion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pasarela_id", sa.Integer(), sa.ForeignKey("pasarelas.id"), nullable=False),
        sa.Column("authorization_id", sa.String(64), nullable=False, unique=True),
        sa.Column("image_version", sa.String(128), nullable=False),
        sa.Column("image_digest", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("emitido_por_usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("consumido_en", sa.DateTime(), nullable=True),
        mysql_engine="InnoDB",
    )
    op.create_table(
        "confirmaciones_actualizacion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pasarela_id", sa.Integer(), sa.ForeignKey("pasarelas.id"), nullable=False),
        sa.Column("authorization_id", sa.String(64), nullable=False),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column("image_version", sa.String(128), nullable=False),
        sa.Column("image_digest", sa.String(128), nullable=False),
        sa.Column("technician_confirmed_at", sa.DateTime(), nullable=False),
        sa.Column("result", sa.String(24), server_default="confirmed", nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("pasarela_id", "event_id", name="uq_confirmaciones_pasarela_evento"),
        mysql_engine="InnoDB",
    )


def downgrade() -> None:
    op.drop_table("confirmaciones_actualizacion")
    op.drop_table("autorizaciones_actualizacion")
