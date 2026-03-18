from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.db.session import get_db

from . import service
from .schema import KPIResponse, MonthlyTrendItem


async def get_kpis(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> KPIResponse:
    return await service.get_kpis(db)


async def monthly_trend(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
) -> list[MonthlyTrendItem]:
    return await service.monthly_trend(db)
