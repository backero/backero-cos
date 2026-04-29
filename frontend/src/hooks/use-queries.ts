"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, handleApiError } from "@/lib/api-client";

// ── Query Keys ────────────────────────────────────────────────────────────────
export const QK = {
  me: ["me"],
  roles: ["roles"],
  employees: (params?: object) => ["employees", params],
  employee: (id: string) => ["employees", id],
  departments: ["departments"],
  attendance: (id: string, month?: number, year?: number) => ["attendance", id, month, year],
  tasks: (params?: object) => ["tasks", params],
  taskAttachments: (taskId: string) => ["task-attachments", taskId],
  invoices: (params?: object) => ["invoices", params],
  entries: (params?: object) => ["entries", params],
  financeSummary: (params?: object) => ["finance-summary", params],
  products: (params?: object) => ["products", params],
  product: (id: string) => ["products", id],
  rawMaterials: ["raw-materials"],
  batches: (params?: object) => ["batches", params],
  platformOrders: (params?: object) => ["platform-orders", params],
  platformSummary: (date?: string) => ["platform-summary", date],
  kpis: ["kpis"],
  monthlyTrend: ["monthly-trend"],
} as const;

// ── Roles ────────────────────────────────────────────────────────────────────
export function useRoles() {
  return useQuery({
    queryKey: QK.roles,
    queryFn: () => api.roles.list(),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export function useMe() {
  return useQuery({
    queryKey: QK.me,
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ── Employees ─────────────────────────────────────────────────────────────────
export function useEmployees(params?: { department_id?: string; is_active?: boolean; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: QK.employees(params),
    queryFn: () => api.employees.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: QK.employee(id),
    queryFn: () => api.employees.get(id),
    enabled: !!id,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: QK.departments,
    queryFn: () => api.employees.departments.list(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useAttendance(id: string, month?: number, year?: number) {
  return useQuery({
    queryKey: QK.attendance(id, month, year),
    queryFn: () => api.employees.attendance(id, month, year),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.employees.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee created successfully");
    },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.employees.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee updated");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.employees.checkIn(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: QK.kpis });
      toast.success("Checked in successfully");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.employees.checkOut(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Checked out successfully");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.employees.departments.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.departments });
      toast.success("Department created");
    },
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; description?: string } }) =>
      api.employees.departments.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.departments });
      toast.success("Department updated");
    },
  });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export function useTasks(params?: { status?: string; priority?: string; assigned_to_id?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: QK.tasks(params),
    queryFn: () => api.tasks.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.tasks.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: QK.kpis });
      toast.success("Task created");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.tasks.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task updated");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: QK.kpis });
      toast.success("Task marked as complete");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useSubmitCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.tasks.submitCompletion(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Submitted for approval");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useApproveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: QK.kpis });
      toast.success("Task approved and completed");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useRejectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.tasks.reject(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task sent back for rework");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: () => api.tasks.comments.list(taskId!),
    enabled: !!taskId,
  });
}

export function useAddTaskComment(taskId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => api.tasks.comments.add(taskId!, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
    },
    onError: (e) => handleApiError(e),
  });
}

export function useComplianceTasks() {
  return useQuery({
    queryKey: ["compliance-tasks"],
    queryFn: () => api.tasks.compliance(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTaskAttachments(taskId: string | null) {
  return useQuery({
    queryKey: QK.taskAttachments(taskId!),
    queryFn: () => api.tasks.attachments.list(taskId!),
    enabled: !!taskId,
  });
}

export function useUploadTaskAttachment(taskId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.tasks.attachments.upload(taskId!, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.taskAttachments(taskId!) });
      toast.success("File uploaded");
    },
    onError: (e) => handleApiError(e, "Upload failed"),
  });
}

// ── Finance ───────────────────────────────────────────────────────────────────
export function useInvoices(params?: { status?: string; from_date?: string; to_date?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: QK.invoices(params),
    queryFn: () => api.finance.invoices.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.finance.invoices.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("Invoice created");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useEntries(params?: { type?: string; from_date?: string; to_date?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: QK.entries(params),
    queryFn: () => api.finance.entries.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.finance.entries.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      qc.invalidateQueries({ queryKey: QK.kpis });
      toast.success("Entry added");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.finance.invoices.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("Invoice status updated");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useFinanceSummary(params?: { from_date?: string; to_date?: string }) {
  return useQuery({
    queryKey: QK.financeSummary(params),
    queryFn: () => api.finance.summary(params),
  });
}

// ── Inventory ─────────────────────────────────────────────────────────────────
export function useProducts(params?: { category?: string; low_stock?: boolean; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: QK.products(params),
    queryFn: () => api.inventory.products.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: QK.product(id),
    queryFn: () => api.inventory.products.get(id),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.inventory.products.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity, reason }: { id: string; quantity: number; reason: string }) =>
      api.inventory.products.adjustStock(id, quantity, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: QK.kpis });
      toast.success("Stock adjusted successfully");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useRawMaterials() {
  return useQuery({
    queryKey: QK.rawMaterials,
    queryFn: () => api.inventory.rawMaterials.list(),
  });
}

export function useAdjustRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity, reason }: { id: string; quantity: number; reason: string }) =>
      api.inventory.rawMaterials.adjust(id, quantity, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.rawMaterials });
      toast.success("Raw material stock adjusted");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useCreateRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.inventory.rawMaterials.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.rawMaterials });
      toast.success("Raw material added");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useExportRawMaterials() {
  return useMutation({
    mutationFn: () => api.inventory.rawMaterials.export(),
    onError: (e) => handleApiError(e),
  });
}

export function useImportRawMaterials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.inventory.rawMaterials.import(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.rawMaterials });
      toast.success("Raw materials imported");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useBatches(params?: { status?: string }) {
  return useQuery({
    queryKey: QK.batches(params),
    queryFn: () => api.inventory.batches.list(params),
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.inventory.batches.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      toast.success("Production batch created");
    },
    onError: (e) => handleApiError(e),
  });
}

export function useUpdateBatchStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      produced_quantity,
    }: {
      id: string;
      status: string;
      produced_quantity?: number;
    }) => api.inventory.batches.updateStatus(id, status, produced_quantity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      toast.success("Batch status updated");
    },
    onError: (e) => handleApiError(e),
  });
}

export function usePlatformOrders(params?: {
  platform?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: QK.platformOrders(params),
    queryFn: () => api.inventory.platformOrders.list(params),
    placeholderData: (prev) => prev,
  });
}

export function usePlatformSummary(order_date?: string) {
  return useQuery({
    queryKey: QK.platformSummary(order_date),
    queryFn: () => api.inventory.platformSummary(order_date),
  });
}

export function useCreatePlatformOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.inventory.platformOrders.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-orders"] });
      qc.invalidateQueries({ queryKey: ["platform-summary"] });
      toast.success("Order logged");
    },
    onError: (e) => handleApiError(e),
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function useDashboardKPIs() {
  return useQuery({
    queryKey: QK.kpis,
    queryFn: () => api.dashboard.kpis(),
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useMonthlyTrend() {
  return useQuery({
    queryKey: QK.monthlyTrend,
    queryFn: () => api.dashboard.monthlyTrend(),
  });
}
