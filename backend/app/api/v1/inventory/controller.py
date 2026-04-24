from datetime import date
from typing import Optional

from fastapi import Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, ManagerUser
from app.db.session import get_db
from app.utils import excel as xl

from . import service
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

_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


async def list_products(
    category: Optional[str] = Query(None),
    low_stock: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[ProductResponse]:
    return await service.list_products(db, category, low_stock)


async def create_product(
    body: ProductCreate,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    return await service.create_product(db, body)


async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> ProductResponse:
    return await service.get_product(db, product_id)


async def adjust_stock(
    product_id: str,
    body: StockAdjust,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    return await service.adjust_stock(db, product_id, body)


# ── Products Import/Export ────────────────────────────────────────────────────

async def export_products(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    products = await service.list_products(db)
    data = xl.export_products([p.model_dump() for p in products])
    return Response(content=data, media_type=_XLSX,
                    headers={"Content-Disposition": "attachment; filename=products.xlsx"})


async def products_sample():
    return Response(content=xl.products_sample(), media_type=_XLSX,
                    headers={"Content-Disposition": "attachment; filename=products_sample.xlsx"})


async def import_products(
    file: UploadFile = File(...),
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
):
    contents = await file.read()
    rows, errors = xl.parse_products(contents)
    created, skipped = [], []
    for row in rows:
        try:
            p = await service.create_product(db, ProductCreate(**row))
            created.append(p.name)
            await db.commit()
        except HTTPException as e:
            skipped.append(f"{row['name']}: {e.detail}")
        except Exception as e:
            skipped.append(f"{row.get('name', '?')}: {str(e)}")
    return {"created": len(created), "skipped": len(skipped), "errors": errors + skipped}


# ── Raw Materials ─────────────────────────────────────────────────────────────

async def list_raw_materials(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[RawMaterialResponse]:
    return await service.list_raw_materials(db)


async def create_raw_material(
    body: RawMaterialCreate,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
) -> RawMaterialResponse:
    return await service.create_raw_material(db, body)


async def adjust_raw_material(
    material_id: str,
    body: StockAdjust,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
) -> RawMaterialResponse:
    return await service.adjust_raw_material(db, material_id, body)


async def export_raw_materials(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    materials = await service.list_raw_materials(db)
    data = xl.export_raw_materials([m.model_dump() for m in materials])
    return Response(content=data, media_type=_XLSX,
                    headers={"Content-Disposition": "attachment; filename=raw_materials.xlsx"})


async def raw_materials_sample():
    return Response(content=xl.raw_materials_sample(), media_type=_XLSX,
                    headers={"Content-Disposition": "attachment; filename=raw_materials_sample.xlsx"})


async def import_raw_materials(
    file: UploadFile = File(...),
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
):
    contents = await file.read()
    rows, errors = xl.parse_raw_materials(contents)
    created, skipped = [], []
    for row in rows:
        try:
            m = await service.create_raw_material(db, RawMaterialCreate(**row))
            created.append(m.name)
            await db.commit()
        except Exception as e:
            skipped.append(f"{row.get('name', '?')}: {str(e)}")
    return {"created": len(created), "skipped": len(skipped), "errors": errors + skipped}


# ── Batches ───────────────────────────────────────────────────────────────────

async def list_batches(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[BatchResponse]:
    return await service.list_batches(db, status)


async def create_batch(
    body: BatchCreate,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
) -> BatchResponse:
    return await service.create_batch(db, body)


async def update_batch_status(
    batch_id: str,
    status: str,
    produced_quantity: Optional[float] = None,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
) -> BatchResponse:
    return await service.update_batch_status(db, batch_id, status, produced_quantity)


# ── Platform Orders ───────────────────────────────────────────────────────────

async def list_platform_orders(
    platform: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[PlatformOrderResponse]:
    return await service.list_platform_orders(db, platform, from_date, to_date)


async def create_platform_order(
    body: PlatformOrderCreate,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
) -> PlatformOrderResponse:
    return await service.create_platform_order(db, body)


async def platform_summary(
    order_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    return await service.platform_summary(db, order_date)


async def export_platform_orders(
    platform: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    orders = await service.list_platform_orders(db, platform, from_date, to_date)
    data = xl.export_platform_orders([o.model_dump() for o in orders])
    return Response(content=data, media_type=_XLSX,
                    headers={"Content-Disposition": "attachment; filename=platform_orders.xlsx"})


async def platform_orders_sample():
    return Response(content=xl.platform_orders_sample(), media_type=_XLSX,
                    headers={"Content-Disposition": "attachment; filename=platform_orders_sample.xlsx"})


async def import_platform_orders(
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    contents = await file.read()
    rows, errors = xl.parse_platform_orders(contents)
    created, skipped = [], []
    for row in rows:
        try:
            o = await service.create_platform_order(db, PlatformOrderCreate(**row))
            created.append(o.order_id)
            await db.commit()
        except Exception as e:
            skipped.append(f"{row.get('order_id', '?')}: {str(e)}")
    return {"created": len(created), "skipped": len(skipped), "errors": errors + skipped}
