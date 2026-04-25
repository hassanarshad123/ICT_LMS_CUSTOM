"""Admin-only endpoints for custom role management and permission queries."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.middleware.auth import get_current_user
from app.models.enums import UserRole
from app.models.user import User
from app.rbac import service as rbac_service
from app.rbac.constants import SYSTEM_ROLE_PERMISSIONS
from app.rbac.dependencies import get_user_permissions, require_permissions
from app.rbac.schemas import (
    AssignRoleRequest,
    CustomRoleCreate,
    CustomRoleDetailOut,
    CustomRoleOut,
    CustomRoleUpdate,
    PermissionGroupOut,
    PermissionOut,
    SetPermissionsRequest,
    SystemRolePermissionsOut,
    UserPermissionsOut,
)

router = APIRouter(tags=["Roles & Permissions"])

CanManageRoles = Annotated[User, Depends(require_permissions("roles.view"))]


# ── Permission Registry ─────────────────────────────────────────

@router.get("/admin/permissions", response_model=list[PermissionGroupOut])
async def list_permission_groups(current_user: CanManageRoles):
    """List all available permissions grouped by module."""
    groups = rbac_service.get_permission_groups()
    return [
        PermissionGroupOut(
            module=g["module"],
            label=g["label"],
            permissions=[
                PermissionOut(
                    code=p["code"],
                    module=p["module"],
                    action=p["action"],
                    description=p["description"],
                )
                for p in g["permissions"]
            ],
        )
        for g in groups
    ]


@router.get("/admin/system-roles", response_model=list[SystemRolePermissionsOut])
async def list_system_role_permissions(current_user: CanManageRoles):
    """List system roles with their immutable permission sets."""
    return [
        SystemRolePermissionsOut(role=role, permissions=sorted(perms))
        for role, perms in SYSTEM_ROLE_PERMISSIONS.items()
    ]


# ── Current User Permissions ────────────────────────────────────

@router.get("/auth/permissions", response_model=UserPermissionsOut)
async def get_my_permissions(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get the current user's resolved permissions."""
    view_type = getattr(current_user, "_view_type", None)
    custom_role_id = current_user.custom_role_id
    custom_role_slug = None

    _VIEW_TYPE_MAP = {
        "admin": "admin_view",
        "course_creator": "admin_view",
        "teacher": "staff_view",
        "student": "student_view",
        "admissions_officer": "staff_view",
    }

    if current_user.role == UserRole.super_admin:
        perm_list = ["*"]
        view_type = None
    elif current_user.role != UserRole.custom:
        perm_list = sorted(SYSTEM_ROLE_PERMISSIONS.get(current_user.role.value, []))
        view_type = _VIEW_TYPE_MAP.get(current_user.role.value)
    else:
        perms = await get_user_permissions(current_user, session)
        perm_list = sorted(perms)
        if custom_role_id:
            from app.rbac.models import CustomRole
            cr = await session.execute(
                select(CustomRole.slug, CustomRole.view_type).where(CustomRole.id == custom_role_id)
            )
            row = cr.first()
            if row:
                custom_role_slug = row[0]
                view_type = row[1].value if row[1] else view_type

    return UserPermissionsOut(
        permissions=perm_list,
        view_type=view_type,
        custom_role_id=custom_role_id,
        custom_role_slug=custom_role_slug,
    )


# ── Custom Role CRUD ────────────────────────────────────────────

@router.get("/admin/roles", response_model=list[CustomRoleOut])
async def list_roles(
    current_user: CanManageRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """List all custom roles for the current institute."""
    rows = await rbac_service.list_custom_roles(session, current_user.institute_id)
    return [
        CustomRoleOut(
            id=r["role"].id,
            institute_id=r["role"].institute_id,
            name=r["role"].name,
            slug=r["role"].slug,
            description=r["role"].description,
            view_type=r["role"].view_type.value,
            is_active=r["role"].is_active,
            user_count=r["user_count"],
            created_at=r["role"].created_at,
            updated_at=r["role"].updated_at,
        )
        for r in rows
    ]


@router.post("/admin/roles", response_model=CustomRoleDetailOut, status_code=201)
async def create_role(
    body: CustomRoleCreate,
    current_user: CanManageRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Create a new custom role."""
    try:
        role = await rbac_service.create_custom_role(
            session=session,
            institute_id=current_user.institute_id,
            name=body.name,
            description=body.description,
            view_type=body.view_type,
            permission_codes=body.permissions,
            actor=current_user,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    perms = await rbac_service.get_role_permissions(session, role.id)
    return CustomRoleDetailOut(
        id=role.id,
        institute_id=role.institute_id,
        name=role.name,
        slug=role.slug,
        description=role.description,
        view_type=role.view_type.value,
        is_active=role.is_active,
        user_count=0,
        permissions=sorted(perms),
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


@router.get("/admin/roles/{role_id}", response_model=CustomRoleDetailOut)
async def get_role(
    role_id: uuid.UUID,
    current_user: CanManageRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get a custom role with its permissions."""
    role = await rbac_service.get_custom_role(session, role_id, current_user.institute_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    perms = await rbac_service.get_role_permissions(session, role.id)
    user_count_result = await session.execute(
        select(User.id).where(User.custom_role_id == role.id, User.deleted_at.is_(None))
    )
    user_count = len(user_count_result.all())

    return CustomRoleDetailOut(
        id=role.id,
        institute_id=role.institute_id,
        name=role.name,
        slug=role.slug,
        description=role.description,
        view_type=role.view_type.value,
        is_active=role.is_active,
        user_count=user_count,
        permissions=sorted(perms),
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


@router.patch("/admin/roles/{role_id}", response_model=CustomRoleOut)
async def update_role(
    role_id: uuid.UUID,
    body: CustomRoleUpdate,
    current_user: CanManageRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Update a custom role's name, description, or view type."""
    role = await rbac_service.get_custom_role(session, role_id, current_user.institute_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    try:
        role = await rbac_service.update_custom_role(
            session=session,
            role=role,
            name=body.name,
            description=body.description,
            view_type=body.view_type,
            actor=current_user,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return CustomRoleOut(
        id=role.id,
        institute_id=role.institute_id,
        name=role.name,
        slug=role.slug,
        description=role.description,
        view_type=role.view_type.value,
        is_active=role.is_active,
        user_count=0,
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


@router.delete("/admin/roles/{role_id}")
async def delete_role(
    role_id: uuid.UUID,
    current_user: CanManageRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Soft-delete a custom role. Affected users fall back to student."""
    role = await rbac_service.get_custom_role(session, role_id, current_user.institute_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    affected = await rbac_service.delete_custom_role(session, role, current_user)
    return {"detail": f"Role deleted. {affected} user(s) reassigned to student."}


@router.put("/admin/roles/{role_id}/permissions")
async def replace_role_permissions(
    role_id: uuid.UUID,
    body: SetPermissionsRequest,
    current_user: CanManageRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Replace all permissions for a custom role."""
    role = await rbac_service.get_custom_role(session, role_id, current_user.institute_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    try:
        perms = await rbac_service.set_role_permissions(
            session, role, body.permissions, current_user,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"permissions": perms}


# ── User Role Assignment ────────────────────────────────────────

@router.patch("/users/{user_id}/assign-role")
async def assign_user_role(
    user_id: uuid.UUID,
    body: AssignRoleRequest,
    current_user: CanManageRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Assign a system or custom role to a user."""
    target = await session.execute(
        select(User).where(
            User.id == user_id,
            User.institute_id == current_user.institute_id,
            User.deleted_at.is_(None),
        )
    )
    target_user = target.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.role == UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Cannot change super admin role")

    try:
        user = await rbac_service.assign_role_to_user(
            session, target_user, body.role_slug, current_user,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {
        "detail": f"Role updated to '{body.role_slug}'",
        "user_id": str(user.id),
        "role": user.role.value,
        "custom_role_id": str(user.custom_role_id) if user.custom_role_id else None,
    }
