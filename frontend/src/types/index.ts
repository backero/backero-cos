// ── Auth ────────────────────────────────────────────────────────────────────
export type Role = "admin" | "manager" | "employee";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: Role;
  designation?: string | null;
  department_id?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  employee: AuthUser;
}

// ── Employees ───────────────────────────────────────────────────────────────
export interface Department {
  id: string;
  name: string;
  description?: string | null;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: Role;
  designation?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  salary?: number | null;
  join_date?: string | null;
  is_active: boolean;
  avatar_url?: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  status: "present" | "absent" | "half_day" | "wfh";
  notes?: string | null;
}

// ── Tasks ───────────────────────────────────────────────────────────────────
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string | null;
  completed_at?: string | null;
  assigned_to_id?: string | null;
  created_by_id?: string | null;
  department_id?: string | null;
  extension_requested: boolean;
  extension_reason?: string | null;
  extension_days: number | null;
  created_at: string;
}

export interface ComplianceTask {
  id: string;
  title: string;
  description?: string | null;
  due_date: string;
  recurrence?: "monthly" | "quarterly" | "annual" | null;
  is_completed: boolean;
  completed_at?: string | null;
  category?: "gst" | "tds" | "roc" | "other" | null;
}

// ── Finance ─────────────────────────────────────────────────────────────────
export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  customer_gstin?: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  is_gst: boolean;
  status: InvoiceStatus;
  notes?: string | null;
  items: InvoiceItem[];
  created_at: string;
}

export interface AccountEntry {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  payment_mode: "cash" | "bank" | "upi" | "cheque";
  reference?: string | null;
  created_at: string;
}

export interface FinanceSummary {
  income: number;
  expense: number;
  net: number;
  invoices: Record<string, { total: number; count: number }>;
}

// ── Inventory ───────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  description?: string | null;
  unit: string;
  mrp: number;
  cost_price: number;
  gst_rate: number;
  hsn_code?: string | null;
  is_active: boolean;
  image_url?: string | null;
  current_stock: number;
  reserved_stock: number;
  reorder_level: number;
  max_stock: number;
  is_low_stock: boolean;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  reorder_level: number;
  cost_per_unit: number;
  supplier?: string | null;
  notes?: string | null;
  is_low_stock: boolean;
}

export interface ProductionBatch {
  id: string;
  batch_number: string;
  product_id: string;
  planned_quantity: number;
  produced_quantity: number;
  status: "planned" | "in_progress" | "completed" | "rejected";
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  created_at: string;
}

export type PlatformName = "amazon" | "flipkart" | "meesho" | "website" | "offline";

export interface PlatformOrder {
  id: string;
  platform: PlatformName;
  order_id: string;
  product_name: string;
  quantity: number;
  amount: number;
  status: "pending" | "shipped" | "delivered" | "returned" | "cancelled";
  order_date: string;
}

export interface PlatformSummary {
  platform: PlatformName;
  orders: number;
  revenue: number;
  units: number;
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardKPIs {
  revenue_this_month: number;
  expenses_this_month: number;
  net_profit: number;
  pending_invoices_count: number;
  pending_invoices_amount: number;
  tasks: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    overdue: number;
  };
  total_employees: number;
  present_today: number;
  low_stock_products: number;
}

export interface MonthlyTrend {
  month: string;
  income: number;
  expense: number;
}

// ── API Helpers ──────────────────────────────────────────────────────────────
export interface ApiError {
  detail: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
