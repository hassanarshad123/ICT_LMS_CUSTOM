from typing import Annotated
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.schemas.auth import (
    LoginRequest, LoginResponse, RefreshRequest, TokenResponse,
    UserBrief, ChangePasswordRequest, LogoutAllResponse,
)
from app.services.auth_service import authenticate_user, refresh_access_token, logout, logout_all
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.institute import Institute
from app.models.batch import StudentBatch, Batch
from app.models.enums import UserRole
from app.utils.security import verify_password, hash_password
from app.utils.rate_limit import limiter

router = APIRouter()


async def _build_user_brief(session: AsyncSession, user: User) -> UserBrief:
    batch_ids = []
    batch_names = []
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
            batch_ids.append(str(row[0]))
            batch_names.append(row[1])

    # Resolve institute slug if user belongs to an institute
    institute_slug = None
    if user.institute_id is not None:
        institute = await session.get(Institute, user.institute_id)
        if institute:
            institute_slug = institute.slug

    return UserBrief(
        id=user.id,
        email=user.email,
        name=user.name,
        phone=user.phone,
        role=user.role.value,
        status=user.status.value,
        avatar_url=user.avatar_url,
        batch_ids=batch_ids,
        batch_names=batch_names,
        institute_id=user.institute_id,
        institute_slug=institute_slug,
    )


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_institute_slug: Optional[str] = Header(default=None, alias="X-Institute-Slug"),
):
    # Resolve institute by slug if header is provided
    institute_id = None
    if x_institute_slug:
        result = await session.execute(
            select(Institute).where(
                Institute.slug == x_institute_slug,
                Institute.deleted_at.is_(None),
            )
        )
        institute = result.scalar_one_or_none()
        if not institute:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Institute '{x_institute_slug}' not found",
            )
        institute_id = institute.id

    try:
        user, access_token, refresh_token = await authenticate_user(
            session=session,
            email=body.email,
            password=body.password,
            device_info=body.device_info,
            ip_address=request.client.host if request.client else None,
            institute_id=institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    user_brief = await _build_user_brief(session, user)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_brief,
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("10/minute")
async def refresh(
    request: Request,
    body: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        access_token = await refresh_access_token(session, body.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    return TokenResponse(access_token=access_token)


@router.post("/logout")
async def logout_endpoint(
    body: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    await logout(session, body.refresh_token)
    return {"detail": "Logged out successfully"}


@router.post("/logout-all", response_model=LogoutAllResponse)
async def logout_all_endpoint(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    count = await logout_all(session, current_user.id)
    return LogoutAllResponse(
        detail="All sessions terminated",
        sessions_terminated=count,
    )


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")

    current_user.hashed_password = hash_password(body.new_password)
    session.add(current_user)

    # Logout all devices after password change
    count = await logout_all(session, current_user.id)

    return {"detail": "Password changed successfully"}


@router.get("/me", response_model=UserBrief)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await _build_user_brief(session, current_user)
