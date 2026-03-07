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
from app.schemas.user import UserCreate, UserUpdate, UserOut, UserListResponse
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
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Self-update: only name and phone
    allowed = {}
    data = body.model_dump(exclude_unset=True)
    for key in ("name", "phone"):
        if key in data:
            allowed[key] = data[key]

    if allowed:
        user = await update_user(session, current_user.id, **allowed)
    else:
        user = current_user
    return UserOut.model_validate(user)


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
        session, page=page, per_page=per_page, role=db_role, status=status, search=search
    )

    # Filter by batch_id if provided
    if batch_id:
        result = await session.execute(
            select(StudentBatch.student_id).where(
                StudentBatch.batch_id == batch_id, StudentBatch.removed_at.is_(None)
            )
        )
        enrolled_ids = {row[0] for row in result.all()}
        users = [u for u in users if u.id in enrolled_ids]
        total = len(users)

    return UserListResponse(
        data=[UserOut.model_validate(u) for u in users],
        total=total,
        page=page,
        per_page=per_page,
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

    try:
        user = await create_user(
            session,
            email=body.email,
            name=body.name,
            password=password,
            role=db_role,
            phone=body.phone,
            specialization=body.specialization,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Auto-enroll in batch if batch_id provided and role is student
    batch_id = getattr(body, 'batch_id', None)

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
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user_endpoint(
    user_id: uuid.UUID,
    body: UserUpdate,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        user = await update_user(
            session, user_id, **body.model_dump(exclude_unset=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return UserOut.model_validate(user)


@router.patch("/{user_id}/status", response_model=UserOut)
async def change_user_status(
    user_id: uuid.UUID,
    body: dict,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    new_status = body.get("status")
    if new_status not in ("active", "inactive"):
        raise HTTPException(status_code=400, detail="Status must be 'active' or 'inactive'")

    try:
        if new_status == "inactive":
            user = await deactivate_user(session, user_id)
        else:
            user = await activate_user(session, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return UserOut.model_validate(user)


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: uuid.UUID,
    current_user: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    user = await get_user(session, user_id)
    if not user:
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
    try:
        await soft_delete_user(session, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{user_id}/force-logout", status_code=status.HTTP_204_NO_CONTENT)
async def force_logout_endpoint(
    user_id: uuid.UUID,
    current_user: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
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

        db_role = to_db(role)
        password = secrets.token_urlsafe(8)

        try:
            await create_user(
                session, email=email, name=name, password=password,
                role=db_role, phone=phone, specialization=specialization,
            )
            imported += 1
        except ValueError as e:
            if "already in use" in str(e):
                skipped += 1
            else:
                errors.append({"row": row_num, "error": str(e)})

    return {"imported": imported, "skipped": skipped, "errors": errors}
