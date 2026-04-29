from fastapi import APIRouter

from . import controller
from .schema import KPIResponse, MonthlyTrendItem, DepartmentProductivityItem

router = APIRouter()

router.get("/kpis", response_model=KPIResponse)(controller.get_kpis)
router.get("/monthly-trend", response_model=list[MonthlyTrendItem])(controller.monthly_trend)
router.get(
    "/department-productivity",
    response_model=list[DepartmentProductivityItem],
)(controller.department_productivity)
