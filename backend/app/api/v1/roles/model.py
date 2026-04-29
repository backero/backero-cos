import uuid

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.mixins import TimestampMixin, UUIDMixin
from app.db.session import Base

MODULES = [
    "dashboard",
    "tasks",
    "finance",
    "inventory",
    "employees",
    "production",
    "reports",
    "roles",
    "records",
]

# Default role seeds
DEFAULT_ROLES = [
    {
        "name": "Super Admin",
        "description": "Full system access — cannot be deleted",
        "color": "#7c3aed",
        "is_system": True,
        "permissions": {m: {"can_view": True, "can_create": True, "can_edit": True} for m in MODULES},
    },
    {
        "name": "Admin",
        "description": "Full access except role management",
        "color": "#2563eb",
        "is_system": False,
        "permissions": {
            m: {"can_view": True, "can_create": True, "can_edit": True}
            for m in MODULES if m != "roles"
        },
    },
    {
        "name": "Manager",
        "description": "Team operations and reporting",
        "color": "#d97706",
        "is_system": False,
        "permissions": {
            "dashboard":  {"can_view": True,  "can_create": False, "can_edit": False},
            "tasks":      {"can_view": True,  "can_create": True,  "can_edit": True},
            "inventory":  {"can_view": True,  "can_create": False, "can_edit": False},
            "employees":  {"can_view": True,  "can_create": False, "can_edit": False},
            "production": {"can_view": True,  "can_create": False, "can_edit": False},
            "reports":    {"can_view": True,  "can_create": False, "can_edit": False},
        },
    },
    {
        "name": "HR",
        "description": "Human resources and employee management",
        "color": "#059669",
        "is_system": False,
        "permissions": {
            "dashboard": {"can_view": True,  "can_create": False, "can_edit": False},
            "employees": {"can_view": True,  "can_create": True,  "can_edit": True},
            "tasks":     {"can_view": True,  "can_create": False, "can_edit": False},
            "reports":   {"can_view": True,  "can_create": False, "can_edit": False},
        },
    },
    {
        "name": "Employee",
        "description": "Standard employee access",
        "color": "#64748b",
        "is_system": False,
        "permissions": {
            "dashboard":  {"can_view": True, "can_create": False, "can_edit": False},
            "tasks":      {"can_view": True, "can_create": False, "can_edit": False},
            "inventory":  {"can_view": True, "can_create": False, "can_edit": False},
            "production": {"can_view": True, "can_create": False, "can_edit": False},
            "reports":    {"can_view": True, "can_create": False, "can_edit": False},
        },
    },
]


class Role(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    color: Mapped[str] = mapped_column(String(20), default="#6366f1", nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    permissions: Mapped[list["RoleModulePermission"]] = relationship(
        "RoleModulePermission", back_populates="role", cascade="all, delete-orphan", lazy="selectin"
    )


class RoleModulePermission(Base, UUIDMixin):
    __tablename__ = "role_module_permissions"
    __table_args__ = (UniqueConstraint("role_id", "module", name="uq_role_module_perm"),)

    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    module: Mapped[str] = mapped_column(String(30), nullable=False)
    can_view: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_create: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    role: Mapped["Role"] = relationship("Role", back_populates="permissions")
