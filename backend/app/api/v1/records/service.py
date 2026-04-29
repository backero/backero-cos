import uuid
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import PaginatedResponse
from app.models.activity_log import ActivityLog
from .schema import ActivityLogResponse, RestoreResponse


async def list_records(
    db: AsyncSession,
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> PaginatedResponse[ActivityLogResponse]:
    query = select(ActivityLog)
    if entity_type:
        query = query.where(ActivityLog.entity_type == entity_type)
    if action:
        query = query.where(ActivityLog.action == action)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(ActivityLog.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    items = [ActivityLogResponse.model_validate(r) for r in result.scalars()]
    return PaginatedResponse.build(items, total, page, limit)


async def restore_record(db: AsyncSession, log_id: str) -> RestoreResponse:
    result = await db.execute(select(ActivityLog).where(ActivityLog.id == uuid.UUID(log_id)))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Record not found")
    if not log.is_deleted or not log.deleted_data:
        raise HTTPException(status_code=400, detail="This record is not restorable")

    entity_type = log.entity_type

    if entity_type == "task":
        await _restore_task(db, log.deleted_data)
    elif entity_type == "employee":
        await _restore_employee(db, log.deleted_data)
    elif entity_type == "product":
        await _restore_product(db, log.deleted_data)
    elif entity_type == "invoice":
        await _restore_invoice(db, log.deleted_data)
    else:
        raise HTTPException(status_code=400, detail=f"Restore not supported for {entity_type}")

    log.is_deleted = False
    log.deleted_data = None
    await db.commit()

    return RestoreResponse(
        message=f"{entity_type.capitalize()} restored successfully",
        entity_type=entity_type,
        entity_name=log.entity_name,
    )


async def _restore_task(db: AsyncSession, data: dict) -> None:
    from app.models.task import Task
    import uuid as _uuid
    from datetime import datetime, timezone

    def _parse_dt(v):
        return datetime.fromisoformat(v) if v else None

    task = Task(
        id=_uuid.UUID(data["id"]),
        title=data["title"],
        description=data.get("description"),
        priority=data.get("priority", "medium"),
        status="pending",
        due_date=_parse_dt(data.get("due_date")),
        assigned_to_id=_uuid.UUID(data["assigned_to_id"]) if data.get("assigned_to_id") else None,
        created_by_id=_uuid.UUID(data["created_by_id"]) if data.get("created_by_id") else None,
        department_id=_uuid.UUID(data["department_id"]) if data.get("department_id") else None,
    )
    db.add(task)


async def _restore_employee(db: AsyncSession, data: dict) -> None:
    from app.models.employee import Employee
    import uuid as _uuid

    emp = Employee(
        id=_uuid.UUID(data["id"]),
        name=data["name"],
        phone=data["phone"],
        email=data.get("email"),
        role=data.get("role", "Employee"),
        designation=data.get("designation"),
        is_active=True,
    )
    db.add(emp)


async def _restore_product(db: AsyncSession, data: dict) -> None:
    from app.api.v1.inventory.model import Product
    import uuid as _uuid

    product = Product(
        id=_uuid.UUID(data["id"]),
        name=data["name"],
        sku=data["sku"],
        category=data.get("category", "Other"),
        unit=data.get("unit", "pcs"),
        mrp=data.get("mrp", 0),
        cost_price=data.get("cost_price", 0),
        gst_rate=data.get("gst_rate", 18),
        is_active=True,
    )
    db.add(product)


async def _restore_invoice(db: AsyncSession, data: dict) -> None:
    from app.api.v1.finance.model import Invoice
    import uuid as _uuid

    inv = Invoice(
        id=_uuid.UUID(data["id"]),
        invoice_number=data["invoice_number"],
        customer_name=data["customer_name"],
        total=data.get("total", 0),
        status="draft",
    )
    db.add(inv)
