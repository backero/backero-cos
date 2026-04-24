"""
Seeds all 17 employees from the Biziverse employee list into Supabase.

Usage:
    python seed_employees.py
"""

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres.nzfgiiklpnkfctcwirzp:17kINg9kcG7CoRMV"
    "@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal, engine, Base
from app.models.employee import Employee                                      # noqa
from app.api.v1.roles.model import Role, RoleModulePermission, MODULES       # noqa

# ── Employee list ─────────────────────────────────────────────────────────────
# role_key maps to the Role.name seeded in DEFAULT_ROLES:
#   "Super Admin" / "Admin" / "Manager" / "HR" / "Employee"

EMPLOYEES = [
    # Leadership
    {"name": "Surya Raj",       "phone": "9488952933", "email": "director@backero.in",  "designation": "Chief Executive Officer",   "role_key": "Super Admin"},
    {"name": "Jeeva",           "phone": "9488939107", "email": "founder@backero.in",   "designation": "Founder",                   "role_key": "Super Admin"},
    {"name": "Parimala",        "phone": "9486500671", "email": "chaiman@backero.in",   "designation": "Chairman",                  "role_key": "Super Admin"},

    # Managers
    {"name": "Suriya Priya",    "phone": "9486461702", "email": "mpmbackero@gmail.com", "designation": "Marketplace Manager",       "role_key": "Manager"},
    {"name": "Ameen Shinan",    "phone": "9486503704", "email": "dmbackero@gmail.com",  "designation": "Digital Marketing Manager", "role_key": "Manager"},
    {"name": "Kameshwaran",     "phone": "8903790400", "email": "smbackero@gmail.com",  "designation": "Sales Manager",             "role_key": "Manager"},
    {"name": "Vignesh",         "phone": "8903280702", "email": "pmbackero@gmail.com",  "designation": "Production Manager",        "role_key": "Manager"},

    # Executives / Staff
    {"name": "Sai Theertha",    "phone": "9486791704", "email": "me1backero@gmail.com", "designation": "Marketing Executive",       "role_key": "Employee"},
    {"name": "Henz",            "phone": "8300942300", "email": "me2backero@gmail.com", "designation": "Marketing Executive",       "role_key": "Employee"},
    {"name": "Emil Joshua",     "phone": "8903412061", "email": "webackero@gmail.com",  "designation": "Website Executive",         "role_key": "Employee"},
    {"name": "Surya Narayanan", "phone": "8489518055", "email": "tebackero@gmail.com",  "designation": "Technical Executive",       "role_key": "Employee"},
    {"name": "Naveen",          "phone": "9486807703", "email": "mpe1backero@gmail.com","designation": "Marketplace Executive",     "role_key": "Employee"},
    {"name": "Sabarinathan",    "phone": "8903994702", "email": "mpe2backero@gmail.com","designation": "Marketplace Executive",     "role_key": "Employee"},
    {"name": "Dhanush",         "phone": "9486819702", "email": "mpe3backero@gmail.com","designation": "Marketplace Executive",     "role_key": "Employee"},
    {"name": "Sangavi",         "phone": "9486167180", "email": "febackero@gmail.com",  "designation": "Finance Executive",         "role_key": "Employee"},
    {"name": "Kowsi",           "phone": "9486489704", "email": "pebackero@gmail.com",  "designation": "Production Executive",      "role_key": "Employee"},
    {"name": "Sathish",         "phone": "9486919702", "email": "pbackero@gmail.com",   "designation": "Production Staff",          "role_key": "Employee"},
]


async def seed_employees(db: AsyncSession) -> None:
    # Load role map  { "Super Admin": <Role>, "Manager": <Role>, ... }
    result = await db.execute(select(Role))
    role_map = {r.name: r for r in result.scalars()}

    if not role_map:
        print("[ERROR] No roles found. Run seed.py first.")
        return

    created = skipped = updated = 0

    for emp_data in EMPLOYEES:
        role = role_map.get(emp_data["role_key"])
        if not role:
            print(f"  [WARN] Role '{emp_data['role_key']}' not found, skipping {emp_data['name']}")
            continue

        existing_result = await db.execute(
            select(Employee).where(Employee.phone == emp_data["phone"])
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            # Update role / designation / email if changed
            changed = False
            if existing.role_id != role.id:
                existing.role_id = role.id
                existing.role = role.name
                changed = True
            if existing.designation != emp_data["designation"]:
                existing.designation = emp_data["designation"]
                changed = True
            if emp_data["email"] and existing.email != emp_data["email"]:
                existing.email = emp_data["email"]
                changed = True
            if changed:
                updated += 1
                print(f"  [UPDATE] {emp_data['name']} ({emp_data['phone']}) -> {role.name}")
            else:
                skipped += 1
                print(f"  [SKIP]   {emp_data['name']} already exists")
        else:
            db.add(Employee(
                name=emp_data["name"],
                phone=emp_data["phone"],
                email=emp_data["email"],
                designation=emp_data["designation"],
                role=role.name,
                role_id=role.id,
                is_active=True,
            ))
            created += 1
            print(f"  [ADD]    {emp_data['name']} ({emp_data['phone']}) -> {role.name}")

    await db.commit()
    print(f"\nDone: {created} added, {updated} updated, {skipped} skipped")


async def main() -> None:
    print("\n[START] Seeding employees into Supabase...\n")
    async with AsyncSessionLocal() as db:
        await seed_employees(db)
    await engine.dispose()
    print("\nAll employees can now log in with their WhatsApp number as phone.")
    print("OTP will be printed in server logs (dev mode) or sent via MSG91.\n")


if __name__ == "__main__":
    asyncio.run(main())
