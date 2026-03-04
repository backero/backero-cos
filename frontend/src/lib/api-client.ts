import { toast } from "sonner";
import type {
  AccountEntry,
  Attendance,
  AuthResponse,
  AuthUser,
  DashboardKPIs,
  Department,
  Employee,
  FinanceSummary,
  Invoice,
  MonthlyTrend,
  PlatformOrder,
  PlatformSummary,
  Product,
  ProductionBatch,
  RawMaterial,
  Task,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ── Core fetch helpers ────────────────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | null | undefined>;
}

function buildUrl(path: string, params?: FetchOptions["params"]): string {
  const base = `${API_BASE}/api/v1${path}`;
  if (!params) return base;
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") {
      searchParams.set(k, String(v));
    }
  }
  const qs = searchParams.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Server-side fetch — uses cookies automatically (Next.js Server Components) */
export async function serverFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...init } = options;
  const url = buildUrl(path, params);
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

/** Client-side fetch — used inside TanStack Query hooks */
export async function clientFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...init } = options;
  const url = buildUrl(path, params);

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Typed API methods ─────────────────────────────────────────────────────────

export const api = {
  // Auth
  auth: {
    sendOtp: (phone: string) =>
      clientFetch<{ message: string }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      }),
    verifyOtp: (phone: string, otp: string) =>
      clientFetch<AuthResponse>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp }),
      }),
    me: () => clientFetch<AuthUser>("/auth/me"),
    logout: () => clientFetch<{ message: string }>("/auth/logout", { method: "POST" }),
    refresh: (refresh_token: string) =>
      clientFetch<{ access_token: string }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token }),
      }),
  },

  // Employees
  employees: {
    list: (params?: { department_id?: string; is_active?: boolean }) =>
      clientFetch<Employee[]>("/employees/", { params }),
    get: (id: string) => clientFetch<Employee>(`/employees/${id}`),
    create: (data: Record<string, unknown>) =>
      clientFetch<Employee>("/employees/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      clientFetch<Employee>(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    checkIn: (id: string, notes?: string) =>
      clientFetch<Attendance>(`/employees/${id}/check-in`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    checkOut: (id: string) =>
      clientFetch<Attendance>(`/employees/${id}/check-out`, { method: "POST" }),
    attendance: (id: string, month?: number, year?: number) =>
      clientFetch<Attendance[]>(`/employees/${id}/attendance`, { params: { month, year } }),

    departments: {
      list: () => clientFetch<Department[]>("/employees/departments"),
      create: (data: { name: string; description?: string }) =>
        clientFetch<Department>("/employees/departments", {
          method: "POST",
          body: JSON.stringify(data),
        }),
    },
  },

  // Tasks
  tasks: {
    list: (params?: { status?: string; priority?: string; assigned_to_id?: string }) =>
      clientFetch<Task[]>("/tasks/", { params }),
    create: (data: Record<string, unknown>) =>
      clientFetch<Task>("/tasks/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      clientFetch<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    complete: (id: string) =>
      clientFetch<Task>(`/tasks/${id}/complete`, { method: "POST" }),
    delete: (id: string) =>
      clientFetch<{ message: string }>(`/tasks/${id}`, { method: "DELETE" }),
  },

  // Finance
  finance: {
    invoices: {
      list: (params?: { status?: string; from_date?: string; to_date?: string }) =>
        clientFetch<Invoice[]>("/finance/invoices", { params }),
      create: (data: Record<string, unknown>) =>
        clientFetch<Invoice>("/finance/invoices", { method: "POST", body: JSON.stringify(data) }),
      updateStatus: (id: string, status: string) =>
        clientFetch<Invoice>(`/finance/invoices/${id}/status?status=${status}`, { method: "PATCH" }),
    },
    entries: {
      list: (params?: { type?: string; from_date?: string; to_date?: string }) =>
        clientFetch<AccountEntry[]>("/finance/entries", { params }),
      create: (data: Record<string, unknown>) =>
        clientFetch<AccountEntry>("/finance/entries", { method: "POST", body: JSON.stringify(data) }),
    },
    summary: (params?: { from_date?: string; to_date?: string }) =>
      clientFetch<FinanceSummary>("/finance/summary", { params }),
  },

  // Inventory
  inventory: {
    products: {
      list: (params?: { category?: string; low_stock?: boolean }) =>
        clientFetch<Product[]>("/inventory/products", { params }),
      get: (id: string) => clientFetch<Product>(`/inventory/products/${id}`),
      create: (data: Record<string, unknown>) =>
        clientFetch<Product>("/inventory/products", { method: "POST", body: JSON.stringify(data) }),
      adjustStock: (id: string, quantity: number, reason: string) =>
        clientFetch<Product>(`/inventory/products/${id}/adjust-stock`, {
          method: "POST",
          body: JSON.stringify({ quantity, reason }),
        }),
    },
    rawMaterials: {
      list: () => clientFetch<RawMaterial[]>("/inventory/raw-materials"),
      create: (data: Record<string, unknown>) =>
        clientFetch<RawMaterial>("/inventory/raw-materials", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      adjust: (id: string, quantity: number, reason: string) =>
        clientFetch<RawMaterial>(`/inventory/raw-materials/${id}/adjust`, {
          method: "PATCH",
          body: JSON.stringify({ quantity, reason }),
        }),
    },
    batches: {
      list: (params?: { status?: string }) =>
        clientFetch<ProductionBatch[]>("/inventory/batches", { params }),
      create: (data: Record<string, unknown>) =>
        clientFetch<ProductionBatch>("/inventory/batches", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      updateStatus: (id: string, status: string, produced_quantity?: number) =>
        clientFetch<ProductionBatch>(
          `/inventory/batches/${id}/status?status=${status}${produced_quantity !== undefined ? `&produced_quantity=${produced_quantity}` : ""}`,
          { method: "PATCH" }
        ),
    },
    platformOrders: {
      list: (params?: { platform?: string; from_date?: string; to_date?: string }) =>
        clientFetch<PlatformOrder[]>("/inventory/platform-orders", { params }),
      create: (data: Record<string, unknown>) =>
        clientFetch<PlatformOrder>("/inventory/platform-orders", {
          method: "POST",
          body: JSON.stringify(data),
        }),
    },
    platformSummary: (order_date?: string) =>
      clientFetch<PlatformSummary[]>("/inventory/platform-summary", {
        params: { order_date },
      }),
  },

  // Dashboard
  dashboard: {
    kpis: () => clientFetch<DashboardKPIs>("/dashboard/kpis"),
    monthlyTrend: () => clientFetch<MonthlyTrend[]>("/dashboard/monthly-trend"),
  },
};

// ── Error handler helper ──────────────────────────────────────────────────────
export function handleApiError(error: unknown, fallback = "Something went wrong") {
  const message = error instanceof Error ? error.message : fallback;
  toast.error(message);
}
