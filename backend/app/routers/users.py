import uuid
import io
import csv
import re
import secrets
import math
from dataclasses import dataclass
from typing import Annotated, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.database import get_session
from app.utils.rate_limit import limiter
from app.schemas.user import UserCreate, UserUpdate, UserOut, UserPublicOut, UserListResponse, StatusUpdate
from app.schemas.common import PaginatedResponse
from app.services.user_service import (
    _ensure_employee_id_unique,
    create_user,
    find_users_by_emails,
    get_user,
    list_users,
    update_user,
    deactivate_user,
    activate_user,
    soft_delete_user,
    force_logout_user,
)
from app.middleware.auth import require_roles, get_current_user
from app.middleware.access_control import check_billing_restriction
from app.models.user import User
from app.models.batch import StudentBatch, Batch
from app.models.institute import Institute
from app.models.enums import UserRole, UserStatus
from app.utils.security import hash_password
from app.utils.transformers import to_db
from app.services import webhook_event_service
from app.services.institute_service import (
    check_and_increment_student_quota,
    increment_staff_usage,
    decrement_usage,
)
from app.services.batch_service import enroll_student, get_batch
from app.models.settings import SystemSetting
from pydantic import BaseModel as PydanticBaseModel

router = APIRouter()


async def _get_default_student_password(session: AsyncSession, institute_id: uuid.UUID | None) -> str:
    """Get the default student password from institute settings. Falls back to 'changeme123'."""
    if institute_id is None:
        return "changeme123"
    result = await session.execute(
        select(SystemSetting).where(
            SystemSetting.setting_key == "default_student_password",
            SystemSetting.institute_id == institute_id,
        )
    )
    setting = result.scalar_one_or_none()
    return setting.value if setting else "changeme123"

AdminUser = Annotated[User, Depends(require_roles("admin"))]
AdminOrCC = Annotated[User, Depends(require_roles("admin", "course_creator"))]
AllRoles = Annotated[User, Depends(get_current_user)]


async def _enrich_user(session: AsyncSession, user: User) -> dict:
    """Add batch_ids and batch_names to user response."""
    data = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "phone": user.phone,
        "role": user.role.value,
        "specialization": user.specialization,
        "avatar_url": user.avatar_url,
        "status": user.status.value,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "employee_id": user.employee_id,
        "batch_ids": [],
        "batch_names": [],
        "batch_active_statuses": [],
        "join_date": user.created_at,
    }
    if user.role == UserRole.student:
        result = await session.execute(
            select(StudentBatch.batch_id, Batch.name, StudentBatch.is_active)
            .join(Batch, StudentBatch.batch_id == Batch.id)
            .where(
                StudentBatch.student_id == user.id,
                StudentBatch.removed_at.is_(None),
                Batch.deleted_at.is_(None),
            )
        )
        for row in result.all():
            data["batch_ids"].append(str(row[0]))
            data["batch_names"].append(row[1])
            data["batch_active_statuses"].append(row[2])

    return data


# /me routes MUST be before /{user_id}
@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    data = await _enrich_user(session, current_user)
    return UserOut(**data)


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Self-update: only name and phone
    allowed = {}
    payload = body.model_dump(exclude_unset=True)
    for key in ("name", "phone"):
        if key in payload:
            allowed[key] = payload[key]

    if allowed:
        user = await update_user(session, current_user.id, **allowed)
    else:
        user = current_user
    data = await _enrich_user(session, user)
    return UserOut(**data)


@router.get("", response_model=UserListResponse)
async def list_users_endpoint(
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    batch_id: Optional[uuid.UUID] = None,
):
    # Convert kebab-case role from API
    db_role = to_db(role) if role else None

    # Course creators can only see students and teachers, not admins or other CCs
    cc_allowed_roles = None
    if current_user.role.value == "course_creator" and not db_role:
        cc_allowed_roles = ["student", "teacher"]
    elif current_user.role.value == "course_creator" and db_role:
        if db_role not in ("student", "teacher"):
            # CC tried to filter by admin/course_creator — return empty
            return UserListResponse(data=[], total=0, page=page, per_page=per_page, total_pages=0)

    users, total = await list_users(
        session, page=page, per_page=per_page,
        role=db_role, status=status,
        search=search, batch_id=batch_id,
        institute_id=current_user.institute_id,
        allowed_roles=cc_allowed_roles,
    )

    # Batch-load batch data for all students on this page (single query)
    student_ids = [u.id for u in users if u.role == UserRole.student]
    batch_data: dict = {uid: {"ids": [], "names": [], "active_statuses": []} for uid in student_ids}
    if student_ids:
        r = await session.execute(
            select(StudentBatch.student_id, StudentBatch.batch_id, Batch.name, StudentBatch.is_active)
            .join(Batch, StudentBatch.batch_id == Batch.id)
            .where(
                StudentBatch.student_id.in_(student_ids),
                StudentBatch.removed_at.is_(None),
                Batch.deleted_at.is_(None),
            )
        )
        for sid, bid, bname, is_active in r.all():
            batch_data[sid]["ids"].append(str(bid))
            batch_data[sid]["names"].append(bname)
            batch_data[sid]["active_statuses"].append(is_active)

    enriched = []
    for u in users:
        bd = batch_data.get(u.id, {"ids": [], "names": [], "active_statuses": []})
        enriched.append(UserOut(
            id=u.id,
            email=u.email,
            name=u.name,
            phone=u.phone,
            role=u.role.value,
            specialization=u.specialization,
            employee_id=u.employee_id,
            avatar_url=u.avatar_url,
            status=u.status.value,
            created_at=u.created_at,
            updated_at=u.updated_at,
            batch_ids=bd["ids"],
            batch_names=bd["names"],
            batch_active_statuses=bd["active_statuses"],
            join_date=u.created_at,
        ))

    return UserListResponse(
        data=enriched,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_user_endpoint(
    body: UserCreate,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # CC cannot create admin users
    db_role = to_db(body.role) if body.role else body.role
    if current_user.role == UserRole.course_creator and db_role == "admin":
        raise HTTPException(status_code=403, detail="Course creators cannot create admin users")

    # Password logic: students use default password, other roles require explicit password
    if db_role == "student":
        password = await _get_default_student_password(session, current_user.institute_id)
    else:
        if not body.password:
            raise HTTPException(status_code=400, detail="Password is required for non-student roles")
        password = body.password

    # Students are capped (max_students); staff (admin/teacher/course_creator)
    # are uncapped but still tracked in current_users for SA visibility.
    if current_user.institute_id:
        # Pricing v2 billing-restriction gate — raises 402 on v2 tiers that
        # are 15+ days overdue. Grandfathered tiers (ICT, etc.) always pass.
        _inst = await session.get(Institute, current_user.institute_id)
        if _inst is not None:
            check_billing_restriction(
                _inst, "POST", is_student_add=(db_role == "student"),
            )

        if db_role == "student":
            try:
                await check_and_increment_student_quota(session, current_user.institute_id)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        else:
            await increment_staff_usage(session, current_user.institute_id)

    try:
        user = await create_user(
            session,
            email=body.email,
            name=body.name,
            password=password,
            role=db_role,
            phone=body.phone,
            specialization=body.specialization,
            institute_id=current_user.institute_id,
            employee_id=body.employee_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Auto-enroll in batch if batch_id provided and role is student
    batch_id = getattr(body, 'batch_id', None)

    if current_user.institute_id:
        await webhook_event_service.queue_webhook_event(
            session, current_user.institute_id, "user.created",
            {"user_id": str(user.id), "email": user.email, "name": user.name, "role": user.role.value},
        )
        await session.commit()

    # Send welcome email for students
    if db_role == "student" and current_user.institute_id:
        try:
            from app.utils.email_sender import send_email_background, get_institute_branding, build_login_url, build_reset_url, should_send_email
            from app.utils.email_templates import welcome_email
            if await should_send_email(session, current_user.institute_id, user.id, "email_welcome"):
                branding = await get_institute_branding(session, current_user.institute_id)
                subject, html = welcome_email(
                    student_name=user.name, email=user.email, default_password=password,
                    login_url=build_login_url(branding["slug"]),
                    reset_url=build_reset_url(branding["slug"]),
                    institute_name=branding["name"], logo_url=branding.get("logo_url"),
                    accent_color=branding.get("accent_color", "#C5D86D"),
                )
                send_email_background(user.email, subject, html, from_name=branding["name"])
        except Exception:
            pass

    # Audit log
    from app.services.activity_service import log_activity
    await log_activity(
        session, action="user.created", entity_type="user", entity_id=user.id,
        user_id=current_user.id, details={"email": user.email, "role": user.role.value},
        institute_id=current_user.institute_id,
    )
    await session.commit()

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "temporary_password": password,
    }


@router.get("/{user_id}", response_model=Union[UserOut, UserPublicOut])
async def get_user_endpoint(
    user_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    user = await get_user(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.institute_id != current_user.institute_id:
        raise HTTPException(status_code=404, detail="User not found")

    # Students viewing OTHER users get minimal info only
    if (
        current_user.role.value == "student"
        and user.id != current_user.id
    ):
        return UserPublicOut(
            id=user.id,
            name=user.name,
            role=user.role.value,
            avatar_url=user.avatar_url,
        )

    data = await _enrich_user(session, user)
    return UserOut(**data)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user_endpoint(
    user_id: uuid.UUID,
    body: UserUpdate,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Verify user belongs to same institute
    target = await get_user(session, user_id)
    if not target or target.institute_id != current_user.institute_id:
        raise HTTPException(status_code=404, detail="User not found")
    # Whitelist allowed fields — prevent escalation via role/institute_id/email
    allowed_fields = {"name", "phone", "specialization", "status", "bio", "social_links", "employee_id"}
    fields = {k: v for k, v in body.model_dump(exclude_unset=True).items() if k in allowed_fields}
    # Enforce per-institute uniqueness when employee_id is being changed
    if body.employee_id is not None and body.employee_id != target.employee_id:
        try:
            await _ensure_employee_id_unique(session, current_user.institute_id, body.employee_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    try:
        user = await update_user(session, user_id, **fields)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if current_user.institute_id:
        await webhook_event_service.queue_webhook_event(
            session, current_user.institute_id, "user.updated",
            {"user_id": str(user.id), "email": user.email, "name": user.name, "fields_updated": list(fields.keys())},
        )
        await session.commit()

    data = await _enrich_user(session, user)
    return UserOut(**data)


@router.patch("/{user_id}/status", response_model=UserOut)
async def change_user_status(
    user_id: uuid.UUID,
    body: StatusUpdate,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Verify user belongs to same institute
    target = await get_user(session, user_id)
    if not target or target.institute_id != current_user.institute_id:
        raise HTTPException(status_code=404, detail="User not found")

    new_status = body.status
    if new_status not in ("active", "inactive"):
        raise HTTPException(status_code=400, detail="Status must be 'active' or 'inactive'")

    try:
        if new_status == "inactive":
            user = await deactivate_user(session, user_id)
        else:
            user = await activate_user(session, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if current_user.institute_id and new_status == "inactive":
        await webhook_event_service.queue_webhook_event(
            session, current_user.institute_id, "user.deactivated",
            {"user_id": str(user.id), "email": user.email, "name": user.name},
        )
        await session.commit()

    data = await _enrich_user(session, user)
    return UserOut(**data)


class PasswordResetBody(PydanticBaseModel):
    new_password: str


@router.post("/{user_id}/reset-password")
@limiter.limit("10/minute")
async def reset_password(
    request: Request,
    user_id: uuid.UUID,
    body: PasswordResetBody,
    current_user: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    user = await get_user(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.institute_id != current_user.institute_id:
        raise HTTPException(status_code=404, detail="User not found")

    from app.schemas.validators import validate_password_strength
    try:
        validate_password_strength(body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    user.hashed_password = hash_password(body.new_password)
    session.add(user)
    await session.commit()

    return {"detail": "Password reset successfully"}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_endpoint(
    user_id: uuid.UUID,
    current_user: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Verify user belongs to same institute
    target = await get_user(session, user_id)
    if not target or target.institute_id != current_user.institute_id:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        await soft_delete_user(session, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Decrement usage counter (Fix 5)
    if current_user.institute_id:
        await decrement_usage(session, current_user.institute_id, users=1)

    if current_user.institute_id:
        await webhook_event_service.queue_webhook_event(
            session, current_user.institute_id, "user.deleted",
            {"user_id": str(target.id), "email": target.email, "name": target.name},
        )
        await session.commit()


@router.post("/{user_id}/force-logout", status_code=status.HTTP_204_NO_CONTENT)
async def force_logout_endpoint(
    user_id: uuid.UUID,
    current_user: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Verify user belongs to same institute
    target = await get_user(session, user_id)
    if not target or target.institute_id != current_user.institute_id:
        raise HTTPException(status_code=404, detail="User not found")
    await force_logout_user(session, user_id)


# ── Shared CSV parsing ────────────────────────────────────────

_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


@dataclass
class ValidatedRow:
    row_num: int
    name: str
    email: str
    phone: Optional[str]
    role: str  # db_role (snake_case)
    specialization: Optional[str]
    password: str


def _parse_and_validate_csv(
    text: str,
    default_student_password: str,
) -> tuple[list[ValidatedRow], list[dict], int, bool]:
    """Parse CSV text and validate rows.

    Returns (valid_rows, errors, total_rows, truncated).
    """
    reader = csv.DictReader(io.StringIO(text))
    all_rows = list(reader)
    total_rows = len(all_rows)
    truncated = total_rows > 500
    rows_to_process = all_rows[:500]

    valid_roles = {r.value for r in UserRole}
    valid_rows: list[ValidatedRow] = []
    errors: list[dict] = []

    for row_num, row in enumerate(rows_to_process, start=1):
        name = row.get("name", "").strip()
        email = row.get("email", "").strip().lower()
        phone = row.get("phone", "").strip() or None
        role = row.get("role", "student").strip()
        specialization = row.get("specialization", "").strip() or None

        if not name or not email:
            errors.append({"row": row_num, "error": "Missing name or email"})
            continue

        if not _EMAIL_RE.match(email):
            errors.append({"row": row_num, "error": f"Invalid email format: {email}"})
            continue

        db_role = to_db(role)
        if db_role not in valid_roles:
            errors.append({"row": row_num, "error": f"Invalid role: {role}. Must be student, teacher, admin, or course-creator"})
            continue

        if db_role == "student":
            password = default_student_password
        else:
            password = row.get("password", "").strip()
            if not password:
                errors.append({"row": row_num, "error": f"Password required for {role} role (add a 'password' column)"})
                continue

        valid_rows.append(ValidatedRow(
            row_num=row_num, name=name, email=email, phone=phone,
            role=db_role, specialization=specialization, password=password,
        ))

    return valid_rows, errors, total_rows, truncated


# ── Bulk Import Preview ──────────────────────────────────────

@router.post("/bulk-import/preview")
async def bulk_import_preview(
    file: UploadFile = File(...),
    batch_ids: str = Form(default=""),
    current_user: User = Depends(require_roles("admin", "course_creator")),
    session: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    # Parse batch IDs
    batch_id_list: list[uuid.UUID] = []
    for b in batch_ids.split(","):
        b = b.strip()
        if not b:
            continue
        try:
            bid = uuid.UUID(b)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid batch ID: {b}")
        batch = await get_batch(session, bid, institute_id=current_user.institute_id)
        if not batch:
            raise HTTPException(status_code=400, detail=f"Batch not found: {b}")
        batch_id_list.append(bid)

    content = await file.read()
    text = content.decode("utf-8-sig")

    default_student_password = await _get_default_student_password(session, current_user.institute_id)
    valid_rows, errors, total_rows, truncated = _parse_and_validate_csv(text, default_student_password)

    # Look up which emails already exist in the institute
    all_emails = [r.email for r in valid_rows]
    existing_map = await find_users_by_emails(session, all_emails, institute_id=current_user.institute_id)

    # Batch-check which existing students are already enrolled in target batches
    existing_student_ids = [
        u.id for u in existing_map.values()
        if u.role == UserRole.student
    ]
    already_enrolled_pairs: set[tuple[uuid.UUID, uuid.UUID]] = set()
    if existing_student_ids and batch_id_list:
        result = await session.execute(
            select(StudentBatch.student_id, StudentBatch.batch_id).where(
                StudentBatch.student_id.in_(existing_student_ids),
                StudentBatch.batch_id.in_(batch_id_list),
                StudentBatch.removed_at.is_(None),
            )
        )
        for sid, bid in result.all():
            already_enrolled_pairs.add((sid, bid))

    # Categorize each valid row
    new_users: list[dict] = []
    existing_users: list[dict] = []
    role_mismatches: list[dict] = []

    for row in valid_rows:
        existing_user = existing_map.get(row.email.lower())
        if existing_user is None:
            new_users.append({"row": row.row_num, "name": row.name, "email": row.email})
        elif existing_user.role != UserRole.student:
            role_mismatches.append({
                "row": row.row_num,
                "name": row.name,
                "email": row.email,
                "user_id": str(existing_user.id),
                "actual_role": existing_user.role.value,
            })
        else:
            already_in = [
                str(bid) for bid in batch_id_list
                if (existing_user.id, bid) in already_enrolled_pairs
            ]
            existing_users.append({
                "row": row.row_num,
                "name": row.name,
                "email": row.email,
                "user_id": str(existing_user.id),
                "db_name": existing_user.name,
                "already_in_batches": already_in,
            })

    return {
        "new_users": new_users,
        "existing_users": existing_users,
        "role_mismatches": role_mismatches,
        "errors": errors,
        "total_new": len(new_users),
        "total_existing": len(existing_users),
        "total_role_mismatches": len(role_mismatches),
        "total_errors": len(errors),
        "truncated": truncated,
        "total_rows": total_rows,
    }


# ── Bulk Import ──────────────────────────────────────────────

@router.post("/bulk-import")
async def bulk_import(
    file: UploadFile = File(...),
    batch_ids: str = Form(default=""),
    enroll_user_ids: str = Form(default=""),
    current_user: User = Depends(require_roles("admin", "course_creator")),
    session: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    # Parse and validate batch IDs
    batch_id_list: list[uuid.UUID] = []
    for b in batch_ids.split(","):
        b = b.strip()
        if not b:
            continue
        try:
            bid = uuid.UUID(b)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid batch ID: {b}")
        batch = await get_batch(session, bid, institute_id=current_user.institute_id)
        if not batch:
            raise HTTPException(status_code=400, detail=f"Batch not found: {b}")
        batch_id_list.append(bid)

    # Parse enroll_user_ids (existing users to enroll instead of create)
    enroll_set: set[uuid.UUID] = set()
    for uid_str in enroll_user_ids.split(","):
        uid_str = uid_str.strip()
        if not uid_str:
            continue
        try:
            enroll_set.add(uuid.UUID(uid_str))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid enroll user ID: {uid_str}")

    content = await file.read()
    text = content.decode("utf-8-sig")

    default_student_password = await _get_default_student_password(session, current_user.institute_id)
    valid_rows, errors, total_rows, truncated = _parse_and_validate_csv(text, default_student_password)

    # Pricing v2 billing-restriction gate — fail the whole bulk import fast
    # rather than processing 500 rows and stopping mid-way with a 402. Bulk
    # import always creates students, so is_student_add=True.
    if current_user.institute_id:
        _inst = await session.get(Institute, current_user.institute_id)
        if _inst is not None:
            check_billing_restriction(_inst, "POST", is_student_add=True)

    # Pre-fetch existing users if enroll_set is provided
    existing_map: dict[str, User] = {}
    if enroll_set:
        all_emails = [r.email for r in valid_rows]
        existing_map = await find_users_by_emails(session, all_emails, institute_id=current_user.institute_id)

    imported = 0
    skipped = 0
    enrolled_count = 0
    enrolled_existing = 0
    created_users: list[dict] = []
    existing_enrolled_users: list[dict] = []
    branding_cache: dict | None = None  # per-request cache (not global)

    for row in valid_rows:
        # Check if this email belongs to an existing user we should enroll
        existing_user = existing_map.get(row.email.lower()) if enroll_set else None

        if existing_user is not None and existing_user.id in enroll_set:
            # Existing user — enroll in batches without creating
            if existing_user.role != UserRole.student:
                errors.append({"row": row.row_num, "error": f"Cannot enroll {row.email}: user is a {existing_user.role.value}, not a student"})
                continue

            if not batch_id_list:
                errors.append({"row": row.row_num, "error": f"No batches selected for existing user {row.email}"})
                continue

            row_enrolled = False
            for bid in batch_id_list:
                try:
                    await enroll_student(session, bid, existing_user.id, enrolled_by=current_user.id, institute_id=current_user.institute_id)
                    enrolled_count += 1
                    row_enrolled = True
                except ValueError as enroll_err:
                    err_msg = str(enroll_err)
                    if "already enrolled" in err_msg.lower():
                        errors.append({"row": row.row_num, "error": f"Already enrolled in batch (skipped): {row.email}"})
                    else:
                        errors.append({"row": row.row_num, "error": f"Enrollment failed for batch {bid}: {enroll_err}"})

            if row_enrolled:
                enrolled_existing += 1
                existing_enrolled_users.append({
                    "row": row.row_num,
                    "name": existing_user.name,
                    "email": row.email,
                    "temporary_password": "Existing account",
                })
            continue

        # New user — create + enroll (original behavior)
        # Students are capped (max_students); staff are uncapped but tracked.
        quota_incremented = False
        if current_user.institute_id:
            if row.role == "student":
                try:
                    await check_and_increment_student_quota(session, current_user.institute_id)
                    quota_incremented = True
                except ValueError as e:
                    errors.append({"row": row.row_num, "error": str(e)})
                    continue
            else:
                await increment_staff_usage(session, current_user.institute_id)
                quota_incremented = True

        try:
            user = await create_user(
                session, email=row.email, name=row.name, password=row.password,
                role=row.role, phone=row.phone, specialization=row.specialization,
                institute_id=current_user.institute_id,
            )
            imported += 1
            created_users.append({
                "row": row.row_num,
                "name": row.name,
                "email": row.email,
                "temporary_password": "(default password)" if row.role == "student" else row.password,
            })

            # Send welcome email for students (bulk import)
            if row.role == "student" and current_user.institute_id:
                try:
                    from app.utils.email_sender import send_email_background, get_institute_branding, build_login_url, build_reset_url, should_send_email
                    from app.utils.email_templates import welcome_email as _welcome_tpl
                    if await should_send_email(session, current_user.institute_id, user.id, "email_welcome"):
                        if branding_cache is None:
                            branding_cache = await get_institute_branding(session, current_user.institute_id)
                        br = branding_cache
                        subj, html = _welcome_tpl(
                            student_name=row.name, email=row.email, default_password=row.password,
                            login_url=build_login_url(br["slug"]),
                            reset_url=build_reset_url(br["slug"]),
                            institute_name=br["name"], logo_url=br.get("logo_url"),
                            accent_color=br.get("accent_color", "#C5D86D"),
                        )
                        send_email_background(row.email, subj, html, from_name=br["name"])
                except Exception:
                    pass

            # Auto-enroll in selected batches (students only)
            if batch_id_list and row.role == "student":
                for bid in batch_id_list:
                    try:
                        await enroll_student(session, bid, user.id, enrolled_by=current_user.id, institute_id=current_user.institute_id)
                        enrolled_count += 1
                    except ValueError as enroll_err:
                        errors.append({"row": row.row_num, "error": f"Enrollment failed for batch {bid}: {enroll_err}"})
        except ValueError as e:
            # Roll back the quota increment since user creation failed
            if quota_incremented:
                await decrement_usage(session, current_user.institute_id, users=1)
            if "already in use" in str(e):
                skipped += 1
                errors.append({"row": row.row_num, "error": f"Duplicate email (skipped): {row.email}"})
            else:
                errors.append({"row": row.row_num, "error": str(e)})

    return {
        "imported": imported,
        "skipped": skipped,
        "enrolled": enrolled_count,
        "enrolled_existing": enrolled_existing,
        "errors": errors,
        "created_users": created_users,
        "existing_enrolled_users": existing_enrolled_users,
        "truncated": truncated,
        "total_rows": total_rows,
    }


# ── Email Preferences ──────────────────────────────────────────

_SUBSCRIBABLE_TYPES = [
    {"email_type": "email_enrollment", "label": "Enrollment Confirmation", "description": "When you're added to a new batch"},
    {"email_type": "email_batch_expiry_7d", "label": "Batch Expiry Warning (7 days)", "description": "Reminder 7 days before access ends"},
    {"email_type": "email_batch_expiry_1d", "label": "Batch Expiry Warning (1 day)", "description": "Urgent reminder 1 day before access ends"},
    {"email_type": "email_batch_expired", "label": "Batch Expired", "description": "Notification when batch access has expired"},
    {"email_type": "email_announcement", "label": "Announcements", "description": "Institute and batch announcements"},
    {"email_type": "email_quiz_graded", "label": "Quiz Results", "description": "When your quiz has been graded"},
    {"email_type": "email_zoom_reminder", "label": "Class Reminders", "description": "Zoom class reminders 15 minutes before"},
]


@router.get("/me/email-preferences")
async def get_email_preferences(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from sqlalchemy import text

    result = []
    for item in _SUBSCRIBABLE_TYPES:
        r = await session.execute(
            text("SELECT subscribed FROM user_email_preferences WHERE user_id = :uid AND email_type = :et"),
            {"uid": str(current_user.id), "et": item["email_type"]},
        )
        row = r.one_or_none()
        subscribed = bool(row[0]) if row else True
        result.append({**item, "subscribed": subscribed})

    return {"preferences": result}


class EmailPreferenceUpdate(PydanticBaseModel):
    email_type: str
    subscribed: bool


class EmailPreferencesUpdateBody(PydanticBaseModel):
    preferences: list[EmailPreferenceUpdate]


@router.patch("/me/email-preferences")
async def update_email_preferences(
    body: EmailPreferencesUpdateBody,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from sqlalchemy import text
    from datetime import datetime, timezone

    valid_types = {t["email_type"] for t in _SUBSCRIBABLE_TYPES}

    for pref in body.preferences:
        if pref.email_type not in valid_types:
            continue

        # Upsert
        r = await session.execute(
            text("SELECT id FROM user_email_preferences WHERE user_id = :uid AND email_type = :et"),
            {"uid": str(current_user.id), "et": pref.email_type},
        )
        existing = r.scalar_one_or_none()

        if existing:
            await session.execute(
                text("UPDATE user_email_preferences SET subscribed = :sub, updated_at = :now WHERE id = :id"),
                {"sub": pref.subscribed, "now": datetime.now(timezone.utc), "id": str(existing)},
            )
        else:
            import uuid as _uuid
            await session.execute(
                text("INSERT INTO user_email_preferences (id, user_id, email_type, subscribed) VALUES (:id, :uid, :et, :sub)"),
                {"id": str(_uuid.uuid4()), "uid": str(current_user.id), "et": pref.email_type, "sub": pref.subscribed},
            )

    await session.commit()
    return {"detail": "Preferences updated"}
