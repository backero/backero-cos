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
  ActivityLog,
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
  PaginatedResponse,
  PlatformOrder,
  PlatformSummary,
  Product,
  ProductionBatch,
  RawMaterial,
  RoleDetail,
  Task,
  TaskAttachment,
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
    const rawDetail = err.detail;
    let message: string;
    if (typeof rawDetail === "string") {
      message = rawDetail;
    } else if (Array.isArray(rawDetail)) {
      // FastAPI validation error: [{loc, msg, type}, ...]
      message = rawDetail.map((e: Record<string, unknown>) => String(e.msg ?? JSON.stringify(e))).join("; ");
    } else if (rawDetail) {
      message = JSON.stringify(rawDetail);
    } else {
      message = "Request failed";
    }
    throw new ApiError(message, res.status, field);
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
    list: (params?: { department_id?: string; is_active?: boolean; search?: string; page?: number; limit?: number }) =>
      clientFetch<PaginatedResponse<Employee>>("/employees/", { params }),
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

    departments: {
      list: () => clientFetch<Department[]>("/employees/departments"),
      create: (data: { name: string; description?: string }) =>
        clientFetch<Department>("/employees/departments", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      update: (id: string, data: { name: string; description?: string }) =>
        clientFetch<Department>(`/employees/departments/${id}`, {
          method: "PATCH",
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
      search?: string;
      page?: number;
      limit?: number;
    }) => clientFetch<PaginatedResponse<Task>>("/tasks/", { params }),
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
    complete: (id: string) =>
      clientFetch<Task>(`/tasks/${id}/complete`, { method: "POST" }),
    submitCompletion: (id: string, note?: string) =>
      clientFetch<Task>(`/tasks/${id}/submit-completion`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    approve: (id: string) =>
      clientFetch<Task>(`/tasks/${id}/approve`, { method: "POST" }),
    reject: (id: string, note?: string) =>
      clientFetch<Task>(`/tasks/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    delete: (id: string) =>
      clientFetch<{ message: string }>(`/tasks/${id}`, { method: "DELETE" }),
    compliance: () => clientFetch<ComplianceTask[]>("/tasks/compliance"),
    comments: {
      list: (taskId: string) => clientFetch<TaskComment[]>(`/tasks/${taskId}/comments`),
      add: (taskId: string, message: string) =>
        clientFetch<TaskComment>(`/tasks/${taskId}/comments`, {
          method: "POST",
          body: JSON.stringify({ message }),
        }),
    },
    attachments: {
      list: (taskId: string) => clientFetch<TaskAttachment[]>(`/tasks/${taskId}/attachments`),
      upload: (taskId: string, file: File) => {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        const form = new FormData();
        form.append("file", file);
        return fetch(`${API_BASE}/api/v1/tasks/${taskId}/attachments`, {
          method: "POST",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        }).then(async (r) => {
          if (!r.ok) {
            const e = await r.json().catch(() => ({ detail: "Upload failed" }));
            throw new ApiError(e.detail || "Upload failed", r.status);
          }
          return r.json() as Promise<TaskAttachment>;
        });
      },
      download: async (taskId: string, attachmentId: string, filename: string) => {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        const url = `${API_BASE}/api/v1/tasks/${taskId}/attachments/${attachmentId}/download`;
        const r = await fetch(url, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) throw new Error("Download failed");
        const blob = await r.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      },
    },
  },

  // Finance
  finance: {
    invoices: {
      list: (params?: {
        status?: string;
        from_date?: string;
        to_date?: string;
        search?: string;
        page?: number;
        limit?: number;
      }) => clientFetch<PaginatedResponse<Invoice>>("/finance/invoices", { params }),
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
    },
    entries: {
      list: (params?: {
        type?: string;
        from_date?: string;
        to_date?: string;
        search?: string;
        page?: number;
        limit?: number;
      }) => clientFetch<PaginatedResponse<AccountEntry>>("/finance/entries", { params }),
      create: (data: Record<string, unknown>) =>
        clientFetch<AccountEntry>("/finance/entries", {
          method: "POST",
          body: JSON.stringify(data),
        }),
    },
    summary: (params?: { from_date?: string; to_date?: string }) =>
      clientFetch<FinanceSummary>("/finance/summary", { params }),
  },

  // Inventory
  inventory: {
    products: {
      list: (params?: { category?: string; low_stock?: boolean; search?: string; page?: number; limit?: number }) =>
        clientFetch<PaginatedResponse<Product>>("/inventory/products", { params }),
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
      export: async () => {
        const items = await clientFetch<RawMaterial[]>("/inventory/raw-materials");
        const headers = ["Name", "Unit", "Current Stock", "Reorder Level", "Cost Per Unit"];
        const rows = items.map((m) => [
          `"${m.name}"`,
          m.unit,
          m.current_stock,
          m.reorder_level,
          m.cost_per_unit ?? "",
        ]);
        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `raw-materials-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      import: async (file: File) => {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        const form = new FormData();
        form.append("file", file);
        const r = await fetch(`${API_BASE}/api/v1/inventory/raw-materials/import`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({ detail: "Import failed" }));
          throw new ApiError(e.detail || "Import failed", r.status);
        }
        return r.json();
      },
      sample: () => {
        const csv = ["Name,Unit,Current Stock,Minimum Stock,Cost Per Unit", "Cotton Yarn,kg,500,100,120", "Dye Powder,g,2000,500,5"].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "raw-materials-sample.csv";
        a.click();
        URL.revokeObjectURL(a.href);
      },
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
        search?: string;
        page?: number;
        limit?: number;
      }) =>
        clientFetch<PaginatedResponse<PlatformOrder>>("/inventory/platform-orders", { params }),
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
    importTemplate: () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const url = `${API_BASE}/api/v1/inventory/products/import/template`;
      const a = document.createElement("a");
      a.href = url;
      a.click();
    },
    exportProducts: () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const url = `${API_BASE}/api/v1/inventory/products/export`;
      fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then((r) => r.blob())
        .then((blob) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "products_export.xlsx";
          a.click();
        });
    },
    importProducts: (file: File) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const form = new FormData();
      form.append("file", file);
      return fetch(`${API_BASE}/api/v1/inventory/products/import`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }).then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({ detail: "Import failed" }));
          throw new ApiError(e.detail || "Import failed", r.status);
        }
        return r.json();
      });
    },
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

  // Records (Activity Log)
  records: {
    list: (params?: { entity_type?: string; action?: string; page?: number; limit?: number }) =>
      clientFetch<PaginatedResponse<ActivityLog>>("/records/", { params }),
    restore: (id: string) =>
      clientFetch<{ message: string; entity_type: string; entity_name?: string }>(`/records/${id}/restore`, { method: "POST" }),
  },

  // Finance — invoice PDF download
  invoicePdf: async (invoiceId: string, invoiceNumber?: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const url = `${API_BASE}/api/v1/finance/invoices/${invoiceId}/pdf`;
    try {
      const r = await fetch(url, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: "Download failed" }));
        throw new ApiError(err.detail || "Download failed", r.status);
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = invoiceNumber ? `Invoice_${invoiceNumber}.pdf` : `invoice_${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error(e instanceof Error ? e.message : "Failed to download invoice");
    }
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
