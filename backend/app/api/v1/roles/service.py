import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .model import DEFAULT_ROLES, MODULES, Role, RoleModulePermission
from .schema import ModulePermission, RoleCreate, RoleUpdate


def _build_permissions_map(role: Role) -> dict[str, dict]:
    """Return {module: {can_view, can_create, can_edit}} for a role."""
    return {
        p.module: {"can_view": p.can_view, "can_create": p.can_create, "can_edit": p.can_edit}
        for p in role.permissions
        if p.can_view or p.can_create or p.can_edit
    }


async def seed_roles(db: AsyncSession) -> None:
    """Seed default roles if none exist."""
    result = await db.execute(select(Role).limit(1))
    if result.scalar_one_or_none():
        return

    for role_data in DEFAULT_ROLES:
        role = Role(
            name=role_data["name"],
            description=role_data["description"],
            color=role_data["color"],
            is_system=role_data["is_system"],
        )
        db.add(role)
        await db.flush()

        for module in MODULES:
            perms = role_data["permissions"].get(module, {})
            db.add(RoleModulePermission(
                role_id=role.id,
                module=module,
                can_view=perms.get("can_view", False),
                can_create=perms.get("can_create", False),
                can_edit=perms.get("can_edit", False),
            ))

    await db.commit()


async def get_all_roles(db: AsyncSession) -> list[Role]:
    result = await db.execute(
        select(Role).options(selectinload(Role.permissions)).order_by(Role.name)
    )
    return list(result.scalars())


async def get_role(db: AsyncSession, role_id: uuid.UUID) -> Role:
    result = await db.execute(
        select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


async def get_role_permissions_map(db: AsyncSession, role_id: uuid.UUID) -> dict[str, dict]:
    """Return permissions map for a role by its ID."""
    result = await db.execute(
        select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        return {}
    return _build_permissions_map(role)


async def create_role(db: AsyncSession, body: RoleCreate) -> Role:
    existing = await db.execute(select(Role).where(Role.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Role '{body.name}' already exists", headers={"X-Field": "name"})

    role = Role(name=body.name, description=body.description, color=body.color, is_system=False)
    db.add(role)
    await db.flush()

    for module in MODULES:
        perms: ModulePermission = body.permissions.get(module, ModulePermission())
        db.add(RoleModulePermission(
            role_id=role.id,
            module=module,
            can_view=perms.can_view,
            can_create=perms.can_create,
            can_edit=perms.can_edit,
        ))

    await db.commit()
    await db.refresh(role)
    return role


async def update_role(db: AsyncSession, role_id: uuid.UUID, body: RoleUpdate) -> Role:
    role = await get_role(db, role_id)

    if body.name is not None:
        # Check uniqueness
        dup = await db.execute(select(Role).where(Role.name == body.name, Role.id != role_id))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Role name '{body.name}' already taken", headers={"X-Field": "name"})
        role.name = body.name

    if body.description is not None:
        role.description = body.description
    if body.color is not None:
        role.color = body.color

    if body.permissions is not None:
        # Delete existing permissions and re-insert
        for perm in role.permissions:
            await db.delete(perm)
        await db.flush()

        for module in MODULES:
            perms: ModulePermission = body.permissions.get(module, ModulePermission())
            # Super Admin always keeps all permissions
            if role.is_system:
                perms = ModulePermission(can_view=True, can_create=True, can_edit=True)
            db.add(RoleModulePermission(
                role_id=role.id,
                module=module,
                can_view=perms.can_view,
                can_create=perms.can_create,
                can_edit=perms.can_edit,
            ))

    await db.commit()
    await db.refresh(role)
    return role


async def delete_role(db: AsyncSession, role_id: uuid.UUID) -> None:
    role = await get_role(db, role_id)
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")
    await db.delete(role)
    await db.commit()
