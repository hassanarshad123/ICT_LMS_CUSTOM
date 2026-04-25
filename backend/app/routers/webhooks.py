import math
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.rbac.dependencies import require_permissions
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.webhook import (
    WebhookCreate, WebhookUpdate, WebhookOut,
    WebhookTestResult, WebhookDeliveryOut,
)
from app.services import webhook_service
from app.utils.rate_limit import limiter

router = APIRouter()

CanViewWebhooks = Annotated[User, Depends(require_permissions("webhooks.view"))]
CanCreateWebhook = Annotated[User, Depends(require_permissions("webhooks.create"))]
CanEditWebhook = Annotated[User, Depends(require_permissions("webhooks.edit"))]
CanDeleteWebhook = Annotated[User, Depends(require_permissions("webhooks.delete"))]
CanTestWebhook = Annotated[User, Depends(require_permissions("webhooks.test"))]


@router.post("", response_model=WebhookOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def create_webhook(
    request: Request,
    body: WebhookCreate,
    current_user: CanCreateWebhook,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Create a new webhook endpoint."""
    from app.utils.plan_limits import check_creation_limit
    try:
        await check_creation_limit(session, current_user.institute_id, "webhooks")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

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
    current_user: CanViewWebhooks,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """List all webhooks for the current institute."""
    webhooks = await webhook_service.list_webhooks(session, current_user.institute_id)
    return [WebhookOut.model_validate(w) for w in webhooks]


@router.get("/{webhook_id}", response_model=WebhookOut)
async def get_webhook(
    webhook_id: uuid.UUID,
    current_user: CanViewWebhooks,
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
    current_user: CanEditWebhook,
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
    current_user: CanDeleteWebhook,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Soft delete a webhook endpoint."""
    try:
        await webhook_service.delete_webhook(session, webhook_id, current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{webhook_id}/test", response_model=WebhookTestResult)
@limiter.limit("5/hour")
async def test_webhook(
    request: Request,
    webhook_id: uuid.UUID,
    current_user: CanTestWebhook,
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
    current_user: CanViewWebhooks,
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
