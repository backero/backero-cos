import uuid
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .model import Inventory, PlatformOrder, Product, ProductionBatch, RawMaterial
from .schema import (
    BatchCreate,
    BatchResponse,
    PlatformOrderCreate,
    PlatformOrderResponse,
    ProductCreate,
    ProductResponse,
    RawMaterialCreate,
    RawMaterialResponse,
    StockAdjust,
)


def _product_response(p: Product) -> ProductResponse:
    inv = p.inventory
    return ProductResponse(
        id=p.id,
        name=p.name,
        sku=p.sku,
        category=p.category,
        description=p.description,
        unit=p.unit,
        mrp=float(p.mrp),
        cost_price=float(p.cost_price),
        gst_rate=float(p.gst_rate),
        hsn_code=p.hsn_code,
        is_active=p.is_active,
        image_url=p.image_url,
        current_stock=float(inv.current_stock) if inv else 0,
        reserved_stock=float(inv.reserved_stock) if inv else 0,
        reorder_level=float(inv.reorder_level) if inv else 10,
        max_stock=float(inv.max_stock) if inv else 1000,
        is_low_stock=(float(inv.current_stock) <= float(inv.reorder_level)) if inv else False,
    )


async def list_products(
    db: AsyncSession,
    category: Optional[str] = None,
    low_stock: Optional[bool] = None,
) -> list[ProductResponse]:
    query = select(Product).options(selectinload(Product.inventory)).where(Product.is_active == True)
    if category:
        query = query.where(Product.category == category)
    query = query.order_by(Product.name)
    result = await db.execute(query)
    products = result.scalars().all()

    if low_stock:
        products = [p for p in products if p.inventory and p.inventory.current_stock <= p.inventory.reorder_level]

    return [_product_response(p) for p in products]


async def create_product(db: AsyncSession, body: ProductCreate) -> ProductResponse:
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
    return _product_response(product)


async def get_product(db: AsyncSession, product_id: str) -> ProductResponse:
    result = await db.execute(
        select(Product).options(selectinload(Product.inventory)).where(Product.id == uuid.UUID(product_id))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_response(product)


async def adjust_stock(db: AsyncSession, product_id: str, body: StockAdjust) -> ProductResponse:
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
    return _product_response(product)


async def list_raw_materials(db: AsyncSession) -> list[RawMaterialResponse]:
    result = await db.execute(select(RawMaterial).order_by(RawMaterial.name))
    materials = result.scalars().all()
    return [
        RawMaterialResponse(
            id=m.id,
            name=m.name,
            unit=m.unit,
            current_stock=float(m.current_stock),
            reorder_level=float(m.reorder_level),
            cost_per_unit=float(m.cost_per_unit),
            supplier=m.supplier,
            notes=m.notes,
            is_low_stock=float(m.current_stock) <= float(m.reorder_level),
        )
        for m in materials
    ]


async def create_raw_material(db: AsyncSession, body: RawMaterialCreate) -> RawMaterialResponse:
    mat = RawMaterial(**body.model_dump())
    db.add(mat)
    await db.flush()
    return RawMaterialResponse(
        id=mat.id,
        name=mat.name,
        unit=mat.unit,
        current_stock=float(mat.current_stock),
        reorder_level=float(mat.reorder_level),
        cost_per_unit=float(mat.cost_per_unit),
        supplier=mat.supplier,
        notes=mat.notes,
        is_low_stock=float(mat.current_stock) <= float(mat.reorder_level),
    )


async def adjust_raw_material(db: AsyncSession, material_id: str, body: StockAdjust) -> RawMaterialResponse:
    result = await db.execute(select(RawMaterial).where(RawMaterial.id == uuid.UUID(material_id)))
    mat = result.scalar_one_or_none()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")
    mat.current_stock = float(mat.current_stock) + body.quantity
    return RawMaterialResponse(
        id=mat.id,
        name=mat.name,
        unit=mat.unit,
        current_stock=float(mat.current_stock),
        reorder_level=float(mat.reorder_level),
        cost_per_unit=float(mat.cost_per_unit),
        supplier=mat.supplier,
        notes=mat.notes,
        is_low_stock=float(mat.current_stock) <= float(mat.reorder_level),
    )


async def list_batches(
    db: AsyncSession, status: Optional[str] = None
) -> list[BatchResponse]:
    query = select(ProductionBatch)
    if status:
        query = query.where(ProductionBatch.status == status)
    query = query.order_by(ProductionBatch.created_at.desc())
    result = await db.execute(query)
    return [BatchResponse.model_validate(b) for b in result.scalars()]


async def create_batch(db: AsyncSession, body: BatchCreate) -> BatchResponse:
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
    return BatchResponse.model_validate(batch)


async def update_batch_status(
    db: AsyncSession,
    batch_id: str,
    status: str,
    produced_quantity: Optional[float] = None,
) -> BatchResponse:
    result = await db.execute(select(ProductionBatch).where(ProductionBatch.id == uuid.UUID(batch_id)))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    batch.status = status
    if produced_quantity is not None:
        batch.produced_quantity = produced_quantity
    return BatchResponse.model_validate(batch)


async def list_platform_orders(
    db: AsyncSession,
    platform: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> list[PlatformOrderResponse]:
    query = select(PlatformOrder)
    if platform:
        query = query.where(PlatformOrder.platform == platform)
    if from_date:
        query = query.where(PlatformOrder.order_date >= from_date)
    if to_date:
        query = query.where(PlatformOrder.order_date <= to_date)
    query = query.order_by(PlatformOrder.order_date.desc())
    result = await db.execute(query)
    return [PlatformOrderResponse.model_validate(o) for o in result.scalars()]


async def create_platform_order(db: AsyncSession, body: PlatformOrderCreate) -> PlatformOrderResponse:
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
    return PlatformOrderResponse.model_validate(order)


async def platform_summary(
    db: AsyncSession, order_date: Optional[date] = None
) -> list[dict]:
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
