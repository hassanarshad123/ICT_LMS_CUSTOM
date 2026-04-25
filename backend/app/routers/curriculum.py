import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.curriculum import CurriculumModuleCreate, CurriculumModuleUpdate, CurriculumModuleOut, ReorderRequest
from app.services import curriculum_service
from app.middleware.auth import get_current_user
from app.rbac.dependencies import require_permissions
from app.models.user import User

router = APIRouter()

CanViewCurriculum = Annotated[User, Depends(require_permissions("curriculum.view"))]
CanManageCurriculum = Annotated[User, Depends(require_permissions("curriculum.manage"))]
AllRoles = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=list[CurriculumModuleOut])
async def list_modules(
    course_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    modules = await curriculum_service.list_modules(session, course_id, institute_id=current_user.institute_id)
    return [CurriculumModuleOut.model_validate(m) for m in modules]


@router.post("", response_model=CurriculumModuleOut, status_code=status.HTTP_201_CREATED)
async def create_module(
    body: CurriculumModuleCreate,
    current_user: CanManageCurriculum,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    module = await curriculum_service.create_module(
        session, course_id=body.course_id, title=body.title,
        description=body.description, topics=body.topics,
        created_by=current_user.id, institute_id=current_user.institute_id,
    )
    return CurriculumModuleOut.model_validate(module)


@router.patch("/{module_id}", response_model=CurriculumModuleOut)
async def update_module(
    module_id: uuid.UUID,
    body: CurriculumModuleUpdate,
    current_user: CanManageCurriculum,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        module = await curriculum_service.update_module(
            session, module_id, institute_id=current_user.institute_id, **body.model_dump(exclude_unset=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return CurriculumModuleOut.model_validate(module)


@router.delete("/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_module(
    module_id: uuid.UUID,
    current_user: CanManageCurriculum,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await curriculum_service.soft_delete_module(session, module_id, institute_id=current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{module_id}/reorder", response_model=CurriculumModuleOut)
async def reorder_module(
    module_id: uuid.UUID,
    body: ReorderRequest,
    current_user: CanManageCurriculum,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        module = await curriculum_service.reorder_module(
            session, module_id, body.sequence_order, institute_id=current_user.institute_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return CurriculumModuleOut.model_validate(module)
