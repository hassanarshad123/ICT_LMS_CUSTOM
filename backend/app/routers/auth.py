from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.auth import LoginRequest, LoginResponse, RefreshRequest, TokenResponse, UserBrief
from app.services.auth_service import authenticate_user, refresh_access_token, logout
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        user, access_token, refresh_token = await authenticate_user(
            session=session,
            email=body.email,
            password=body.password,
            device_info=body.device_info,
            ip_address=request.client.host if request.client else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserBrief(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role.value,
            avatar_url=user.avatar_url,
        ),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        access_token = await refresh_access_token(session, body.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_endpoint(
    body: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    await logout(session, body.refresh_token)


@router.get("/me", response_model=UserBrief)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
):
    return UserBrief(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role.value,
        avatar_url=current_user.avatar_url,
    )
