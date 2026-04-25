"""RBAC service: custom role CRUD, permission assignment, user role assignment."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from sqlmodel import select

from app.core.cache import cache
from app.models.activity import ActivityLog
from app.models.enums import UserRole, ViewType
from app.models.user import User
from app.rbac.constants import (
    ALL_PERMISSION_CODES,
    PERMISSION_REGISTRY,
    SYSTEM_ROLE_PERMISSIONS,
)
from app.rbac.models import CustomRole, CustomRolePermission, Permission

logger = logging.getLogger("ict_lms.rbac")


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


async def list_custom_roles(
    session: AsyncSession, institute_id: uuid.UUID,
) -> list[dict]:
    result = await session.execute(
        select(
            CustomRole,
            func.count(User.id).label("user_count"),
        )
        .outerjoin(User, (User.custom_role_id == CustomRole.id) & User.deleted_at.is_(None))
        .where(CustomRole.institute_id == institute_id, CustomRole.deleted_at.is_(None))
        .group_by(CustomRole.id)
        .order_by(CustomRole.name)
    )
    rows = result.all()
    return [
        {
            "role": role,
            "user_count": count,
        }
        for role, count in rows
    ]


async def get_custom_role(
    session: AsyncSession, role_id: uuid.UUID, institute_id: uuid.UUID,
) -> CustomRole | None:
    result = await session.execute(
        select(CustomRole).where(
            CustomRole.id == role_id,
            CustomRole.institute_id == institute_id,
            CustomRole.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def get_role_permissions(
    session: AsyncSession, role_id: uuid.UUID,
) -> list[str]:
    result = await session.execute(
        select(Permission.code)
        .join(CustomRolePermission, CustomRolePermission.permission_id == Permission.id)
        .where(CustomRolePermission.custom_role_id == role_id)
    )
    return [row[0] for row in result.all()]


async def create_custom_role(
    session: AsyncSession,
    institute_id: uuid.UUID,
    name: str,
    description: str | None,
    view_type: str,
    permission_codes: list[str],
    actor: User,
) -> CustomRole:
    slug = _slugify(name)

    existing = await session.execute(
        select(CustomRole.id).where(
            CustomRole.institute_id == institute_id,
            CustomRole.slug == slug,
            CustomRole.deleted_at.is_(None),
        )
    )
    if existing.first():
        raise ValueError(f"A role with slug '{slug}' already exists in this institute")

    invalid = set(permission_codes) - ALL_PERMISSION_CODES
    if invalid:
        raise ValueError(f"Invalid permission codes: {', '.join(sorted(invalid))}")

    role = CustomRole(
        institute_id=institute_id,
        name=name,
        slug=slug,
        description=description,
        view_type=ViewType(view_type),
    )
    session.add(role)
    await session.flush()

    if permission_codes:
        perm_result = await session.execute(
            select(Permission).where(Permission.code.in_(permission_codes))
        )
        perms = perm_result.scalars().all()
        for perm in perms:
            session.add(CustomRolePermission(custom_role_id=role.id, permission_id=perm.id))

    session.add(ActivityLog(
        user_id=actor.id,
        action="custom_role.created",
        entity_type="custom_role",
        entity_id=role.id,
        details={"name": name, "slug": slug, "view_type": view_type, "permission_count": len(permission_codes)},
        institute_id=institute_id,
    ))

    await session.commit()
    await session.refresh(role)
    return role


async def update_custom_role(
    session: AsyncSession,
    role: CustomRole,
    name: str | None,
    description: str | None,
    view_type: str | None,
    actor: User,
) -> CustomRole:
    changes: dict = {}

    if name is not None and name != role.name:
        new_slug = _slugify(name)
        existing = await session.execute(
            select(CustomRole.id).where(
                CustomRole.institute_id == role.institute_id,
                CustomRole.slug == new_slug,
                CustomRole.id != role.id,
                CustomRole.deleted_at.is_(None),
            )
        )
        if existing.first():
            raise ValueError(f"A role with slug '{new_slug}' already exists")
        role.name = name
        role.slug = new_slug
        changes["name"] = name

    if description is not None:
        role.description = description
        changes["description"] = description

    if view_type is not None and view_type != role.view_type.value:
        role.view_type = ViewType(view_type)
        changes["view_type"] = view_type

    if changes:
        role.updated_at = datetime.now(timezone.utc)
        session.add(role)
        session.add(ActivityLog(
            user_id=actor.id,
            action="custom_role.updated",
            entity_type="custom_role",
            entity_id=role.id,
            details=changes,
            institute_id=role.institute_id,
        ))
        await session.commit()
        await session.refresh(role)

    return role


async def set_role_permissions(
    session: AsyncSession,
    role: CustomRole,
    permission_codes: list[str],
    actor: User,
) -> list[str]:
    invalid = set(permission_codes) - ALL_PERMISSION_CODES
    if invalid:
        raise ValueError(f"Invalid permission codes: {', '.join(sorted(invalid))}")

    old_perms = set(await get_role_permissions(session, role.id))
    new_perms = set(permission_codes)

    added = new_perms - old_perms
    removed = old_perms - new_perms

    if not added and not removed:
        return sorted(new_perms)

    # Remove old permissions
    if removed:
        perm_ids = await session.execute(
            select(Permission.id).where(Permission.code.in_(removed))
        )
        ids_to_remove = [row[0] for row in perm_ids.all()]
        if ids_to_remove:
            await session.execute(
                CustomRolePermission.__table__.delete().where(
                    CustomRolePermission.custom_role_id == role.id,
                    CustomRolePermission.permission_id.in_(ids_to_remove),
                )
            )

    # Add new permissions
    if added:
        perm_result = await session.execute(
            select(Permission).where(Permission.code.in_(added))
        )
        for perm in perm_result.scalars().all():
            session.add(CustomRolePermission(custom_role_id=role.id, permission_id=perm.id))

    role.updated_at = datetime.now(timezone.utc)
    session.add(role)

    session.add(ActivityLog(
        user_id=actor.id,
        action="custom_role.permissions_updated",
        entity_type="custom_role",
        entity_id=role.id,
        details={"added": sorted(added), "removed": sorted(removed)},
        institute_id=role.institute_id,
    ))

    await session.commit()

    # Invalidate permissions cache for all users with this custom role
    affected = await session.execute(
        select(User.id).where(
            User.custom_role_id == role.id,
            User.deleted_at.is_(None),
        )
    )
    for (uid,) in affected.all():
        await cache.delete(f"lms:perms:{uid}")
        await cache.delete(cache.user_key(str(uid)))

    return sorted(new_perms)


async def delete_custom_role(
    session: AsyncSession,
    role: CustomRole,
    actor: User,
) -> int:
    """Soft-delete a custom role. Returns count of affected users."""
    affected_result = await session.execute(
        select(User).where(
            User.custom_role_id == role.id,
            User.deleted_at.is_(None),
        )
    )
    affected_users = affected_result.scalars().all()
    affected_count = len(affected_users)

    for user in affected_users:
        user.role = UserRole.student
        user.custom_role_id = None
        user.token_version += 1
        session.add(user)
        await cache.delete(f"lms:perms:{user.id}")
        await cache.delete(cache.user_key(str(user.id)))

    role.deleted_at = datetime.now(timezone.utc)
    role.is_active = False
    session.add(role)

    session.add(ActivityLog(
        user_id=actor.id,
        action="custom_role.deleted",
        entity_type="custom_role",
        entity_id=role.id,
        details={"name": role.name, "affected_users": affected_count},
        institute_id=role.institute_id,
    ))

    await session.commit()
    return affected_count


async def assign_role_to_user(
    session: AsyncSession,
    target_user: User,
    role_slug: str,
    actor: User,
) -> User:
    """Assign a system or custom role to a user."""
    old_role = target_user.role.value
    old_custom_role_id = str(target_user.custom_role_id) if target_user.custom_role_id else None

    system_roles = {r.value for r in UserRole if r not in (UserRole.super_admin, UserRole.custom)}

    if role_slug in system_roles:
        target_user.role = UserRole(role_slug)
        target_user.custom_role_id = None
    else:
        cr = await session.execute(
            select(CustomRole).where(
                CustomRole.institute_id == target_user.institute_id,
                CustomRole.slug == role_slug,
                CustomRole.deleted_at.is_(None),
            )
        )
        custom_role = cr.scalar_one_or_none()
        if not custom_role:
            raise ValueError(f"Role '{role_slug}' not found")
        target_user.role = UserRole.custom
        target_user.custom_role_id = custom_role.id

    target_user.token_version += 1
    session.add(target_user)

    session.add(ActivityLog(
        user_id=actor.id,
        action="user.role_changed",
        entity_type="user",
        entity_id=target_user.id,
        details={
            "old_role": old_role,
            "old_custom_role_id": old_custom_role_id,
            "new_role": target_user.role.value,
            "new_custom_role_id": str(target_user.custom_role_id) if target_user.custom_role_id else None,
            "role_slug": role_slug,
        },
        institute_id=target_user.institute_id,
    ))

    await session.commit()

    await cache.delete(f"lms:perms:{target_user.id}")
    await cache.delete(cache.user_key(str(target_user.id)))

    await session.refresh(target_user)
    return target_user


def get_permission_groups() -> list[dict]:
    """Return permissions grouped by module for the admin UI."""
    groups: dict[str, list[dict]] = {}
    for code, module, action, description in PERMISSION_REGISTRY:
        if module not in groups:
            groups[module] = []
        groups[module].append({
            "code": code,
            "module": module,
            "action": action,
            "description": description,
        })

    module_labels = {
        "dashboard": "Dashboard",
        "users": "User Management",
        "courses": "Courses",
        "batches": "Batches",
        "lectures": "Lectures",
        "materials": "Materials",
        "curriculum": "Curriculum",
        "quizzes": "Quizzes",
        "zoom": "Zoom Classes",
        "announcements": "Announcements",
        "notifications": "Notifications",
        "certificates": "Certificates",
        "jobs": "Jobs",
        "admissions": "Admissions",
        "fees": "Fees",
        "payment_proof": "Payment Proof",
        "devices": "Devices",
        "settings": "Settings",
        "branding": "Branding",
        "email_templates": "Email Templates",
        "monitoring": "Monitoring",
        "api_keys": "API Keys",
        "webhooks": "Webhooks",
        "integrations": "Integrations",
        "billing": "Billing",
        "search": "Search",
        "feedback": "Feedback",
        "activity_log": "Activity Log",
        "export": "Export",
        "roles": "Roles & Permissions",
        "upgrade": "Upgrade",
    }

    return [
        {
            "module": module,
            "label": module_labels.get(module, module.replace("_", " ").title()),
            "permissions": perms,
        }
        for module, perms in groups.items()
    ]
