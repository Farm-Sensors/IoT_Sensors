"""Add gateway-scoped idempotency identities to physical binding transitions.

Revision ID: e29a03c7b903
Revises: e29a02c7b902
"""

from alembic import op
import sqlalchemy as sa

revision = "e29a03c7b903"
down_revision = "e29a02c7b902"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vinculos_fisicos", sa.Column("evento_propuesta_id", sa.String(128)))
    op.add_column("vinculos_fisicos", sa.Column("hash_propuesta", sa.String(64)))
    op.add_column("vinculos_fisicos", sa.Column("estado_propuesta", sa.String(24)))
    op.add_column("vinculos_fisicos", sa.Column("evento_confirmacion_id", sa.String(128)))
    op.add_column("vinculos_fisicos", sa.Column("hash_confirmacion", sa.String(64)))
    op.create_check_constraint(
        "ck_binding_proposal_status",
        "vinculos_fisicos",
        "estado_propuesta IS NULL OR estado_propuesta IN ('pending_initial', 'pending_reassignment')",
    )
    op.create_check_constraint(
        "ck_binding_proposal_hash",
        "vinculos_fisicos",
        "hash_propuesta IS NULL OR length(hash_propuesta) = 64",
    )
    op.create_check_constraint(
        "ck_binding_confirmation_hash",
        "vinculos_fisicos",
        "hash_confirmacion IS NULL OR length(hash_confirmacion) = 64",
    )
    op.create_unique_constraint(
        "uq_binding_gateway_proposal_event",
        "vinculos_fisicos",
        ["pasarela_id", "evento_propuesta_id"],
    )
    op.create_unique_constraint(
        "uq_binding_gateway_confirm_event",
        "vinculos_fisicos",
        ["pasarela_id", "evento_confirmacion_id"],
    )


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(
        sa.text(
            "SELECT COUNT(*) FROM vinculos_fisicos "
            "WHERE evento_propuesta_id IS NOT NULL OR hash_propuesta IS NOT NULL "
            "OR estado_propuesta IS NOT NULL OR evento_confirmacion_id IS NOT NULL "
            "OR hash_confirmacion IS NOT NULL"
        )
    ):
        raise RuntimeError("Refusing downgrade: gateway binding retry identities would be lost")
    op.drop_constraint("uq_binding_gateway_confirm_event", "vinculos_fisicos", type_="unique")
    op.drop_constraint("uq_binding_gateway_proposal_event", "vinculos_fisicos", type_="unique")
    op.drop_constraint("ck_binding_confirmation_hash", "vinculos_fisicos", type_="check")
    op.drop_constraint("ck_binding_proposal_hash", "vinculos_fisicos", type_="check")
    op.drop_constraint("ck_binding_proposal_status", "vinculos_fisicos", type_="check")
    op.drop_column("vinculos_fisicos", "hash_confirmacion")
    op.drop_column("vinculos_fisicos", "evento_confirmacion_id")
    op.drop_column("vinculos_fisicos", "hash_propuesta")
    op.drop_column("vinculos_fisicos", "estado_propuesta")
    op.drop_column("vinculos_fisicos", "evento_propuesta_id")
