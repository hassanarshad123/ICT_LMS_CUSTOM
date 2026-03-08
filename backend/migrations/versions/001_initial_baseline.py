"""Initial baseline — stamp this revision on existing databases.

This migration represents the current schema as created by SQLModel create_all().
On production: run `alembic stamp 001` to mark this as applied WITHOUT executing.
On new databases: `alembic upgrade head` will skip this (empty) and apply subsequent migrations.

Revision ID: 001
Revises:
Create Date: 2026-03-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Baseline: all tables already exist (created by SQLModel create_all).
    # On a fresh database, run the full CREATE TABLE DDL from models instead.
    pass


def downgrade() -> None:
    pass
