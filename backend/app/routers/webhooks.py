import math
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.webhook import (
    WebhookCreate, WebhookUpdate, WebhookOut,
    WebhookTestResult, WebhookDeliveryOut,
)
from app.services import webhook_service

router = APIRouter()

Admin = Annotated[User, Depends(require_roles("admin"))]


@router.post("", response_model=WebhookOut, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    body: WebhookCreate,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Create a new webhook endpoint."""
    try:
        webhook = await webhook_service.create_webhook(
            session,
            institute_id=current_user.institute_id,
            url=body.url,
            events=body.events,
            created_by=current_user.id,
            description=body.description,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return WebhookOut.model_validate(webhook)


@router.get("", response_model=list[WebhookOut])
async def list_webhooks(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """List all webhooks for the current institute."""
    webhooks = await webhook_service.list_webhooks(session, current_user.institute_id)
    return [WebhookOut.model_validate(w) for w in webhooks]


@router.get("/{webhook_id}", response_model=WebhookOut)
async def get_webhook(
    webhook_id: uuid.UUID,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get a single webhook."""
    webhook = await webhook_service.get_webhook(session, webhook_id, current_user.institute_id)
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    return WebhookOut.model_validate(webhook)


@router.patch("/{webhook_id}", response_model=WebhookOut)
async def update_webhook(
    webhook_id: uuid.UUID,
    body: WebhookUpdate,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Update a webhook endpoint."""
    try:
        webhook = await webhook_service.update_webhook(
            session, webhook_id, current_user.institute_id,
            **body.model_dump(exclude_unset=True),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return WebhookOut.model_validate(webhook)


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: uuid.UUID,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Soft delete a webhook endpoint."""
    try:
        await webhook_service.delete_webhook(session, webhook_id, current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{webhook_id}/test", response_model=WebhookTestResult)
async def test_webhook(
    webhook_id: uuid.UUID,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Send a test event to a webhook endpoint."""
    try:
        result = await webhook_service.test_webhook(session, webhook_id, current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return WebhookTestResult(**result)


@router.get("/{webhook_id}/deliveries", response_model=PaginatedResponse[WebhookDeliveryOut])
async def list_deliveries(
    webhook_id: uuid.UUID,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """List delivery log for a webhook."""
    deliveries, total = await webhook_service.get_deliveries(
        session, webhook_id, current_user.institute_id, page, per_page,
    )
    return PaginatedResponse(
        data=[WebhookDeliveryOut.model_validate(d) for d in deliveries],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )
