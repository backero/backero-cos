import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import CurrentUser, ManagerUser
from app.db.session import get_db
from app.models.inventory import Inventory, PlatformOrder, Product, ProductionBatch, RawMaterial

router = APIRouter()


# ---------- Products ----------

class ProductCreate(BaseModel):
    name: str
    sku: str
    category: Optional[str] = None
    description: Optional[str] = None
    unit: str = "pcs"
    mrp: float = 0
    cost_price: float = 0
    gst_rate: float = 18
    hsn_code: Optional[str] = None
    reorder_level: float = 10
    max_stock: float = 1000


class StockAdjust(BaseModel):
    quantity: float
    reason: str


class RawMaterialCreate(BaseModel):
    name: str
    unit: str = "kg"
    current_stock: float = 0
    reorder_level: float = 5
    cost_per_unit: float = 0
    supplier: Optional[str] = None
    notes: Optional[str] = None


class BatchCreate(BaseModel):
    batch_number: str
    product_id: str
    planned_quantity: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None


class PlatformOrderCreate(BaseModel):
    platform: str
    order_id: str
    product_id: Optional[str] = None
    product_name: str
    quantity: float
    amount: float
    status: str = "pending"
    order_date: date


@router.get("/products")
async def list_products(
    category: Optional[str] = Query(None),
    low_stock: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    query = select(Product).options(selectinload(Product.inventory)).where(Product.is_active == True)
    if category:
        query = query.where(Product.category == category)
    query = query.order_by(Product.name)
    result = await db.execute(query)
    products = result.scalars().all()

    if low_stock:
        products = [p for p in products if p.inventory and p.inventory.current_stock <= p.inventory.reorder_level]

    return [_product_dict(p) for p in products]


@router.post("/products")
async def create_product(body: ProductCreate, current_user: ManagerUser = None, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Product).where(Product.sku == body.sku))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="SKU already exists")

    product = Product(
        name=body.name,
        sku=body.sku,
        category=body.category,
        description=body.description,
        unit=body.unit,
        mrp=body.mrp,
        cost_price=body.cost_price,
        gst_rate=body.gst_rate,
        hsn_code=body.hsn_code,
    )
    db.add(product)
    await db.flush()

    inv = Inventory(
        product_id=product.id,
        current_stock=0,
        reorder_level=body.reorder_level,
        max_stock=body.max_stock,
    )
    db.add(inv)
    await db.flush()

    product.inventory = inv
    return _product_dict(product)


@router.get("/products/{product_id}")
async def get_product(product_id: str, db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    result = await db.execute(
        select(Product).options(selectinload(Product.inventory)).where(Product.id == uuid.UUID(product_id))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_dict(product)


@router.post("/products/{product_id}/adjust-stock")
async def adjust_stock(
    product_id: str,
    body: StockAdjust,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).options(selectinload(Product.inventory)).where(Product.id == uuid.UUID(product_id))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if not product.inventory:
        inv = Inventory(product_id=product.id, current_stock=body.quantity)
        db.add(inv)
        product.inventory = inv
    else:
        new_stock = float(product.inventory.current_stock) + body.quantity
        if new_stock < 0:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        product.inventory.current_stock = new_stock

    await db.flush()
    return _product_dict(product)


# ---------- Raw Materials ----------

@router.get("/raw-materials")
async def list_raw_materials(db: AsyncSession = Depends(get_db), current_user: CurrentUser = None):
    result = await db.execute(select(RawMaterial).order_by(RawMaterial.name))
    return [_raw_material_dict(m) for m in result.scalars()]


@router.post("/raw-materials")
async def create_raw_material(body: RawMaterialCreate, current_user: ManagerUser = None, db: AsyncSession = Depends(get_db)):
    mat = RawMaterial(**body.model_dump())
    db.add(mat)
    await db.flush()
    return _raw_material_dict(mat)


@router.patch("/raw-materials/{material_id}/adjust")
async def adjust_raw_material(
    material_id: str,
    body: StockAdjust,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RawMaterial).where(RawMaterial.id == uuid.UUID(material_id)))
    mat = result.scalar_one_or_none()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")
    mat.current_stock = float(mat.current_stock) + body.quantity
    return _raw_material_dict(mat)


# ---------- Production Batches ----------

@router.get("/batches")
async def list_batches(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    query = select(ProductionBatch)
    if status:
        query = query.where(ProductionBatch.status == status)
    query = query.order_by(ProductionBatch.created_at.desc())
    result = await db.execute(query)
    return [_batch_dict(b) for b in result.scalars()]


@router.post("/batches")
async def create_batch(body: BatchCreate, current_user: ManagerUser = None, db: AsyncSession = Depends(get_db)):
    batch = ProductionBatch(
        batch_number=body.batch_number,
        product_id=uuid.UUID(body.product_id),
        planned_quantity=body.planned_quantity,
        start_date=body.start_date,
        end_date=body.end_date,
        notes=body.notes,
    )
    db.add(batch)
    await db.flush()
    return _batch_dict(batch)


@router.patch("/batches/{batch_id}/status")
async def update_batch_status(
    batch_id: str,
    status: str,
    produced_quantity: Optional[float] = None,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProductionBatch).where(ProductionBatch.id == uuid.UUID(batch_id)))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    batch.status = status
    if produced_quantity is not None:
        batch.produced_quantity = produced_quantity
    return _batch_dict(batch)


# ---------- Platform Orders ----------

@router.get("/platform-orders")
async def list_platform_orders(
    platform: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    query = select(PlatformOrder)
    if platform:
        query = query.where(PlatformOrder.platform == platform)
    if from_date:
        query = query.where(PlatformOrder.order_date >= from_date)
    if to_date:
        query = query.where(PlatformOrder.order_date <= to_date)
    query = query.order_by(PlatformOrder.order_date.desc())
    result = await db.execute(query)
    return [_order_dict(o) for o in result.scalars()]


@router.post("/platform-orders")
async def create_platform_order(
    body: PlatformOrderCreate, current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)
):
    order = PlatformOrder(
        platform=body.platform,
        order_id=body.order_id,
        product_id=uuid.UUID(body.product_id) if body.product_id else None,
        product_name=body.product_name,
        quantity=body.quantity,
        amount=body.amount,
        status=body.status,
        order_date=body.order_date,
    )
    db.add(order)
    await db.flush()
    return _order_dict(order)


@router.get("/platform-summary")
async def platform_summary(
    order_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    query = select(
        PlatformOrder.platform,
        func.count().label("count"),
        func.sum(PlatformOrder.amount).label("revenue"),
        func.sum(PlatformOrder.quantity).label("units"),
    ).group_by(PlatformOrder.platform)
    if order_date:
        query = query.where(PlatformOrder.order_date == order_date)
    result = await db.execute(query)
    return [
        {
            "platform": r.platform,
            "orders": r.count,
            "revenue": float(r.revenue or 0),
            "units": float(r.units or 0),
        }
        for r in result.all()
    ]


def _product_dict(p: Product) -> dict:
    inv = p.inventory
    return {
        "id": str(p.id),
        "name": p.name,
        "sku": p.sku,
        "category": p.category,
        "description": p.description,
        "unit": p.unit,
        "mrp": float(p.mrp),
        "cost_price": float(p.cost_price),
        "gst_rate": float(p.gst_rate),
        "hsn_code": p.hsn_code,
        "is_active": p.is_active,
        "image_url": p.image_url,
        "current_stock": float(inv.current_stock) if inv else 0,
        "reserved_stock": float(inv.reserved_stock) if inv else 0,
        "reorder_level": float(inv.reorder_level) if inv else 10,
        "max_stock": float(inv.max_stock) if inv else 1000,
        "is_low_stock": (float(inv.current_stock) <= float(inv.reorder_level)) if inv else False,
    }


def _raw_material_dict(m: RawMaterial) -> dict:
    return {
        "id": str(m.id),
        "name": m.name,
        "unit": m.unit,
        "current_stock": float(m.current_stock),
        "reorder_level": float(m.reorder_level),
        "cost_per_unit": float(m.cost_per_unit),
        "supplier": m.supplier,
        "notes": m.notes,
        "is_low_stock": float(m.current_stock) <= float(m.reorder_level),
    }


def _batch_dict(b: ProductionBatch) -> dict:
    return {
        "id": str(b.id),
        "batch_number": b.batch_number,
        "product_id": str(b.product_id),
        "planned_quantity": float(b.planned_quantity),
        "produced_quantity": float(b.produced_quantity),
        "status": b.status,
        "start_date": b.start_date.isoformat() if b.start_date else None,
        "end_date": b.end_date.isoformat() if b.end_date else None,
        "notes": b.notes,
        "created_at": b.created_at.isoformat(),
    }


def _order_dict(o: PlatformOrder) -> dict:
    return {
        "id": str(o.id),
        "platform": o.platform,
        "order_id": o.order_id,
        "product_name": o.product_name,
        "quantity": float(o.quantity),
        "amount": float(o.amount),
        "status": o.status,
        "order_date": o.order_date.isoformat(),
    }
