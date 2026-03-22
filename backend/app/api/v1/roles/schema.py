from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ModulePermission(BaseModel):
    can_view: bool = False
    can_create: bool = False
    can_edit: bool = False


class RolePermissionResponse(BaseModel):
    module: str
    can_view: bool
    can_create: bool
    can_edit: bool


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    description: str | None = None
    color: str
    is_system: bool
    permissions: list[RolePermissionResponse] = []


class RoleCreate(BaseModel):
    name: str
    description: str | None = None
    color: str = "#6366f1"
    permissions: dict[str, ModulePermission] = {}  # module -> perms


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    permissions: dict[str, ModulePermission] | None = None


class RoleListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    description: str | None = None
    color: str
    is_system: bool
