from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.employee import Employee
from app.models.finance import Invoice
from app.models.inventory import Product
from app.models.task import Task

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=2, description="Search query"),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Search across tasks, employees, products, and invoices."""
    term = f"%{q.lower()}%"
    results = []

    # Tasks
    task_result = await db.execute(
        select(Task).where(
            Task.is_deleted == False,
            or_(
                Task.title.ilike(term),
                Task.description.ilike(term),
            )
        ).limit(5)
    )
    for t in task_result.scalars():
        results.append({
            "type": "task",
            "id": str(t.id),
            "title": t.title,
            "subtitle": f"{t.status} · {t.priority}",
            "href": "/tasks",
        })

    # Employees
    emp_result = await db.execute(
        select(Employee).where(
            Employee.is_active == True,
            or_(
                Employee.name.ilike(term),
                Employee.phone.ilike(term),
                Employee.email.ilike(term),
                Employee.designation.ilike(term),
            )
        ).limit(5)
    )
    for e in emp_result.scalars():
        results.append({
            "type": "employee",
            "id": str(e.id),
            "title": e.name,
            "subtitle": f"{e.role} · {e.designation or ''}",
            "href": "/employees",
        })

    # Products
    product_result = await db.execute(
        select(Product).where(
            Product.is_active == True,
            Product.is_deleted == False,
            or_(
                Product.name.ilike(term),
                Product.sku.ilike(term),
                Product.category.ilike(term),
            )
        ).limit(5)
    )
    for p in product_result.scalars():
        results.append({
            "type": "product",
            "id": str(p.id),
            "title": p.name,
            "subtitle": f"SKU: {p.sku} · {p.category or ''}",
            "href": "/inventory",
        })

    # Invoices
    invoice_result = await db.execute(
        select(Invoice).where(
            Invoice.is_deleted == False,
            or_(
                Invoice.invoice_number.ilike(term),
                Invoice.customer_name.ilike(term),
                Invoice.customer_phone.ilike(term),
            )
        ).limit(5)
    )
    for inv in invoice_result.scalars():
        results.append({
            "type": "invoice",
            "id": str(inv.id),
            "title": f"Invoice {inv.invoice_number}",
            "subtitle": f"{inv.customer_name} · ₹{float(inv.total):,.0f} · {inv.status}",
            "href": "/finance",
        })

    return {"query": q, "results": results, "total": len(results)}
