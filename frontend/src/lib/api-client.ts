import { toast } from "sonner";

// ── Typed API error ───────────────────────────────────────────────────────────

export class ApiError extends Error {
  field?: string | null;
  status: number;

  constructor(message: string, status: number, field?: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
  }
}
import type {
  AccountEntry,
  Attendance,
  AuthUser,
  AuthResponse,
  ComplianceTask,
  DashboardKPIs,
  Department,
  Employee,
  FinanceSummary,
  Invoice,
  Module,
  ModuleAccess,
  MonthlyTrend,
  Notification,
  PlatformOrder,
  PlatformSummary,
  Product,
  ProductionBatch,
  RawMaterial,
  RoleDetail,
  Task,
  TaskComment,
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
export async function serverFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
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
    throw new ApiError(err.detail || "Request failed", res.status, err.field ?? null);
  }
  return res.json();
}

/** Download a file from the API and trigger browser download */
export async function clientDownload(path: string, filename: string, options: FetchOptions = {}): Promise<void> {
  const { params, ...init } = options;
  const url = buildUrl(path, params);
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Download failed" }));
    throw new ApiError(err.detail || "Download failed", res.status);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

/** Upload a file and return JSON response */
export async function clientUpload<T>(path: string, file: File): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const url = buildUrl(path);
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new ApiError(err.detail || "Upload failed", res.status);
  }
  return res.json();
}

/** Client-side fetch — used inside TanStack Query hooks */
export async function clientFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { params, ...init } = options;
  const url = buildUrl(path, params);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

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
    const field = err.field ?? res.headers.get("X-Field") ?? null;
    throw new ApiError(err.detail || "Request failed", res.status, field);
  }
  return res.json();
}

// ── Typed API methods ─────────────────────────────────────────────────────────

export const api = {
  // Auth
  auth: {
    sendOtp: (phone: string) =>
      clientFetch<{ message: string; otp: string }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      }),
    verifyOtp: (phone: string, otp: string) =>
      clientFetch<AuthResponse>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp }),
      }),
    me: () => clientFetch<AuthUser>("/auth/me"),
    logout: () =>
      clientFetch<{ message: string }>("/auth/logout", { method: "POST" }),
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
      clientFetch<Employee>("/employees/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      clientFetch<Employee>(`/employees/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    checkIn: (id: string, notes?: string) =>
      clientFetch<Attendance>(`/employees/${id}/check-in`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    checkOut: (id: string) =>
      clientFetch<Attendance>(`/employees/${id}/check-out`, { method: "POST" }),
    attendance: (id: string, month?: number, year?: number) =>
      clientFetch<Attendance[]>(`/employees/${id}/attendance`, {
        params: { month, year },
      }),
    export: () => clientDownload("/employees/export", "employees.xlsx"),
    sample: () => clientDownload("/employees/sample", "employees_sample.xlsx"),
    import: (file: File) => clientUpload<{ created: number; skipped: number; errors: string[] }>("/employees/import", file),

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
    list: (params?: {
      status?: string;
      priority?: string;
      assigned_to_id?: string;
      department_id?: string;
      search?: string;
    }) => clientFetch<Task[]>("/tasks/", { params }),
    get: (id: string) => clientFetch<Task>(`/tasks/${id}`),
    create: (data: Record<string, unknown>) =>
      clientFetch<Task>("/tasks/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      clientFetch<Task>(`/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    updateStatus: (id: string, status: string) =>
      clientFetch<Task>(`/tasks/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    complete: (id: string) =>
      clientFetch<Task>(`/tasks/${id}/complete`, { method: "POST" }),
    delete: (id: string) =>
      clientFetch<{ message: string }>(`/tasks/${id}`, { method: "DELETE" }),
    compliance: () => clientFetch<ComplianceTask[]>("/tasks/compliance"),
    export: (params?: { status?: string; priority?: string }) =>
      clientDownload("/tasks/export", "tasks.xlsx", { params }),
    addComment: (taskId: string, content: string) =>
      clientFetch<TaskComment>(`/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
  },

  // Notifications
  notifications: {
    list: (unread_only?: boolean) =>
      clientFetch<Notification[]>("/notifications/", { params: { unread_only } }),
    unreadCount: () => clientFetch<{ count: number }>("/notifications/unread-count"),
    markRead: (id: string) =>
      clientFetch<{ message: string }>(`/notifications/${id}/read`, { method: "PATCH" }),
    markAllRead: () =>
      clientFetch<{ message: string }>("/notifications/mark-all-read", { method: "PATCH" }),
  },

  // Finance
  finance: {
    invoices: {
      list: (params?: {
        status?: string;
        from_date?: string;
        to_date?: string;
      }) => clientFetch<Invoice[]>("/finance/invoices", { params }),
      create: (data: Record<string, unknown>) =>
        clientFetch<Invoice>("/finance/invoices", {
          method: "POST",
          body: JSON.stringify(data),
        }),
        updateStatus: (id: string, status: string) =>
        clientFetch<Invoice>(
          `/finance/invoices/${id}/status?status=${status}`,
          { method: "PATCH" },
        ),
      downloadPdf: (id: string, invoiceNumber: string) =>
        clientDownload(`/finance/invoices/${id}/pdf`, `invoice-${invoiceNumber}.pdf`),
      export: (params?: { status?: string; from_date?: string; to_date?: string }) =>
        clientDownload("/finance/invoices/export", "invoices.xlsx", { params }),
    },
    entries: {
      list: (params?: {
        type?: string;
        from_date?: string;
        to_date?: string;
      }) => clientFetch<AccountEntry[]>("/finance/entries", { params }),
      create: (data: Record<string, unknown>) =>
        clientFetch<AccountEntry>("/finance/entries", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      export: (params?: { type?: string; from_date?: string; to_date?: string }) =>
        clientDownload("/finance/entries/export", "finance_entries.xlsx", { params }),
      sample: () => clientDownload("/finance/entries/sample", "entries_sample.xlsx"),
      import: (file: File) => clientUpload<{ created: number; skipped: number; errors: string[] }>("/finance/entries/import", file),
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
        clientFetch<Product>("/inventory/products", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      adjustStock: (id: string, quantity: number, reason: string) =>
        clientFetch<Product>(`/inventory/products/${id}/adjust-stock`, {
          method: "POST",
          body: JSON.stringify({ quantity, reason }),
        }),
      export: () => clientDownload("/inventory/products/export", "products.xlsx"),
      sample: () => clientDownload("/inventory/products/sample", "products_sample.xlsx"),
      import: (file: File) => clientUpload<{ created: number; skipped: number; errors: string[] }>("/inventory/products/import", file),
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
      export: () => clientDownload("/inventory/raw-materials/export", "raw_materials.xlsx"),
      sample: () => clientDownload("/inventory/raw-materials/sample", "raw_materials_sample.xlsx"),
      import: (file: File) => clientUpload<{ created: number; skipped: number; errors: string[] }>("/inventory/raw-materials/import", file),
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
          { method: "PATCH" },
        ),
    },
    platformOrders: {
      list: (params?: {
        platform?: string;
        from_date?: string;
        to_date?: string;
      }) =>
        clientFetch<PlatformOrder[]>("/inventory/platform-orders", { params }),
      create: (data: Record<string, unknown>) =>
        clientFetch<PlatformOrder>("/inventory/platform-orders", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      export: (params?: { platform?: string; from_date?: string; to_date?: string }) =>
        clientDownload("/inventory/platform-orders/export", "platform_orders.xlsx", { params }),
      sample: () => clientDownload("/inventory/platform-orders/sample", "platform_orders_sample.xlsx"),
      import: (file: File) => clientUpload<{ created: number; skipped: number; errors: string[] }>("/inventory/platform-orders/import", file),
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

  // Profile
  profile: {
    update: (data: { name?: string; email?: string; designation?: string; avatar_url?: string }) =>
      clientFetch<AuthUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  // Roles & Permissions
  roles: {
    list: () => clientFetch<RoleDetail[]>("/roles/"),
    create: (data: { name: string; description?: string; color?: string; permissions?: Partial<Record<Module, ModuleAccess>> }) =>
      clientFetch<RoleDetail>("/roles/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { name?: string; description?: string; color?: string; permissions?: Partial<Record<Module, ModuleAccess>> }) =>
      clientFetch<RoleDetail>(`/roles/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      clientFetch<{ message: string }>(`/roles/${id}`, { method: "DELETE" }),
  },
};

// ── Error handler helpers ─────────────────────────────────────────────────────

export function handleApiError(
  error: unknown,
  fallback = "Something went wrong",
) {
  const message = error instanceof Error ? error.message : fallback;
  toast.error(message);
}

/**
 * Bind an API error to a react-hook-form field when the server returns a
 * field-specific error (e.g. unique constraint on `name` or `phone`).
 * Returns true if a field error was set, false if it fell back to a toast.
 */
export function bindApiError<T extends Record<string, unknown>>(
  error: unknown,
  setError: (field: keyof T, err: { message: string }) => void,
  fallback = "Something went wrong",
): boolean {
  if (error instanceof ApiError && error.field) {
    setError(error.field as keyof T, { message: error.message });
    return true;
  }
  handleApiError(error, fallback);
  return false;
}
