from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.employee import Employee


async def seed_admin() -> None:
    """Create admin employee if none exists."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Employee).where(Employee.role == "admin"))
        if not result.scalar_one_or_none():
            admin = Employee(
                name=settings.ADMIN_NAME,
                phone=settings.ADMIN_PHONE,
                role="admin",
                designation="System Administrator",
                is_active=True,
            )
            db.add(admin)
            await db.commit()
