from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import PaginatedResponse
from app.core.dependencies import CurrentUser, ManagerUser
from app.db.session import get_db
from app.models.finance import Customer
from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime
import uuid

from sqlalchemy import func, select


class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    created_at: datetime


router = APIRouter()


@router.get("/", response_model=PaginatedResponse[CustomerResponse])
async def list_customers(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    q = select(Customer).where(Customer.is_deleted == False)
    if search:
        term = f"%{search}%"
        q = q.where(Customer.name.ilike(term) | Customer.phone.ilike(term))
    count_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = count_res.scalar_one()
    q = q.order_by(Customer.name.asc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)
    items = [CustomerResponse.model_validate(c) for c in result.scalars()]
    return PaginatedResponse.build(items, total, page, limit)


@router.post("/", response_model=CustomerResponse)
async def create_customer(
    body: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: ManagerUser = None,
):
    customer = Customer(**body.model_dump())
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    body: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: ManagerUser = None,
):
    from fastapi import HTTPException
    result = await db.execute(select(Customer).where(Customer.id == uuid.UUID(customer_id), Customer.is_deleted == False))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(customer, field, value)
    await db.flush()
    await db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: ManagerUser = None,
):
    from fastapi import HTTPException
    result = await db.execute(select(Customer).where(Customer.id == uuid.UUID(customer_id)))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.is_deleted = True
    return {"message": "Customer deleted"}
