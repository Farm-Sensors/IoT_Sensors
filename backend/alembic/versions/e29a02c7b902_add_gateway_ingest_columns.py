"""Prepare gateway ingest metadata without switching runtime authentication.

Revision ID: e29a02c7b902
Revises: e29a01c7b901
"""

from alembic import op
import sqlalchemy as sa

revision = "e29a02c7b902"
down_revision = "e29a01c7b901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lecturas", sa.Column("pasarela_id", sa.Integer(), nullable=True))
    op.add_column(
        "lecturas",
        sa.Column(
            "marca_tiempo_sospechosa", sa.Boolean(), server_default=sa.text("0"), nullable=False
        ),
    )
    op.create_foreign_key("fk_lecturas_pasarela", "lecturas", "pasarelas", ["pasarela_id"], ["id"])
    op.create_index(
        "uq_lecturas_pasarela_nodo_event_id",
        "lecturas",
        ["pasarela_id", "nodo_id", "event_id"],
        unique=True,
    )
    # Keep historical node-key/event uniqueness and all legacy credentials intact.
    op.alter_column("nodos", "api_key", existing_type=sa.String(128), nullable=True)


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(
        sa.text(
            "SELECT COUNT(*) FROM lecturas WHERE pasarela_id IS NOT NULL OR marca_tiempo_sospechosa <> 0"
        )
    ):
        raise RuntimeError("Refusing downgrade: gateway reading metadata would be lost")
    if connection.scalar(sa.text("SELECT COUNT(*) FROM nodos WHERE api_key IS NULL")):
        raise RuntimeError("Refusing downgrade: nodes without legacy keys exist")
    op.alter_column("nodos", "api_key", existing_type=sa.String(128), nullable=False)
    op.drop_constraint("fk_lecturas_pasarela", "lecturas", type_="foreignkey")
    op.drop_index("uq_lecturas_pasarela_nodo_event_id", table_name="lecturas")
    op.drop_column("lecturas", "marca_tiempo_sospechosa")
    op.drop_column("lecturas", "pasarela_id")
