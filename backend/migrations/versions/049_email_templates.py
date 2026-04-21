"""Add email_templates table for per-institute template overrides."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP

revision = "049"
down_revision = "048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("template_key", sa.String(64), nullable=False),
        sa.Column("institute_id", UUID(as_uuid=True), sa.ForeignKey("institutes.id"), nullable=False),
        sa.Column("subject", sa.String(512), nullable=False),
        sa.Column("body_html", sa.Text, nullable=False),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("template_key", "institute_id", name="uq_email_template_key_institute"),
    )
    op.create_index("ix_email_templates_institute_id", "email_templates", ["institute_id"])


def downgrade() -> None:
    op.drop_index("ix_email_templates_institute_id")
    op.drop_table("email_templates")
