import uuid

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, SuperAdminUser
from app.db.session import get_db

from . import service
from .schema import RoleCreate, RoleListItem, RoleResponse, RoleUpdate


async def list_roles(
    _: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[RoleResponse]:
    roles = await service.get_all_roles(db)
    return [
        RoleResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            color=r.color,
            is_system=r.is_system,
            permissions=[
                {"module": p.module, "can_view": p.can_view, "can_create": p.can_create, "can_edit": p.can_edit}
                for p in r.permissions
            ],
        )
        for r in roles
    ]


async def create_role(
    body: RoleCreate,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> RoleResponse:
    role = await service.create_role(db, body)
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        color=role.color,
        is_system=role.is_system,
        permissions=[
            {"module": p.module, "can_view": p.can_view, "can_create": p.can_create, "can_edit": p.can_edit}
            for p in role.permissions
        ],
    )


async def update_role(
    role_id: uuid.UUID,
    body: RoleUpdate,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> RoleResponse:
    role = await service.update_role(db, role_id, body)
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        color=role.color,
        is_system=role.is_system,
        permissions=[
            {"module": p.module, "can_view": p.can_view, "can_create": p.can_create, "can_edit": p.can_edit}
            for p in role.permissions
        ],
    )


async def delete_role(
    role_id: uuid.UUID,
    _: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    await service.delete_role(db, role_id)
    return {"message": "Role deleted"}
