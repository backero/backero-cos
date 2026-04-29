from datetime import date
from typing import Optional

from fastapi import Depends, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import PaginatedResponse
from app.core.dependencies import CurrentUser, ManagerUser
from app.db.session import get_db

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


async def list_products(
    category: Optional[str] = Query(None),
    low_stock: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> PaginatedResponse[ProductResponse]:
    return await service.list_products(db, category, low_stock, search, page, limit)


async def create_product(
    body: ProductCreate,
    current_user: ManagerUser = None,
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    return await service.create_product(db, body, current_user.id, current_user.name)


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
    return await service.adjust_stock(db, product_id, body, current_user.id, current_user.name)


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


async def list_platform_orders(
    platform: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> PaginatedResponse[PlatformOrderResponse]:
    return await service.list_platform_orders(db, platform, from_date, to_date, search, page, limit)


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


async def get_import_template(current_user: CurrentUser = None):
    return service.get_import_template()


async def export_products(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    return await service.export_products(db)


async def import_products(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: ManagerUser = None,
):
    return await service.import_products(db, file, current_user.id, current_user.name)
