"""Add ForeignKey constraint to error_logs.institute_id

Revision ID: 013
Revises: 012
Create Date: 2026-03-23
"""
from alembic import op

revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("""
        UPDATE error_logs
        SET institute_id = NULL
        WHERE institute_id IS NOT NULL
          AND institute_id NOT IN (SELECT id FROM institutes)
    """)
    op.create_foreign_key(
        'fk_error_logs_institute_id',
        'error_logs', 'institutes',
        ['institute_id'], ['id'],
    )

def downgrade() -> None:
    op.drop_constraint('fk_error_logs_institute_id', 'error_logs', type_='foreignkey')
