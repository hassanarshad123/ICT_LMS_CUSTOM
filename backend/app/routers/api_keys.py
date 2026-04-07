import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.schemas.api_key import ApiKeyCreate, ApiKeyOut, ApiKeyCreatedOut
from app.services import api_key_service
from app.utils.rate_limit import limiter

router = APIRouter()

Admin = Annotated[User, Depends(require_roles("admin"))]


@router.post("", response_model=ApiKeyCreatedOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def create_api_key(
    request: Request,
    body: ApiKeyCreate,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Create a new API key. The full key is returned once only."""
    from app.utils.plan_limits import check_creation_limit
    try:
        await check_creation_limit(session, current_user.institute_id, "api_keys")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    try:
        api_key, full_key = await api_key_service.create_api_key(
            session,
            institute_id=current_user.institute_id,
            name=body.name,
            created_by=current_user.id,
            expires_at=body.expires_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    data = ApiKeyOut.model_validate(api_key).model_dump()
    data["api_key"] = full_key
    return ApiKeyCreatedOut(**data)


@router.get("", response_model=list[ApiKeyOut])
async def list_api_keys(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """List all API keys for the current institute."""
    keys = await api_key_service.list_api_keys(session, current_user.institute_id)
    return [ApiKeyOut.model_validate(k) for k in keys]


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: uuid.UUID,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Revoke an API key."""
    try:
        await api_key_service.revoke_api_key(session, key_id, current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
