from fastapi import APIRouter

from app.api.v1.auth.router import router as auth_router
from app.api.v1.dashboard.router import router as dashboard_router
from app.api.v1.employees.router import router as employees_router
from app.api.v1.finance.router import router as finance_router
from app.api.v1.inventory.router import router as inventory_router
from app.api.v1.payroll.router import router as payroll_router
from app.api.v1.search.router import router as search_router
from app.api.v1.records.router import router as records_router
from app.api.v1.roles.router import router as roles_router
from app.api.v1.tasks.router import router as tasks_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(employees_router, prefix="/employees", tags=["employees"])
api_router.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
api_router.include_router(finance_router, prefix="/finance", tags=["finance"])
api_router.include_router(inventory_router, prefix="/inventory", tags=["inventory"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(roles_router, prefix="/roles", tags=["roles"])
api_router.include_router(records_router, prefix="/records", tags=["records"])
api_router.include_router(payroll_router, tags=["payroll"])
api_router.include_router(search_router, tags=["search"])
