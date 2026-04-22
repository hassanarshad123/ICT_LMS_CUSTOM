from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.schemas.sa_search import SASearchResponse
from app.services import sa_search_service

router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


@router.get("/search", response_model=SASearchResponse)
async def sa_search(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(3, ge=1, le=5),
):
    return await sa_search_service.sa_global_search(session, q, limit)
