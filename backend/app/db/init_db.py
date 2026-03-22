from sqlalchemy import select, text

from app.core.config import settings
from app.db.session import AsyncSessionLocal, engine
from app.models.employee import Employee


async def migrate_columns() -> None:
    """Add new columns to existing tables that create_all won't touch."""
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE employees
            ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL
        """))


async def seed_super_admin() -> None:
    """Ensure the bootstrap employee exists with the Super Admin role."""
    from app.api.v1.roles.model import Role

    async with AsyncSessionLocal() as db:
        # Find the Super Admin role
        role_result = await db.execute(select(Role).where(Role.is_system == True))
        system_role = role_result.scalar_one_or_none()

        # Find or create the bootstrap employee
        emp_result = await db.execute(select(Employee).where(Employee.phone == settings.ADMIN_PHONE))
        existing = emp_result.scalar_one_or_none()

        if existing:
            if system_role and existing.role_id != system_role.id:
                existing.role_id = system_role.id
                existing.role = system_role.name
                existing.designation = "Super Administrator"
                await db.commit()
        else:
            emp = Employee(
                name=settings.ADMIN_NAME,
                phone=settings.ADMIN_PHONE,
                role=system_role.name if system_role else "Super Admin",
                role_id=system_role.id if system_role else None,
                designation="Super Administrator",
                is_active=True,
            )
            db.add(emp)
            await db.commit()


async def init_db() -> None:
    from app.api.v1.roles import service as roles_service

    async with AsyncSessionLocal() as db:
        await roles_service.seed_roles(db)

    await migrate_columns()
    await seed_super_admin()
