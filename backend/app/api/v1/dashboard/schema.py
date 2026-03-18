from pydantic import BaseModel


class TaskStats(BaseModel):
    total: int
    pending: int
    in_progress: int
    completed: int
    overdue: int


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
