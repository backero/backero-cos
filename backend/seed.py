"""
Standalone seed script for Backero COS.

Usage:
    # Use DATABASE_URL from .env (default)
    python seed.py

    # Override with a specific DB URL
    DATABASE_URL="postgresql+asyncpg://..." python seed.py
"""

import asyncio
import os
import sys
from pathlib import Path

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Make sure imports resolve from the backend/ directory ────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Allow overriding DATABASE_URL via env before settings are loaded
db_url = os.environ.get("DATABASE_URL")
if db_url:
    os.environ["DATABASE_URL"] = db_url
else:
    # Use the Supabase pooler URL
    os.environ["DATABASE_URL"] = (
        "postgresql+asyncpg://postgres.nzfgiiklpnkfctcwirzp:17kINg9kcG7CoRMV"
        "@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
    )

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal, engine, Base

# Import ALL models so Base.metadata knows about every table
from app.models.employee import Employee, Department, Attendance          # noqa
from app.models.task import Task, TaskComment, Notification, ComplianceTask  # noqa
from app.models.finance import Invoice, InvoiceItem, AccountEntry         # noqa
from app.models.inventory import (                                         # noqa
    Product, Inventory, RawMaterial, ProductionBatch, PlatformOrder
)
from app.api.v1.roles.model import Role, RoleModulePermission, MODULES, DEFAULT_ROLES  # noqa


# ── 1. Create all tables ──────────────────────────────────────────────────────

async def create_tables() -> None:
    print("[1/2] Creating tables (create_all -- skips existing)...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("    OK Tables ready")


# ── 2. Migrate: add columns that create_all won't touch ──────────────────────

async def migrate_columns() -> None:
    print("[2/2] Running column migrations...")
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE employees
            ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL
        """))
    print("    OK Migrations applied")


# ── 3. Seed roles ─────────────────────────────────────────────────────────────

async def seed_roles(db: AsyncSession) -> None:
    result = await db.execute(select(Role).limit(1))
    if result.scalar_one_or_none():
        print("    - Roles already seeded - skipping")
        return

    print("    Inserting roles...")
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
    print(f"    OK {len(DEFAULT_ROLES)} roles seeded")


# ── 4. Seed super admin employee ─────────────────────────────────────────────

async def seed_super_admin(db: AsyncSession) -> None:
    role_result = await db.execute(select(Role).where(Role.is_system == True))
    system_role = role_result.scalar_one_or_none()

    emp_result = await db.execute(
        select(Employee).where(Employee.phone == settings.ADMIN_PHONE)
    )
    existing = emp_result.scalar_one_or_none()

    if existing:
        if system_role and existing.role_id != system_role.id:
            existing.role_id = system_role.id
            existing.role = system_role.name
            existing.designation = "Super Administrator"
            await db.commit()
            print(f"    - Updated super admin role → {system_role.name}")
        else:
            print(f"    - Super admin ({settings.ADMIN_PHONE}) already exists - skipping")
        return

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
    print(f"    OK Super admin created - phone: {settings.ADMIN_PHONE}")


# ── 5. Seed a default department ─────────────────────────────────────────────

async def seed_default_department(db: AsyncSession) -> None:
    result = await db.execute(select(Department).limit(1))
    if result.scalar_one_or_none():
        print("    - Department already exists - skipping")
        return

    db.add(Department(name="General", description="Default department"))
    await db.commit()
    print("    OK Default department created")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\n[START] Backero COS -- Database Seed")
    print(f"    DB : {os.environ['DATABASE_URL'][:60]}...\n")

    # Step 1: tables
    await create_tables()

    # Step 2: column migrations
    await migrate_columns()

    # Steps 3-5: seed data
    print("[SEED] Seeding data...")
    async with AsyncSessionLocal() as db:
        await seed_roles(db)
        await seed_super_admin(db)
        await seed_default_department(db)

    await engine.dispose()
    print("\n[DONE] Seed complete!\n")
    print("    Login with:")
    print(f"      Phone : {settings.ADMIN_PHONE}")
    print("      OTP   : check server logs (dev mode prints it)\n")


if __name__ == "__main__":
    asyncio.run(main())
