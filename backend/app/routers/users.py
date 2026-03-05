import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.user import UserCreate, UserUpdate, UserOut, UserListResponse
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
from app.middleware.auth import require_roles
from app.models.user import User

router = APIRouter()

AdminUser = Annotated[User, Depends(require_roles("admin"))]
AdminOrCC = Annotated[User, Depends(require_roles("admin", "course_creator"))]


@router.get("", response_model=UserListResponse)
async def list_users_endpoint(
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    users, total = await list_users(
        session, page=page, per_page=per_page, role=role, status=status, search=search
    )
    return UserListResponse(
        data=[UserOut.model_validate(u) for u in users],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{user_id}", response_model=UserOut)
async def get_user_endpoint(
    user_id: uuid.UUID,
    current_user: AdminOrCC,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    user = await get_user(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user_endpoint(
    body: UserCreate,
    current_user: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        user = await create_user(
            session,
            email=body.email,
            name=body.name,
            password=body.password,
            role=body.role,
            phone=body.phone,
            specialization=body.specialization,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user_endpoint(
    user_id: uuid.UUID,
    body: UserUpdate,
    current_user: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        user = await update_user(
            session, user_id, **body.model_dump(exclude_unset=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return UserOut.model_validate(user)


@router.post("/{user_id}/deactivate", response_model=UserOut)
async def deactivate_user_endpoint(
    user_id: uuid.UUID,
    current_user: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        user = await deactivate_user(session, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return UserOut.model_validate(user)


@router.post("/{user_id}/activate", response_model=UserOut)
async def activate_user_endpoint(
    user_id: uuid.UUID,
    current_user: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        user = await activate_user(session, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return UserOut.model_validate(user)


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
