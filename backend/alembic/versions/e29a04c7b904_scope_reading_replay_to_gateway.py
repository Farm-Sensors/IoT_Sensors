"""Scope telemetry retry identity to gateway, logical node, and event.

Revision ID: e29a04c7b904
Revises: e29a03c7b903
"""

from alembic import op
import sqlalchemy as sa

revision = "e29a04c7b904"
down_revision = "e29a03c7b903"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New ingestion uses (gateway, logical node, event). Remove the older
    # per-node constraint so the same event identity can be used independently
    # by another authorized gateway after an ownership transition.
    op.drop_index("uq_lecturas_nodo_event_id", table_name="lecturas")


def downgrade() -> None:
    connection = op.get_bind()
    duplicate = connection.scalar(
        sa.text(
            "SELECT 1 FROM lecturas WHERE event_id IS NOT NULL "
            "GROUP BY nodo_id, event_id HAVING COUNT(*) > 1 LIMIT 1"
        )
    )
    if duplicate:
        raise RuntimeError(
            "Refusing downgrade: gateway-scoped event identities cannot be represented by the legacy index"
        )
    op.create_index(
        "uq_lecturas_nodo_event_id", "lecturas", ["nodo_id", "event_id"], unique=True
    )
