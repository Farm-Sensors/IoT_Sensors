"""Add per-client dashboard preferences.

Revision ID: f31b06d8c908
Revises: f31b06d8c907

Additive table ``preferencias_dashboard``: the admin chooses which dashboard cards
a client sees. No row means the dashboard shows only the cards with data.
"""

from alembic import op
import sqlalchemy as sa

revision = "f31b06d8c908"
down_revision = "f31b06d8c907"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "preferencias_dashboard",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("cliente_id", sa.Integer(), nullable=False),
        sa.Column("tarjetas", sa.JSON(), nullable=False),
        sa.Column(
            "creado_en", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "actualizado_en",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["cliente_id"], ["clientes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cliente_id", name="uq_preferencias_dashboard_cliente"),
    )


def downgrade() -> None:
    op.drop_table("preferencias_dashboard")
