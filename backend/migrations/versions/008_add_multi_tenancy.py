"""Add multi-tenancy support

Revision ID: 008
Revises: 007
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    # Create enum types first
    op.execute("CREATE TYPE institute_status AS ENUM ('active', 'suspended', 'trial')")
    op.execute("CREATE TYPE plan_tier AS ENUM ('free', 'basic', 'pro', 'enterprise')")

    # Add super_admin to user_role enum
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin'")

    # Create institutes table
    op.create_table(
        'institutes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column(
            'status',
            postgresql.ENUM('active', 'suspended', 'trial', name='institute_status', create_type=False),
            nullable=False,
            server_default='trial',
        ),
        sa.Column(
            'plan_tier',
            postgresql.ENUM('free', 'basic', 'pro', 'enterprise', name='plan_tier', create_type=False),
            nullable=False,
            server_default='free',
        ),
        sa.Column('max_users', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('max_storage_gb', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('max_video_gb', sa.Float(), nullable=False, server_default='5.0'),
        sa.Column('contact_email', sa.String(), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', name='uq_institutes_slug'),
    )
    op.create_index('ix_institutes_slug', 'institutes', ['slug'])

    # Create institute_usage table
    op.create_table(
        'institute_usage',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('institute_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('current_users', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('current_storage_bytes', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('current_video_bytes', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('last_calculated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['institute_id'], ['institutes.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('institute_id', name='uq_institute_usage_institute_id'),
    )

    # Add institute_id to users table
    op.add_column('users', sa.Column('institute_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_users_institute_id', 'users', 'institutes', ['institute_id'], ['id'])
    # Remove old unique constraint on email, add composite
    op.drop_constraint('users_email_key', 'users', type_='unique')
    op.create_index(
        'uq_user_email_institute', 'users', ['email', 'institute_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL'),
    )

    # Add institute_id to all other tables
    for table in [
        'batches', 'student_batches', 'student_batch_history',
        'courses', 'batch_courses', 'lectures', 'curriculum_modules', 'batch_materials', 'lecture_progress',
        'zoom_accounts', 'zoom_classes', 'class_recordings', 'zoom_attendance',
        'certificates', 'announcements', 'notifications', 'jobs', 'job_applications',
        'user_sessions', 'activity_log', 'error_logs',
    ]:
        op.add_column(table, sa.Column('institute_id', postgresql.UUID(as_uuid=True), nullable=True))

    # Fix SystemSetting unique constraint
    op.drop_constraint('system_settings_setting_key_key', 'system_settings', type_='unique')
    op.add_column('system_settings', sa.Column('institute_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_unique_constraint(
        'uq_system_setting_key_institute', 'system_settings', ['setting_key', 'institute_id']
    )

    # Fix CertificateCounter (drop old table, create new)
    op.drop_table('certificate_counter')
    op.create_table(
        'certificate_counter',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('institute_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('current_year', sa.Integer(), nullable=False),
        sa.Column('last_sequence', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['institute_id'], ['institutes.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('institute_id', 'current_year', name='uq_cert_counter_institute_year'),
    )


def downgrade():
    # Drop new certificate_counter, restore old
    op.drop_table('certificate_counter')
    op.create_table(
        'certificate_counter',
        sa.Column('id', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('current_year', sa.Integer(), nullable=False),
        sa.Column('last_sequence', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Remove institute_id from system_settings and restore unique key
    op.drop_constraint('uq_system_setting_key_institute', 'system_settings', type_='unique')
    op.drop_column('system_settings', 'institute_id')
    op.create_unique_constraint('system_settings_setting_key_key', 'system_settings', ['setting_key'])

    # Remove institute_id columns
    for table in [
        'batches', 'student_batches', 'student_batch_history',
        'courses', 'batch_courses', 'lectures', 'curriculum_modules', 'batch_materials', 'lecture_progress',
        'zoom_accounts', 'zoom_classes', 'class_recordings', 'zoom_attendance',
        'certificates', 'announcements', 'notifications', 'jobs', 'job_applications',
        'user_sessions', 'activity_log', 'error_logs',
    ]:
        op.drop_column(table, 'institute_id')

    # Restore users unique on email
    op.drop_index('uq_user_email_institute', 'users')
    op.drop_constraint('fk_users_institute_id', 'users', type_='foreignkey')
    op.drop_column('users', 'institute_id')
    op.create_unique_constraint('users_email_key', 'users', ['email'])

    # Drop new tables
    op.drop_table('institute_usage')
    op.drop_table('institutes')

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS institute_status")
    op.execute("DROP TYPE IF EXISTS plan_tier")
