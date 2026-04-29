from sqlalchemy import select, text

from app.core.config import settings
from app.db.session import AsyncSessionLocal, engine
from app.models.employee import Employee

# (name, phone, email, designation, role_name)
SEED_EMPLOYEES = [
    ("Sai Theertha",   "9486791704", "me1backero@gmail.com",   "ME - Marketing Executive",       "Employee"),
    ("Henz",           "8300942300", "me2backero@gmail.com",   "ME - Marketing Executive",       "Employee"),
    ("Emil Joshua",    "8903412061", "webackero@gmail.com",    "WE - Website Executive",         "Employee"),
    ("Ameen Shinan",   "9486503704", "dmbackero@gmail.com",    "DM - Digital Marketing Manager", "Manager"),
    ("Surya Narayanan","9486352703", "tebackero@gmail.com",    "TE - Technical Executive",       "Employee"),
    ("Naveen",         "9486807703", "mpe1backero@gmail.com",  "MPE - Marketplace Executive",    "Employee"),
    ("Sabarinathan",   "8903994702", "mpe2backero@gmail.com",  "MPE - Marketplace Executive",    "Employee"),
    ("Dhanush",        "9486819702", "mpe3backero@gmail.com",  "MPE - Marketplace Executive",    "Employee"),
    ("Sangavi",        "9486167180", "febackero@gmail.com",    "FE - Finance Executive",         "Employee"),
    ("Kameshwaran",    "8903790400", "smbackero@gmail.com",    "SM - Sales Manager",             "Manager"),
    ("Vignesh",        "9486919702", "pmbackero@gmail.com",    "PM - Production Manager",        "Manager"),
    ("Kowsi",          "9486489704", "pebackero@gmail.com",    "PE - Production Executive",      "Employee"),
    ("Naveenthra",     "8903955702", "pe4backego@gmail.com",   "PE4 - Production Executive 4",   "Employee"),
    ("Surya Raj",      "9488952933", "director@backero.in",    "CEO",                            "Admin"),
    ("Jeeva",          "9488939107", "founder@backero.in",     "Founder",                        "Super Admin"),
    ("Parimala",       "9487654107", "chaiman@backero.in",     "Chairman",                       "Admin"),
    ("Suriya Priya",   "9486500671", "mpmbackero@gmail.com",   "MPM - Marketplace Manager",      "Manager"),
    ("Dini",           "9486935702", "pe1backero@gmail.com",   "PE1 - Production Executive 1",   "Employee"),
    ("Akshaya",        "9486766702", "pe2backero@gmail.com",   "PE2 - Production Executive 2",   "Employee"),
    ("Mohan",          "9486707702", "saleexbackero@gmail.com","Sales Executive",                "Employee"),
    ("Alagu Shakthi",  "9486363704", "pe3backero@gmail.com",   "PE3 - Production Executive 3",   "Employee"),
]


async def migrate_columns() -> None:
    """Add new columns to existing tables that create_all won't touch."""
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE employees
            ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL
        """))
        # Soft-delete columns (Task, Invoice, Product use SoftDeleteMixin)
        await conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_tasks_is_deleted ON tasks(is_deleted)"))
        await conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_invoices_is_deleted ON invoices(is_deleted)"))
        await conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_products_is_deleted ON products(is_deleted)"))
        # Task attachments table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS task_attachments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                uploaded_by_id UUID REFERENCES employees(id) ON DELETE SET NULL,
                filename VARCHAR(300) NOT NULL,
                stored_filename VARCHAR(300) NOT NULL,
                file_type VARCHAR(100) NOT NULL,
                file_size BIGINT NOT NULL
            )
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_task_attachments_task_id ON task_attachments(task_id)"))


async def seed_super_admin() -> None:
    """Ensure the bootstrap employee exists with the Super Admin role."""
    from app.api.v1.roles.model import Role

    async with AsyncSessionLocal() as db:
        role_result = await db.execute(select(Role).where(Role.is_system == True))
        system_role = role_result.scalar_one_or_none()

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


async def seed_employees() -> None:
    """Seed the 21 Backero team members if they don't already exist."""
    from app.api.v1.roles.model import Role

    async with AsyncSessionLocal() as db:
        role_map_result = await db.execute(select(Role))
        role_map: dict[str, Role] = {r.name: r for r in role_map_result.scalars()}

        for name, phone, email, designation, role_name in SEED_EMPLOYEES:
            existing = await db.execute(select(Employee).where(Employee.phone == phone))
            if existing.scalar_one_or_none():
                continue

            role = role_map.get(role_name) or role_map.get("Employee")
            db.add(Employee(
                name=name,
                phone=phone,
                email=email,
                designation=designation,
                role=role.name if role else "Employee",
                role_id=role.id if role else None,
                is_active=True,
            ))

        await db.commit()


async def migrate_employee_permissions() -> None:
    """Ensure Employee role has view-only access to dashboard, tasks, inventory, production, reports."""
    from app.api.v1.roles.model import Role, RoleModulePermission

    EMPLOYEE_VIEW_MODULES = {"dashboard", "tasks", "inventory", "production", "reports"}

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Role).where(Role.name == "Employee"))
        role = result.scalar_one_or_none()
        if not role:
            return

        existing = await db.execute(
            select(RoleModulePermission).where(RoleModulePermission.role_id == role.id)
        )
        existing_map = {p.module: p for p in existing.scalars()}

        for module in EMPLOYEE_VIEW_MODULES:
            if module in existing_map:
                existing_map[module].can_view = True
                existing_map[module].can_create = False
                existing_map[module].can_edit = False
            else:
                db.add(RoleModulePermission(
                    role_id=role.id,
                    module=module,
                    can_view=True,
                    can_create=False,
                    can_edit=False,
                ))

        await db.commit()


async def migrate_records_permission() -> None:
    """Give Super Admin can_view on the 'records' module; create entry if missing."""
    from app.api.v1.roles.model import Role, RoleModulePermission

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Role).where(Role.is_system == True))
        super_admin = result.scalar_one_or_none()
        if not super_admin:
            return

        existing = await db.execute(
            select(RoleModulePermission).where(
                RoleModulePermission.role_id == super_admin.id,
                RoleModulePermission.module == "records",
            )
        )
        perm = existing.scalar_one_or_none()
        if perm:
            perm.can_view = perm.can_create = perm.can_edit = True
        else:
            db.add(RoleModulePermission(
                role_id=super_admin.id, module="records",
                can_view=True, can_create=True, can_edit=True,
            ))
        await db.commit()


async def init_db() -> None:
    from app.api.v1.roles import service as roles_service

    async with AsyncSessionLocal() as db:
        await roles_service.seed_roles(db)

    await migrate_columns()
    await migrate_employee_permissions()
    await migrate_records_permission()
    await seed_super_admin()
    await seed_employees()
