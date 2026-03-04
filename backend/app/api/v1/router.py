from fastapi import APIRouter

from app.api.v1.endpoints import auth, dashboard, employees, finance, inventory, tasks

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
