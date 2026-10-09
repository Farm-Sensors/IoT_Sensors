"""Add the property reference location.

Revision ID: f31b06d8c907
Revises: f31b06d8c906

Additive nullable columns ``predios.latitud`` / ``predios.longitud``. The gateway
reports them through the v2 ``location`` operation so the external-weather lane can
resolve a property even when the IoT node carries no GPS.
"""

from alembic import op
import sqlalchemy as sa

revision = "f31b06d8c907"
down_revision = "f31b06d8c906"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "predios", sa.Column("latitud", sa.Numeric(precision=10, scale=7), nullable=True)
    )
    op.add_column(
        "predios", sa.Column("longitud", sa.Numeric(precision=10, scale=7), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("predios", "longitud")
    op.drop_column("predios", "latitud")
