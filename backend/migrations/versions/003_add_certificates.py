"""add certificates

Revision ID: 003
Revises: 002
Create Date: 2026-03-09
"""
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE certificate_status AS ENUM ('eligible', 'approved', 'revoked');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS certificates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            student_id UUID NOT NULL REFERENCES users(id),
            batch_id UUID NOT NULL REFERENCES batches(id),
            course_id UUID NOT NULL REFERENCES courses(id),
            certificate_id VARCHAR NOT NULL UNIQUE,
            verification_code VARCHAR NOT NULL UNIQUE,
            status certificate_status NOT NULL DEFAULT 'eligible',
            completion_percentage INTEGER NOT NULL DEFAULT 0,
            approved_by UUID REFERENCES users(id),
            approved_at TIMESTAMPTZ,
            issued_at TIMESTAMPTZ,
            revoked_by UUID REFERENCES users(id),
            revoked_at TIMESTAMPTZ,
            revocation_reason TEXT,
            pdf_path VARCHAR,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ,
            CONSTRAINT uq_certificate_student_batch_course UNIQUE (student_id, batch_id, course_id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS certificate_counter (
            id INTEGER PRIMARY KEY,
            current_year INTEGER NOT NULL,
            last_sequence INTEGER NOT NULL DEFAULT 0
        )
    """)

    op.execute("""
        INSERT INTO certificate_counter (id, current_year, last_sequence)
        VALUES (1, 2026, 0)
        ON CONFLICT (id) DO NOTHING
    """)

    op.execute("""
        INSERT INTO system_settings (id, setting_key, value, description)
        VALUES (gen_random_uuid(), 'certificate_completion_threshold', '70',
                'Minimum video completion percentage required for certificate eligibility')
        ON CONFLICT (setting_key) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS certificate_counter")
    op.execute("DROP TABLE IF EXISTS certificates")
    op.execute("DROP TYPE IF EXISTS certificate_status")
    op.execute("DELETE FROM system_settings WHERE setting_key = 'certificate_completion_threshold'")
