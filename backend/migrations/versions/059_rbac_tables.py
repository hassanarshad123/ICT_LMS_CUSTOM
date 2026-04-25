"""Create RBAC tables (permissions, custom_roles, custom_role_permissions)
and add custom_role_id FK to users.

Revision ID: 059
Revises: 058
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP, ENUM as PG_ENUM

revision = "059"
down_revision = "058"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── view_type enum (idempotent — DDL auto-commits in PG) ──
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'view_type') THEN
                CREATE TYPE view_type AS ENUM ('student_view', 'staff_view', 'admin_view');
            END IF;
        END$$;
    """)
    view_type_col = PG_ENUM("student_view", "staff_view", "admin_view", name="view_type", create_type=False)

    # ── permissions table ──────────────────────────────────────
    op.create_table(
        "permissions",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("code", sa.String(100), unique=True, nullable=False),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_permissions_module", "permissions", ["module"])

    # ── custom_roles table ─────────────────────────────────────
    op.create_table(
        "custom_roles",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institute_id", UUID(as_uuid=True), sa.ForeignKey("institutes.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("view_type", view_type_col, nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("created_at", TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_custom_roles_institute", "custom_roles", ["institute_id"])
    op.create_index(
        "uq_custom_roles_slug_institute",
        "custom_roles",
        ["institute_id", "slug"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # ── custom_role_permissions junction ────────────────────────
    op.create_table(
        "custom_role_permissions",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column(
            "custom_role_id", UUID(as_uuid=True),
            sa.ForeignKey("custom_roles.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "permission_id", UUID(as_uuid=True),
            sa.ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.UniqueConstraint("custom_role_id", "permission_id", name="uq_custom_role_permission"),
    )
    op.create_index("ix_crp_custom_role_id", "custom_role_permissions", ["custom_role_id"])
    op.create_index("ix_crp_permission_id", "custom_role_permissions", ["permission_id"])

    # ── users.custom_role_id ───────────────────────────────────
    op.add_column(
        "users",
        sa.Column(
            "custom_role_id", UUID(as_uuid=True),
            sa.ForeignKey("custom_roles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_users_custom_role_id", "users", ["custom_role_id"],
        postgresql_where=sa.text("custom_role_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_users_custom_role_id", "users")
    op.drop_column("users", "custom_role_id")
    op.drop_table("custom_role_permissions")
    op.drop_table("custom_roles")
    op.drop_table("permissions")
    sa.Enum(name="view_type").drop(op.get_bind(), checkfirst=True)
