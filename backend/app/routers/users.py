import uuid
import io
import csv
import secrets
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.database import get_session
from app.schemas.user import UserCreate, UserUpdate, UserOut, UserListResponse, StatusUpdate
from app.schemas.common import PaginatedResponse
from app.services.user_service import (
    create_user,
    get_user,
    list_users,
    update_user,
    deactivate_user,
    activate_user,
    soft_delete_user,
    force_logout_user,
)
from app.middleware.auth import require_roles, get_current_user
from app.models.user import User
from app.models.batch import StudentBatch, Batch
from app.models.enums import UserRole, UserStatus
from app.utils.security import hash_password
from app.utils.transformers import to_db
from app.services import webhook_event_service
from app.services.institute_service import check_user_quota, increment_usage, decrement_usage

router = APIRouter()

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
        "batch_ids": [],
        "batch_names": [],
        "join_date": user.created_at,
    }
    if user.role == UserRole.student:
        result = await session.execute(
            select(StudentBatch.batch_id, Batch.name)
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

    users, total = await list_users(
        session, page=page, per_page=per_page, role=db_role, status=status,
        search=search, batch_id=batch_id, institute_id=current_user.institute_id,
    )

    # Batch-load batch data for all students on this page (single query)
    student_ids = [u.id for u in users if u.role == UserRole.student]
    batch_data: dict = {uid: {"ids": [], "names": []} for uid in student_ids}
    if student_ids:
        r = await session.execute(
            select(StudentBatch.student_id, StudentBatch.batch_id, Batch.name)
            .join(Batch, StudentBatch.batch_id == Batch.id)
            .where(
                StudentBatch.student_id.in_(student_ids),
                StudentBatch.removed_at.is_(None),
                Batch.deleted_at.is_(None),
            )
        )
        for sid, bid, bname in r.all():
            batch_data[sid]["ids"].append(str(bid))
            batch_data[sid]["names"].append(bname)

    enriched = []
    for u in users:
        bd = batch_data.get(u.id, {"ids": [], "names": []})
        enriched.append(UserOut(
            id=u.id,
            email=u.email,
            name=u.name,
            phone=u.phone,
            role=u.role.value,
            specialization=u.specialization,
            avatar_url=u.avatar_url,
            status=u.status.value,
            created_at=u.created_at,
            updated_at=u.updated_at,
            batch_ids=bd["ids"],
            batch_names=bd["names"],
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

    # Generate temporary password if not provided
    password = body.password if body.password else secrets.token_urlsafe(8)

    # Enforce user quota before creation (Fix 5)
    if current_user.institute_id:
        try:
            await check_user_quota(session, current_user.institute_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

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
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Increment usage counter (Fix 5)
    if current_user.institute_id:
        await increment_usage(session, current_user.institute_id, users=1)

    # Auto-enroll in batch if batch_id provided and role is student
    batch_id = getattr(body, 'batch_id', None)

    if current_user.institute_id:
        await webhook_event_service.queue_webhook_event(
            session, current_user.institute_id, "user.created",
            {"user_id": str(user.id), "email": user.email, "name": user.name, "role": user.role.value},
        )
        await session.commit()

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "temporary_password": password,
    }


@router.get("/{user_id}", response_model=UserOut)
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
    fields = body.model_dump(exclude_unset=True)
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


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: uuid.UUID,
    current_user: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    user = await get_user(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.institute_id != current_user.institute_id:
        raise HTTPException(status_code=404, detail="User not found")

    temp_password = secrets.token_urlsafe(8)
    user.hashed_password = hash_password(temp_password)
    session.add(user)
    await session.commit()

    return {"temporary_password": temp_password}


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


@router.post("/bulk-import")
async def bulk_import(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("admin")),
    session: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    imported = 0
    skipped = 0
    errors = []
    row_num = 0

    for row in reader:
        row_num += 1
        if row_num > 500:
            break

        name = row.get("name", "").strip()
        email = row.get("email", "").strip()
        phone = row.get("phone", "").strip() or None
        role = row.get("role", "student").strip()
        specialization = row.get("specialization", "").strip() or None

        if not name or not email:
            errors.append({"row": row_num, "error": f"Missing name or email"})
            continue

        # Enforce user quota per row (Fix 5)
        if current_user.institute_id:
            try:
                await check_user_quota(session, current_user.institute_id)
            except ValueError as e:
                errors.append({"row": row_num, "error": str(e)})
                continue

        db_role = to_db(role)
        password = secrets.token_urlsafe(8)

        try:
            await create_user(
                session, email=email, name=name, password=password,
                role=db_role, phone=phone, specialization=specialization,
                institute_id=current_user.institute_id,
            )
            imported += 1
            # Increment usage counter (Fix 5)
            if current_user.institute_id:
                await increment_usage(session, current_user.institute_id, users=1)
        except ValueError as e:
            if "already in use" in str(e):
                skipped += 1
            else:
                errors.append({"row": row_num, "error": str(e)})

    return {"imported": imported, "skipped": skipped, "errors": errors}
