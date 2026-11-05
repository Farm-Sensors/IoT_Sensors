"""Add an optional photo reference to crop types.

Revision ID: f31b06d8c909
Revises: f31b06d8c908

Additive, nullable columns on ``tipos_cultivo``. Only the *address* of a photo hosted on
Wikimedia Commons and its attribution text are stored; the image itself is never kept.
No value means the crop shows its icon, exactly as before.
"""

from alembic import op
import sqlalchemy as sa

revision = "f31b06d8c909"
down_revision = "f31b06d8c908"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tipos_cultivo", sa.Column("foto_url", sa.String(length=500), nullable=True))
    op.add_column("tipos_cultivo", sa.Column("foto_credito", sa.String(length=255), nullable=True))
    op.add_column("tipos_cultivo", sa.Column("foto_pagina", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("tipos_cultivo", "foto_pagina")
    op.drop_column("tipos_cultivo", "foto_credito")
    op.drop_column("tipos_cultivo", "foto_url")
