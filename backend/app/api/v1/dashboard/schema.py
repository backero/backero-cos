from pydantic import BaseModel
from uuid import UUID


class TaskStats(BaseModel):
    total: int
    pending: int
    in_progress: int
    completed: int
    overdue: int


class DepartmentProductivityItem(BaseModel):
    department_id: UUID
    department_name: str
    total_tasks: int
    pending_tasks: int
    in_progress_tasks: int
    completed_tasks: int
    overdue_tasks: int
    completion_rate: float
    overdue_rate: float
    average_completion_days: float
    active_employees: int


class KPIResponse(BaseModel):
    revenue_this_month: float
    expenses_this_month: float
    net_profit: float
    pending_invoices_count: int
    pending_invoices_amount: float
    tasks: TaskStats
    total_employees: int
    present_today: int
    low_stock_products: int


class MonthlyTrendItem(BaseModel):
    month: str
    income: float
    expense: float
